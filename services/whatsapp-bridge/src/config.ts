import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  BELLWOOD_API_URL: z
    .string()
    .url()
    .default('https://bellwood-api.vercel.app'),
  PAPERCLIP_API_KEY: z.string().min(1, 'PAPERCLIP_API_KEY is required'),
  ALLOWED_GROUPS: z
    .string()
    .min(1, 'ALLOWED_GROUPS is required (comma-separated group names)'),
  LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error'])
    .default('info'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('[config] invalid env:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  allowedGroups: parsed.data.ALLOWED_GROUPS.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

export type Config = typeof config;
