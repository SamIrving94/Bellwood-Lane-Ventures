
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { chunkMarkdown, estimateTokens, type Chunk } from './chunker';
import { embed, isEmbeddingAvailable } from './embedder';
import {
  existingHashesForSource,
  hashBody,
  replaceChunksForSource,
  type ChunkInput,
} from './store';

/**
 * One-shot ingester: walks docs/**, chunks each .md / .mdx, embeds in
 * batches, upserts. Idempotent — files whose chunks are all already in
 * the store (by SHA-256 of body) are skipped without an embed call.
 *
 * Designed to be called from `bin/ingest.ts` but also exported so it can
 * be wired into a future cron / git-hook if needed.
 */

const MARKDOWN_EXT = new Set(['.md', '.mdx']);
const EMBED_BATCH_SIZE = 32;

export type IngestStats = {
  filesScanned: number;
  filesSkipped: number;
  filesUpserted: number;
  chunksUpserted: number;
  embedCalls: number;
  approxTokens: number;
  errors: Array<{ path: string; error: string }>;
};

export type IngestOptions = {
  rootDir: string; // repo root — used to compute sourcePath
  docsDirs: string[]; // dirs (absolute) to walk
};

async function* walkMarkdown(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // dir doesn't exist — silent skip, caller decides
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkMarkdown(full);
    } else if (entry.isFile()) {
      const dot = entry.name.lastIndexOf('.');
      if (dot < 0) continue;
      const ext = entry.name.slice(dot).toLowerCase();
      if (MARKDOWN_EXT.has(ext)) yield full;
    }
  }
}

function toPosix(p: string): string {
  return sep === '/' ? p : p.split(sep).join('/');
}

async function embedInBatches(
  texts: string[],
): Promise<{ model: string; vectors: number[][]; calls: number }> {
  const allVectors: number[][] = [];
  let model = 'unknown';
  let calls = 0;
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    const result = await embed(batch, 'document');
    if (!result) {
      throw new Error(
        'No embedding provider configured (set VOYAGE_API_KEY or OPENAI_API_KEY).',
      );
    }
    model = result.model;
    allVectors.push(...result.vectors);
    calls += 1;
  }
  return { model, vectors: allVectors, calls };
}

/**
 * Process one markdown file: chunk it, decide whether to re-embed (skip if
 * every new chunk's hash is already in the store), embed if needed, then
 * replace.
 */
async function ingestFile(
  absolutePath: string,
  sourcePath: string,
  stats: IngestStats,
): Promise<void> {
  const raw = await readFile(absolutePath, 'utf8');
  if (!raw.trim()) {
    stats.filesSkipped += 1;
    return;
  }

  const chunks: Chunk[] = chunkMarkdown(raw);
  if (chunks.length === 0) {
    stats.filesSkipped += 1;
    return;
  }

  // Idempotency: if every new-chunk hash already exists for this source,
  // nothing has changed materially. Skip without an embed call.
  const existing = await existingHashesForSource(sourcePath);
  const newHashes = chunks.map((c) => hashBody(c.body));
  const unchanged =
    existing.size === newHashes.length &&
    newHashes.every((h) => existing.has(h));
  if (unchanged) {
    stats.filesSkipped += 1;
    return;
  }

  const { model, vectors, calls } = await embedInBatches(
    chunks.map((c) => c.body),
  );
  if (vectors.length !== chunks.length) {
    throw new Error(
      `Embed vector count (${vectors.length}) != chunk count (${chunks.length}) for ${sourcePath}`,
    );
  }

  const rows: ChunkInput[] = chunks.map((c, i) => ({
    sourcePath,
    headingTrail: c.headingTrail,
    body: c.body,
    embedding: vectors[i],
    model,
  }));

  await replaceChunksForSource(sourcePath, rows);

  stats.filesUpserted += 1;
  stats.chunksUpserted += chunks.length;
  stats.embedCalls += calls;
  for (const c of chunks) stats.approxTokens += estimateTokens(c.body);
}

/**
 * Walk every configured docs dir, ingest each markdown file. Returns a
 * stats object so the CLI can print a single-line summary at the end.
 */
export async function ingest(opts: IngestOptions): Promise<IngestStats> {
  const stats: IngestStats = {
    filesScanned: 0,
    filesSkipped: 0,
    filesUpserted: 0,
    chunksUpserted: 0,
    embedCalls: 0,
    approxTokens: 0,
    errors: [],
  };

  if (!isEmbeddingAvailable()) {
    throw new Error(
      'No embedding provider configured. Set VOYAGE_API_KEY (preferred) or OPENAI_API_KEY.',
    );
  }

  for (const docsDir of opts.docsDirs) {
    let statResult;
    try {
      statResult = await stat(docsDir);
    } catch {
      stats.errors.push({ path: docsDir, error: 'directory not found' });
      continue;
    }
    if (!statResult.isDirectory()) continue;

    for await (const filePath of walkMarkdown(docsDir)) {
      stats.filesScanned += 1;
      const sourcePath = toPosix(relative(opts.rootDir, filePath));
      try {
        await ingestFile(filePath, sourcePath, stats);
      } catch (err) {
        stats.errors.push({
          path: sourcePath,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return stats;
}
