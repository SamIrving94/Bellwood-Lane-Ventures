import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const keys = () =>
  createEnv({
    server: {
      CALENDLY_API_TOKEN: z.string().min(1).optional(),
      CALENDLY_EVENT_URL: z
        .string()
        .url()
        .optional()
        .default('https://calendly.com/samjlirving/initial-call'),
      CALENDLY_WEBHOOK_SIGNING_KEY: z.string().min(1).optional(),
    },
    runtimeEnv: {
      CALENDLY_API_TOKEN: process.env.CALENDLY_API_TOKEN,
      CALENDLY_EVENT_URL: process.env.CALENDLY_EVENT_URL,
      CALENDLY_WEBHOOK_SIGNING_KEY: process.env.CALENDLY_WEBHOOK_SIGNING_KEY,
    },
  });
