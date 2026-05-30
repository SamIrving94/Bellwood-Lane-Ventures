/**
 * Heading-aware markdown chunker.
 *
 * Why heading-aware: a single chunk that crosses sections loses retrieval
 * signal — the embedding becomes an average of two unrelated topics. By
 * splitting on H1/H2/H3 and keeping the heading trail (e.g. "§5 The four
 * content streams › Stream 1") on each chunk, every embedding has a
 * coherent topic AND every retrieved excerpt comes pre-labelled with
 * "where in the doc this came from".
 *
 * Token estimate: we use 1 token ≈ 4 chars rather than a real tokenizer
 * because (a) we'd need tiktoken as a dep, (b) chunk-size accuracy doesn't
 * need to be perfect, the embedder is the source of truth on cost. The
 * estimate is intentionally coarse so a section that's e.g. 410 tokens
 * doesn't get split unnecessarily.
 */

const TARGET_TOKENS = 400;
const CHARS_PER_TOKEN = 4;
const TARGET_CHARS = TARGET_TOKENS * CHARS_PER_TOKEN; // ~1600 chars
// Hard ceiling — anything larger gets paragraph-split even mid-section.
const MAX_CHARS = TARGET_CHARS * 1.5;

export type Chunk = {
  headingTrail: string;
  body: string;
};

type HeadingLevel = 1 | 2 | 3;

type Section = {
  level: HeadingLevel | 0; // 0 = preamble before any heading
  heading: string;
  body: string;
};

/**
 * Split markdown into sections by H1/H2/H3 boundaries.
 * Preserves text under a heading as that section's `body`.
 */
function splitByHeadings(markdown: string): Section[] {
  const lines = markdown.split(/\r?\n/);
  const sections: Section[] = [];
  let current: Section = { level: 0, heading: '', body: '' };

  for (const line of lines) {
    const match = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (match) {
      // Push the previous section (even if empty preamble).
      if (current.body.trim() || current.heading) {
        sections.push(current);
      }
      const level = match[1].length as HeadingLevel;
      current = { level, heading: match[2].trim(), body: '' };
    } else {
      current.body += `${line}\n`;
    }
  }
  if (current.body.trim() || current.heading) sections.push(current);
  return sections;
}

/**
 * Reconstruct a "heading trail" by walking through sections in order and
 * remembering the most recent H1/H2/H3. Each section gets a trail like
 * "Top-level › Subsection › Sub-sub". Preamble (no heading) gets "" trail.
 */
function buildTrails(sections: Section[]): Array<Section & { trail: string }> {
  let h1 = '';
  let h2 = '';
  let h3 = '';
  return sections.map((s) => {
    if (s.level === 1) {
      h1 = s.heading;
      h2 = '';
      h3 = '';
    } else if (s.level === 2) {
      h2 = s.heading;
      h3 = '';
    } else if (s.level === 3) {
      h3 = s.heading;
    }
    const parts = [h1, h2, h3].filter(Boolean);
    return { ...s, trail: parts.join(' › ') };
  });
}

/**
 * If a section body is bigger than MAX_CHARS, sub-split it on paragraph
 * boundaries (double newline). Each resulting chunk targets ~TARGET_CHARS
 * but we never split mid-paragraph — RAG retrievers handle "slightly too
 * big" much better than "broken sentence".
 */
function paragraphSplit(body: string): string[] {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buffer = '';
  for (const para of paragraphs) {
    // If the paragraph alone exceeds the ceiling, emit it on its own —
    // we never break inside a paragraph.
    if (para.length > MAX_CHARS) {
      if (buffer.trim()) {
        chunks.push(buffer.trim());
        buffer = '';
      }
      chunks.push(para);
      continue;
    }
    const candidate = buffer ? `${buffer}\n\n${para}` : para;
    if (candidate.length > TARGET_CHARS && buffer) {
      chunks.push(buffer.trim());
      buffer = para;
    } else {
      buffer = candidate;
    }
  }
  if (buffer.trim()) chunks.push(buffer.trim());
  return chunks;
}

/**
 * Top-level entrypoint. Given the raw text of a markdown file, returns a
 * list of chunks each tagged with its heading trail.
 */
export function chunkMarkdown(markdown: string): Chunk[] {
  const sections = splitByHeadings(markdown);
  const withTrails = buildTrails(sections);

  const chunks: Chunk[] = [];
  for (const section of withTrails) {
    const body = section.body.trim();
    if (!body) continue;

    if (body.length <= MAX_CHARS) {
      chunks.push({ headingTrail: section.trail, body });
      continue;
    }

    // Section too large — split on paragraphs.
    const sub = paragraphSplit(body);
    for (const part of sub) {
      chunks.push({ headingTrail: section.trail, body: part });
    }
  }
  return chunks;
}

/**
 * Coarse token estimate used internally + exported for ingest CLI logging.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}
