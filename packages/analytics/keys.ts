import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const keys = () =>
  createEnv({
    client: {
      NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).startsWith('phc_').optional(),
      NEXT_PUBLIC_POSTHOG_HOST: z.string().min(1).url().optional(),
      NEXT_PUBLIC_GA_MEASUREMENT_ID: z
        .string()
        .min(1)
        .startsWith('G-')
        .optional(),
    },
    runtimeEnv: {
      NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
      NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    },
    // The public site ships these as "" to mean "off" (apps/web/.env.example).
    // Without this, "" fails the startsWith checks and the provider throws in
    // the browser instead of quietly not loading.
    emptyStringAsUndefined: true,
  });
