import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

/**
 * Env keys for @repo/document-pipeline.
 *
 * - MISTRAL_API_KEY enables Mistral OCR (mistral-ocr-latest). Optional; when
 *   missing, the pipeline falls back to handing the raw PDF straight to
 *   Claude (which can parse PDFs natively via the Files API).
 * - ANTHROPIC_API_KEY enables Claude Sonnet via the Files + Citations beta
 *   APIs. Optional; when missing, the pipeline returns a stubbed extract
 *   with confidence=0 and errorReason='no_api_key'.
 */
export const keys = () =>
  createEnv({
    server: {
      MISTRAL_API_KEY: z.string().min(1).optional(),
      ANTHROPIC_API_KEY: z.string().min(1).optional(),
    },
    runtimeEnv: {
      MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    },
  });
