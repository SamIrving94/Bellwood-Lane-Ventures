import { keys as auth } from '@repo/auth/keys';
import { keys as calendly } from '@repo/calendly/keys';
import { keys as database } from '@repo/database/keys';
import { keys as email } from '@repo/email/keys';
import { keys as core } from '@repo/next-config/keys';
import { keys as observability } from '@repo/observability/keys';
import { keys as propertyData } from '@repo/property-data/keys';
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
    propertyData(),
  ],
  server: {
    CRON_SECRET: z.string().min(1),
    PAPERCLIP_API_KEY: z.string().min(1),
    /** Comma-separated UK postcodes the prospecting cron should scan. */
    AGENT_PROSPECTING_POSTCODES: z.string().optional(),
    /** Email to receive the weekly prospecting summary (defaults to RESEND_FROM). */
    AGENT_PROSPECTING_REPORT_EMAIL: z.string().email().optional(),
  },
  client: {},
  runtimeEnv: {
    CRON_SECRET: process.env.CRON_SECRET,
    PAPERCLIP_API_KEY: process.env.PAPERCLIP_API_KEY,
    AGENT_PROSPECTING_POSTCODES: process.env.AGENT_PROSPECTING_POSTCODES,
    AGENT_PROSPECTING_REPORT_EMAIL: process.env.AGENT_PROSPECTING_REPORT_EMAIL,
  },
});
