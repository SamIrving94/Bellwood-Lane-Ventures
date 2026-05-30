import { callClaude } from '@repo/ai/claude';
import {
  isEmbeddingAvailable,
  searchKnowledgeFull,
} from '@repo/knowledge-base';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { unauthorizedResponse, validateAgentAuth } from '../../_lib/auth';

/**
 * POST /agents/concierge/ask
 *
 * RAG over the docs/ knowledge base. Embeds the question, retrieves the
 * top-3 chunks, asks Claude to answer using ONLY those excerpts with
 * inline source-path citations.
 *
 * Body: { question: string, k?: number }
 * Response (200): { answer: string, sources: Array<{ path, excerpt }> }
 * Response (503): when no embedding provider OR no Anthropic key is set.
 *
 * Auth: validateAgentAuth — same Bearer token as the rest of /agents/*.
 *
 * The Claude call uses the shared @repo/ai/claude.ts client so it inherits
 * the OpenRouter fallback chain + LlmCallLog observability + Haiku/Sonnet
 * tiering. The `concierge_rag` feature tag surfaces in /admin/llm-usage.
 */

const RequestSchema = z.object({
  question: z.string().trim().min(3).max(2000),
  k: z.number().int().min(1).max(10).optional(),
});

const SYSTEM_PROMPT = `You are Bellwood Ventures' internal knowledge concierge.

Answer the founder's question using ONLY the provided excerpts from the docs/
knowledge base. Rules:

1. Cite the source path inline in square brackets immediately after each
   claim it supports, e.g. "Offers below 60% AVM need approval [docs/HANDOVER.md]."
   Use the EXACT path string as shown in the excerpt headers.
2. If multiple excerpts support the same claim, cite each one: "[a.md][b.md]".
3. If the excerpts do not contain enough information to answer the question,
   say so plainly: "The knowledge base doesn't cover this — closest match
   was [path]." Do NOT speculate or fall back on general knowledge.
4. Keep the answer concise. 1–3 short paragraphs is usually right.
5. Never invent a path that wasn't in the excerpts.`;

function buildUserMessage(
  question: string,
  hits: Array<{ path: string; headingTrail: string; body: string }>,
): string {
  const formatted = hits
    .map(
      (h, i) =>
        `[Excerpt ${i + 1} — path: ${h.path}${
          h.headingTrail ? ` — section: ${h.headingTrail}` : ''
        }]\n${h.body}`,
    )
    .join('\n\n---\n\n');

  return `Question: ${question}\n\nExcerpts from the knowledge base:\n\n${formatted}`;
}

export const POST = async (request: Request) => {
  if (!validateAgentAuth(request)) return unauthorizedResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (!isEmbeddingAvailable()) {
    return NextResponse.json(
      {
        error: 'knowledge_base_unavailable',
        hint: 'No embedding provider configured. Set VOYAGE_API_KEY (preferred) or OPENAI_API_KEY on the API server, then run `pnpm --filter @repo/knowledge-base ingest`.',
      },
      { status: 503 },
    );
  }

  const k = parsed.data.k ?? 3;
  const hits = await searchKnowledgeFull(parsed.data.question, k);
  if (hits === null) {
    return NextResponse.json(
      {
        error: 'knowledge_base_unavailable',
        hint: 'Embedder returned null — provider key may be invalid.',
      },
      { status: 503 },
    );
  }

  if (hits.length === 0) {
    return NextResponse.json({
      answer:
        "The knowledge base is empty — nothing has been ingested yet. Run `pnpm --filter @repo/knowledge-base ingest` to index docs/.",
      sources: [],
    });
  }

  const answer = await callClaude({
    system: SYSTEM_PROMPT,
    user: buildUserMessage(parsed.data.question, hits),
    maxTokens: 1024,
    temperature: 0.3,
    feature: 'concierge_rag',
  });

  if (!answer) {
    return NextResponse.json(
      {
        error: 'llm_unavailable',
        hint: 'Claude call failed or ANTHROPIC_API_KEY is not set. Check /admin/llm-usage for recent failures.',
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    answer,
    sources: hits.map((h) => ({ path: h.path, excerpt: h.excerpt })),
  });
};
