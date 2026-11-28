import { keys as auth } from '@repo/auth/keys';
import { keys as calendly } from '@repo/calendly/keys';
import { keys as database } from '@repo/database/keys';
import { keys as email } from '@repo/email/keys';
import { keys as google } from '@repo/google/keys';
import { keys as core } from '@repo/next-config/keys';
import { keys as observability } from '@repo/observability/keys';
import { keys as propertyData } from '@repo/property-data/keys';
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

/**
 * Strip a leading UTF-8 byte order mark (U+FEFF) and surrounding whitespace
 * from a secret. Sep 2026: CRON_SECRET on the dashboard project carried a
 * BOM from the file it was pasted from, which is invisible in the Vercel UI
 * but made every "Bearer <secret>" header invalid. Cleaning here means the
 * value the dashboard sends and the value this app compares against agree
 * even if one copy of the env var was pasted with the BOM.
 */
const cleanSecret = (raw: string | undefined): string | undefined => {
  if (raw === undefined) return undefined;
  const cleaned = raw.replace(/^\uFEFF/, '').trim();
  return cleaned.length > 0 ? cleaned : undefined;
};

export const env = createEnv({
  extends: [
    auth(),
    calendly(),
    core(),
    database(),
    email(),
    google(),
    observability(),
    propertyData(),
  ],
  server: {
    CRON_SECRET: z.string().min(1),
    // Bearer token Paperclip agents present to authenticate against
    // /agents/* routes. Prefer BELLWOOD_API_KEY going forward; the legacy
    // PAPERCLIP_API_KEY name is kept for backwards compatibility with the
    // existing Vercel env config (see docs/PAPERCLIP-SYNC-BRIEF.md §6).
    // Agents auto-receive a Paperclip JWT in their own PAPERCLIP_API_KEY
    // env, so the new BELLWOOD_API_KEY name avoids that collision.
    BELLWOOD_API_KEY: z.string().min(1).optional(),
    PAPERCLIP_API_KEY: z.string().min(1).optional(),
    /**
     * Companies House STREAMING API key (stream.companieshouse.gov.uk) —
     * a separate registration from COMPANIES_HOUSE_API_KEY (REST). Powers
     * /cron/ch-stream; when unset that cron no-ops and the daily REST poll
     * remains the only charge/insolvency coverage.
     */
    CH_STREAM_KEY: z.string().min(1).optional(),
    /** Comma-separated UK postcodes the prospecting cron should scan. */
    AGENT_PROSPECTING_POSTCODES: z.string().optional(),
    /** Email to receive the weekly prospecting summary (defaults to RESEND_FROM). */
    AGENT_PROSPECTING_REPORT_EMAIL: z.string().email().optional(),
    /** Postmark inbound webhook — Basic Auth credentials (set on Postmark side). */
    POSTMARK_INBOUND_USER: z.string().min(1).optional(),
    POSTMARK_INBOUND_PASS: z.string().min(1).optional(),
    /** Comma-separated email addresses allowed to forward documents to docs@. */
    EMAIL_FORWARD_ALLOWLIST: z.string().optional(),
    /**
     * Signing secret of the Resend `email.received` webhook that feeds the
     * dashboard /inbox (see /webhooks/resend/inbound). Unset = route answers 503.
     */
    RESEND_INBOUND_WEBHOOK_SECRET: z.string().min(1).optional(),
    /**
     * Reddit "script" app credentials for /cron/guide-research. Reddit
     * blocks anonymous JSON, so without these the Reddit source is skipped
     * and the weekly brief says so. Register at reddit.com/prefs/apps.
     */
    REDDIT_CLIENT_ID: z.string().min(1).optional(),
    REDDIT_CLIENT_SECRET: z.string().min(1).optional(),
    REDDIT_USER_AGENT: z.string().min(1).optional(),
    /**
     * Meta (Facebook / Instagram) instant-form leads. See
     * docs/META-LEADS.md. Only three need setting:
     *   META_APP_ID              the Kept Meta app; lets the cron set up
     *                            the webhook itself
     *   META_APP_SECRET          signs every webhook post
     *   META_PAGE_ACCESS_TOKEN   reads the lead's answers (leads_retrieval)
     * Optional overrides: META_PAGE_ID (defaults to the Kept Page),
     * META_WEBHOOK_VERIFY_TOKEN (defaults to one derived from the secret),
     * META_GRAPH_VERSION (e.g. "v23.0").
     * Token unset = the webhook answers 503 and the sync cron no-ops.
     */
    META_APP_ID: z.string().regex(/^\d+$/).optional(),
    META_APP_SECRET: z.string().min(1).optional(),
    META_WEBHOOK_VERIFY_TOKEN: z.string().min(1).optional(),
    META_PAGE_ACCESS_TOKEN: z.string().min(1).optional(),
    META_PAGE_ID: z.string().regex(/^\d+$/).optional(),
    META_GRAPH_VERSION: z
      .string()
      .regex(/^v\d+\.\d+$/)
      .optional(),
  },
  client: {},
  runtimeEnv: {
    CRON_SECRET: cleanSecret(process.env.CRON_SECRET),
    BELLWOOD_API_KEY: cleanSecret(process.env.BELLWOOD_API_KEY),
    PAPERCLIP_API_KEY: cleanSecret(process.env.PAPERCLIP_API_KEY),
    CH_STREAM_KEY: process.env.CH_STREAM_KEY,
    AGENT_PROSPECTING_POSTCODES: process.env.AGENT_PROSPECTING_POSTCODES,
    AGENT_PROSPECTING_REPORT_EMAIL: process.env.AGENT_PROSPECTING_REPORT_EMAIL,
    POSTMARK_INBOUND_USER: process.env.POSTMARK_INBOUND_USER,
    POSTMARK_INBOUND_PASS: process.env.POSTMARK_INBOUND_PASS,
    EMAIL_FORWARD_ALLOWLIST: process.env.EMAIL_FORWARD_ALLOWLIST,
    RESEND_INBOUND_WEBHOOK_SECRET: process.env.RESEND_INBOUND_WEBHOOK_SECRET,
    REDDIT_CLIENT_ID: process.env.REDDIT_CLIENT_ID,
    REDDIT_CLIENT_SECRET: process.env.REDDIT_CLIENT_SECRET,
    REDDIT_USER_AGENT: process.env.REDDIT_USER_AGENT,
    META_APP_ID: cleanSecret(process.env.META_APP_ID),
    META_APP_SECRET: cleanSecret(process.env.META_APP_SECRET),
    META_WEBHOOK_VERIFY_TOKEN: cleanSecret(
      process.env.META_WEBHOOK_VERIFY_TOKEN
    ),
    META_PAGE_ACCESS_TOKEN: cleanSecret(process.env.META_PAGE_ACCESS_TOKEN),
    META_PAGE_ID: cleanSecret(process.env.META_PAGE_ID),
    META_GRAPH_VERSION: cleanSecret(process.env.META_GRAPH_VERSION),
  },
});
