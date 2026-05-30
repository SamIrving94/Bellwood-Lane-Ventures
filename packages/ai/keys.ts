import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const keys = () =>
  createEnv({
    server: {
      ANTHROPIC_API_KEY: z.string().min(1).optional(),
      OPENAI_API_KEY: z.string().min(1).startsWith('sk-').optional(),
      /**
       * Optional. When set, recoverable Anthropic failures (429 / 5xx /
       * timeout / network) are retried once through OpenRouter routing
       * to `anthropic/claude-sonnet-4-5` → `openai/gpt-5` →
       * `google/gemini-2.5-pro`. Missing key = no fallback chain;
       * Anthropic failures return null and callers degrade gracefully.
       */
      OPENROUTER_API_KEY: z.string().min(1).optional(),
    },
    runtimeEnv: {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    },
  });
