import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

// Both optional on purpose: with no OAuth client configured every Google
// feature skips quietly (same graceful-fallback rule as @repo/email).
export const keys = () =>
  createEnv({
    server: {
      GOOGLE_CLIENT_ID: z.string().min(1).optional(),
      GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    },
    runtimeEnv: {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    },
  });
