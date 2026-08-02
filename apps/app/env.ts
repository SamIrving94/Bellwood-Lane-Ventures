import { keys as auth } from '@repo/auth/keys';
import { keys as calendly } from '@repo/calendly/keys';
import { keys as database } from '@repo/database/keys';
import { keys as email } from '@repo/email/keys';
import { keys as core } from '@repo/next-config/keys';
import { keys as observability } from '@repo/observability/keys';
import { keys as security } from '@repo/security/keys';
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  extends: [
    auth(),
    calendly(),
    core(),
    database(),
    email(),
    observability(),
    security(),
  ],
  server: {
    PAPERCLIP_API_KEY: z.string().optional(),
    // Comma-separated allowlists read by `requireFounder()` (@repo/auth).
    // When both are unset the guard falls back to requiring Clerk org
    // membership — see packages/auth/require-founder.ts.
    FOUNDER_USER_IDS: z.string().optional(),
    FOUNDER_EMAIL_ALLOWLIST: z.string().optional(),
  },
  client: {},
  runtimeEnv: {
    PAPERCLIP_API_KEY: process.env.PAPERCLIP_API_KEY,
    FOUNDER_USER_IDS: process.env.FOUNDER_USER_IDS,
    FOUNDER_EMAIL_ALLOWLIST: process.env.FOUNDER_EMAIL_ALLOWLIST,
  },
});
