import { keys as analytics } from '@repo/analytics/keys';
import { keys as auth } from '@repo/auth/keys';
import { keys as calendly } from '@repo/calendly/keys';
import { keys as database } from '@repo/database/keys';
import { keys as email } from '@repo/email/keys';
import { keys as core } from '@repo/next-config/keys';
import { keys as observability } from '@repo/observability/keys';
import { keys as payments } from '@repo/payments/keys';
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  extends: [
    auth(),
    analytics(),
    calendly(),
    core(),
    database(),
    email(),
    observability(),
    payments(),
  ],
  server: {
    CRON_SECRET: z.string().min(1),
    PAPERCLIP_API_KEY: z.string().min(1),
  },
  client: {},
  runtimeEnv: {
    CRON_SECRET: process.env.CRON_SECRET,
    PAPERCLIP_API_KEY: process.env.PAPERCLIP_API_KEY,
  },
});
