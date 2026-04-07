import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const keys = () =>
  createEnv({
    server: {
      TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
      TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
      TWILIO_WHATSAPP_NUMBER: z.string().min(1).optional(),
      TWILIO_SANDBOX_KEYWORD: z.string().min(1).optional(),
      OPENAI_API_KEY: z.string().min(1).startsWith('sk-').optional(),
    },
    runtimeEnv: {
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
      TWILIO_WHATSAPP_NUMBER: process.env.TWILIO_WHATSAPP_NUMBER,
      TWILIO_SANDBOX_KEYWORD: process.env.TWILIO_SANDBOX_KEYWORD,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    },
  });
