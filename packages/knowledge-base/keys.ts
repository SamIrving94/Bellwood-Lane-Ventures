import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

/**
 * Knowledge base embeds the docs/ markdown corpus and queries it back at
 * runtime. We prefer Voyage 3 because:
 *  - 1024-dim (smaller index, faster cosine ops on Neon)
 *  - Trained specifically for retrieval (their `input_type: 'document'` vs
 *    `'query'` distinction lifts recall vs OpenAI on RAG corpora)
 *  - Cheap enough that re-ingesting the whole knowledge base costs cents
 *
 * If VOYAGE_API_KEY is missing, the embedder falls back to OpenAI
 * `text-embedding-3-small`. Note that OpenAI is 1536-dim by default — we
 * use the `dimensions: 1024` request param to truncate it down so we can
 * keep ONE Postgres `vector(1024)` column instead of branching schemas.
 *
 * If BOTH keys are missing, the embedder returns null and the concierge
 * endpoint returns 503. We don't fall back to lexical search — silent
 * downgrades are how RAG systems start lying to founders.
 */
export const keys = () =>
  createEnv({
    server: {
      VOYAGE_API_KEY: z.string().min(1).optional(),
      // Reused from @repo/ai — we DON'T own this key, just read it.
      OPENAI_API_KEY: z.string().min(1).startsWith('sk-').optional(),
      ANTHROPIC_API_KEY: z.string().min(1).optional(),
    },
    runtimeEnv: {
      VOYAGE_API_KEY: process.env.VOYAGE_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    },
  });
