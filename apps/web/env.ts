import { keys as email } from '@repo/email/keys';
import { keys as core } from '@repo/next-config/keys';
import { keys as observability } from '@repo/observability/keys';
import { keys as security } from '@repo/security/keys';
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  extends: [core(), email(), observability(), security()],
  server: {},
  client: {
    // Unset or "" = no Google Analytics and no cookie banner (nothing to
    // consent to). .env.example ships it as "".
    NEXT_PUBLIC_GA_MEASUREMENT_ID: z
      .union([z.string().startsWith('G-'), z.literal('')])
      .optional(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  },
});
