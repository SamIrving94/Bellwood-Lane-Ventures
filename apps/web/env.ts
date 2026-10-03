import { keys as email } from '@repo/email/keys';
import { keys as core } from '@repo/next-config/keys';
import { keys as observability } from '@repo/observability/keys';
import { keys as security } from '@repo/security/keys';
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  extends: [core(), email(), observability(), security()],
  server: {
    // Set by Vercel itself. Used to keep tracking tags to the live site.
    VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
  },
  client: {
    // Unset or "" = no Google Analytics and no cookie banner (nothing to
    // consent to). .env.example ships it as "".
    NEXT_PUBLIC_GA_MEASUREMENT_ID: z
      .union([z.string().startsWith('G-'), z.literal('')])
      .optional(),
    // Advertising tags, same rule: unset or "" = not loaded, not asked about.
    NEXT_PUBLIC_GOOGLE_ADS_ID: z
      .union([z.string().startsWith('AW-'), z.literal('')])
      .optional(),
    NEXT_PUBLIC_GTM_ID: z
      .union([z.string().startsWith('GTM-'), z.literal('')])
      .optional(),
    NEXT_PUBLIC_META_PIXEL_ID: z
      .union([z.string().regex(/^\d+$/), z.literal('')])
      .optional(),
    // PostHog, cookieless, outside the consent gate (see app/layout.tsx).
    // Unset or "" = not loaded. The provider itself reads these through
    // @repo/analytics/keys; they are declared here so the web build
    // validates them like every other public tag id.
    NEXT_PUBLIC_POSTHOG_KEY: z
      .union([z.string().startsWith('phc_'), z.literal('')])
      .optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.union([z.string().url(), z.literal('')]).optional(),
  },
  runtimeEnv: {
    VERCEL_ENV: process.env.VERCEL_ENV,
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    NEXT_PUBLIC_GOOGLE_ADS_ID: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID,
    NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID,
    NEXT_PUBLIC_GTM_ID: process.env.NEXT_PUBLIC_GTM_ID,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  },
});
