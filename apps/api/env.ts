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
    /**
     * Comma-separated founder addresses. Mail FROM these is ours: it is always
     * logged, and a PDF sent to the log alone is read into /documents.
     */
    EMAIL_FORWARD_ALLOWLIST: z.string().optional(),
    /**
     * Our inbound address(es) for the deal email log, comma-separated, e.g.
     * `log@in.wearekept.co.uk`. Optional: mail is recognised as ours by the
     * domain Postmark received it on. Set it when a vanity address forwards
     * to Postmark's own `…@inbound.postmarkapp.com` address, so the vanity
     * address is not mistaken for someone on the other side.
     */
    DEAL_LOG_ADDRESS: z.string().optional(),
    /**
     * `on` when Google Workspace copies the founders' mailbox to the log
     * address. The webhook then keeps a copy only when it is deal mail and
     * ignores the rest. Leave unset otherwise: with it on, a BCC that matches
     * no deal is ignored instead of waiting to be filed. Set
     * DEAL_LOG_ADDRESS too, so a deliberate CC is always recognised.
     */
    DEAL_LOG_AUTO_COPY: z.enum(['on', 'off']).optional(),
    /**
     * Reddit "script" app credentials for /cron/guide-research. Reddit
     * blocks anonymous JSON, so without these the Reddit source is skipped
     * and the weekly brief says so. Register at reddit.com/prefs/apps.
     */
    REDDIT_CLIENT_ID: z.string().min(1).optional(),
    REDDIT_CLIENT_SECRET: z.string().min(1).optional(),
    REDDIT_USER_AGENT: z.string().min(1).optional(),
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
    DEAL_LOG_ADDRESS: process.env.DEAL_LOG_ADDRESS,
    DEAL_LOG_AUTO_COPY: process.env.DEAL_LOG_AUTO_COPY,
    REDDIT_CLIENT_ID: process.env.REDDIT_CLIENT_ID,
    REDDIT_CLIENT_SECRET: process.env.REDDIT_CLIENT_SECRET,
    REDDIT_USER_AGENT: process.env.REDDIT_USER_AGENT,
  },
});
