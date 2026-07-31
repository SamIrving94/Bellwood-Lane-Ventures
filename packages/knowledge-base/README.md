# @repo/knowledge-base

Embeddings + RAG over the `docs/` markdown corpus.

## What it does

1. Walks `docs/**/*.md(x)` from the repo root.
2. Heading-aware chunks each file (~400 tokens, split on H1/H2/H3, sub-split paragraphs if a section is too big).
3. Embeds each chunk via **Voyage 3** (1024-dim, retrieval-tuned) or **OpenAI `text-embedding-3-small`** (truncated to 1024-dim) as a fallback.
4. Stores chunks in Postgres in a `vector(1024)` column via pgvector.
5. Exposes `searchKnowledge(query, k)` — top-k cosine-similarity matches with source paths.
6. Powers `POST /agents/concierge/ask` — a question-answering endpoint that retrieves top-3 chunks and asks Claude to answer with inline citations.

## Prerequisites (one-time)

### 1. Enable pgvector on Neon

In the Neon dashboard or via `psql`:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

> pgvector is supported on Neon but **must be enabled per database**. If you skip this, `prisma db push` will fail when it hits the `vector(1024)` column type.

### 2. Apply the Prisma schema

```bash
pnpm --filter @repo/database build
pnpm --filter @repo/database exec prisma db push
```

This creates the `KnowledgeChunk` table. Because the `embedding` column is typed as `Unsupported("vector(1024)")` in `schema.prisma`, Prisma will only manage the column's existence — read/write goes through raw SQL in `src/store.ts` and `src/search.ts`.

### 3. Set environment variables

In `.env` (or your hosted env):

```bash
# Preferred — Voyage 3, 1024-dim, retrieval-tuned.
VOYAGE_API_KEY=pa-...

# Fallback only — used if VOYAGE_API_KEY is missing.
# We request `dimensions: 1024` from OpenAI so the vector column type matches.
OPENAI_API_KEY=sk-...

# For the concierge endpoint's answer step.
ANTHROPIC_API_KEY=sk-ant-...
```

## Run the first ingest

```bash
pnpm --filter @repo/knowledge-base ingest
```

Output is a JSON summary, e.g.:

```json
{
  "ok": true,
  "filesScanned": 17,
  "filesSkipped": 0,
  "filesUpserted": 17,
  "chunksUpserted": 142,
  "embedCalls": 5,
  "approxTokens": 56800,
  "errors": []
}
```

The ingester is idempotent — re-running it without changing any docs will report `filesUpserted: 0` and make zero embed API calls (chunks are matched by SHA-256 of body).

## Using search at runtime

```ts
import { searchKnowledge } from '@repo/knowledge-base';

const hits = await searchKnowledge('what is our policy on offers below 60% AVM?', 3);
// hits == null when no provider key is configured — caller MUST handle.
```

## Concierge endpoint

```bash
curl -X POST https://api.bellwood.example/agents/concierge/ask \
  -H "Authorization: Bearer $BELLWOOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"question": "what is our policy on offers below 60% AVM?"}'
```

Returns:

```json
{
  "answer": "Offers below 60% of AVM require founder approval [docs/HANDOVER.md] …",
  "sources": [
    { "path": "docs/HANDOVER.md", "excerpt": "…" },
    { "path": "docs/prds/agent-portal-v1-2026-04.md", "excerpt": "…" }
  ]
}
```

Returns `503` if no embedding provider key is set.

## Why Voyage over OpenAI

- Trained specifically for retrieval; their `input_type: 'document'` vs `'query'` distinction lifts recall on a small corpus.
- 1024-dim by default — smaller index, faster cosine ops on Neon.
- Cheaper at corpus-rebuild scale.

OpenAI fallback exists so a fresh checkout with only `OPENAI_API_KEY` set (the existing key in this repo) can still ingest without signing up for Voyage. We pass `dimensions: 1024` to match the column type — that's a documented Matryoshka-style reduction OpenAI officially supports on `text-embedding-3-small`.
