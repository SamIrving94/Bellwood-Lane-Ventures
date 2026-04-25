import { keys as auth } from '@repo/auth/keys';
import { keys as calendly } from '@repo/calendly/keys';
import { keys as database } from '@repo/database/keys';
import { keys as email } from '@repo/email/keys';
import { keys as flags } from '@repo/feature-flags/keys';
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
    flags(),
    observability(),
    security(),
  ],
  server: {
    PAPERCLIP_API_KEY: z.string().optional(),
  },
  client: {},
  runtimeEnv: {
    PAPERCLIP_API_KEY: process.env.PAPERCLIP_API_KEY,
  },
});
