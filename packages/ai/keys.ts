import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const keys = () =>
  createEnv({
    server: {
      ANTHROPIC_API_KEY: z.string().min(1).optional(),
      OPENAI_API_KEY: z.string().min(1).startsWith('sk-').optional(),
      /**
       * OpenRouter key. The ONLY LLM route (founder decision, 3 Oct 2026:
       * "we moved everything to OpenRouter"; one bill, any model, open-weight
       * challengers testable per feature from Settings → AI models).
       * ANTHROPIC_API_KEY above is retired and unfunded; the planner still
       * tolerates it as a fallback hop but nothing may depend on it.
       */
      OPENROUTER_API_KEY: z.string().min(1).optional(),
      /**
       * Force the primary provider. Default: `openrouter` whenever
       * OPENROUTER_API_KEY is set, else `anthropic`. Set to `anthropic` to
       * go direct first and keep OpenRouter as the fallback only.
       */
      LLM_PRIMARY_PROVIDER: z.enum(['openrouter', 'anthropic']).optional(),
      /**
       * Optional comma-separated OpenRouter model ids tried, in order, after
       * the primary fails on a recoverable error. Overrides the built-in
       * per-tier chain in @repo/ai/routing (DEFAULT_FALLBACK_CHAINS).
       */
      LLM_FALLBACK_CHAIN: z.string().min(1).optional(),
    },
    runtimeEnv: {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
      LLM_PRIMARY_PROVIDER: process.env.LLM_PRIMARY_PROVIDER,
      LLM_FALLBACK_CHAIN: process.env.LLM_FALLBACK_CHAIN,
    },
  });
