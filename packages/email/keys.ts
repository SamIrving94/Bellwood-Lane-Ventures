import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const keys = () =>
  createEnv({
    server: {
      RESEND_FROM: z.string().min(1).email().optional(),
      /** Mailbox replies should reach. Unset = DEFAULT_REPLY_TO in addresses.ts. */
      RESEND_REPLY_TO: z.string().min(1).email().optional(),
      RESEND_TOKEN: z.string().min(1).startsWith('re_').optional(),
    },
    runtimeEnv: {
      RESEND_FROM: process.env.RESEND_FROM,
      RESEND_REPLY_TO: process.env.RESEND_REPLY_TO,
      RESEND_TOKEN: process.env.RESEND_TOKEN,
    },
  });
