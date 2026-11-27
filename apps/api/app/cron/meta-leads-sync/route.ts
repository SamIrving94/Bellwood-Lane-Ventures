import { env } from '@/env';
import { database } from '@repo/database';
import { NextResponse } from 'next/server';
import {
  KEPT_PAGE_ID,
  type MetaLead,
  type MetaSetupResult,
  deriveVerifyToken,
  ensureMetaSubscriptions,
  ingestMetaLead,
  listRecentMetaLeads,
  resolvePageToken,
} from '../_lib/meta-leads';
import { selfOrigin } from '../_lib/self-origin';

/**
 * /cron/meta-leads-sync — every 30 minutes.
 *
 * The safety net behind /webhooks/meta-leads. It reads every instant form
 * on the Kept Page and saves any lead from the last few days that is not
 * in Quotes yet. Leads already saved are skipped (same dedup key as the
 * webhook), so running it twice changes nothing.
 *
 * Why it exists: the first Meta leads went missing silently, because
 * nothing was listening. A webhook alone can fail the same quiet way (an
 * expired token, a subscription Meta switched off). This sweep turns that
 * into a founder action instead of a lead nobody calls.
 *
 * It also does the webhook setup itself (production only): it points the
 * Meta app's webhook at /webhooks/meta-leads and subscribes the Kept Page,
 * and repairs either if Meta drops it. That needs META_APP_ID and
 * META_APP_SECRET; without them the sweep still runs, just not instantly.
 *
 * No-ops until META_PAGE_ACCESS_TOKEN is set. The Page id defaults to the
 * Kept Page (KEPT_PAGE_ID).
 */

export const maxDuration = 300;

/** Meta keeps a lead for 90 days. A week covers any outage we would miss. */
const LOOKBACK_DAYS = 7;

async function handle(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pageId = env.META_PAGE_ID ?? KEPT_PAGE_ID;
  if (!env.META_PAGE_ACCESS_TOKEN) {
    return NextResponse.json({ skipped: true, reason: 'not configured' });
  }
  const pageAccessToken = await resolvePageToken(
    env.META_PAGE_ACCESS_TOKEN,
    pageId,
    env.META_GRAPH_VERSION
  );

  // Self-setup. Never fatal: if it fails, the sweep below still saves the
  // leads, a little later. Production only, so a preview deploy cannot
  // point Meta's webhook at itself.
  let setup: MetaSetupResult | { error: string } | 'skipped' = 'skipped';
  if (
    env.META_APP_ID &&
    env.META_APP_SECRET &&
    process.env.VERCEL_ENV === 'production'
  ) {
    try {
      setup = await ensureMetaSubscriptions({
        appId: env.META_APP_ID,
        appSecret: env.META_APP_SECRET,
        pageId,
        pageAccessToken,
        callbackUrl: `${selfOrigin()}/webhooks/meta-leads`,
        verifyToken:
          env.META_WEBHOOK_VERIFY_TOKEN ??
          deriveVerifyToken(env.META_APP_SECRET),
        graphVersion: env.META_GRAPH_VERSION,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[cron/meta-leads-sync] webhook setup failed', message);
      setup = { error: message };
    }
  }

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 3600_000);

  let leads: MetaLead[];
  try {
    leads = await listRecentMetaLeads(pageId, since, {
      pageAccessToken,
      graphVersion: env.META_GRAPH_VERSION,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[cron/meta-leads-sync] cannot read Meta', message);
    // Tell the founder once a day, not every half hour.
    const day = new Date().toISOString().slice(0, 10);
    await database.founderAction
      .upsert({
        where: { dedupKey: `meta_leads_sync_failed:${day}` },
        update: {},
        create: {
          type: 'general',
          priority: 'critical',
          status: 'pending',
          agent: 'system',
          dedupKey: `meta_leads_sync_failed:${day}`,
          title: 'Meta leads are not coming through',
          description: `Kept could not read the lead forms from Meta, so new Facebook and Instagram leads may be missing from Quotes. Check Leads Centre in Meta Business Suite by hand until this is fixed. The usual cause is an expired access token: see docs/META-LEADS.md.\n\nMeta said: ${message}`,
        },
      })
      .catch(() => undefined);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }

  let created = 0;
  let duplicate = 0;
  let failed = 0;
  for (const lead of leads) {
    try {
      const result = await ingestMetaLead(lead);
      if (result === 'created') created++;
      else duplicate++;
    } catch (error) {
      failed++;
      console.error(
        '[cron/meta-leads-sync] lead failed',
        lead.id,
        error instanceof Error ? error.message : error
      );
    }
  }

  return NextResponse.json({
    ok: true,
    setup,
    found: leads.length,
    created,
    duplicate,
    failed,
  });
}

export const POST = handle;
export const GET = handle;
