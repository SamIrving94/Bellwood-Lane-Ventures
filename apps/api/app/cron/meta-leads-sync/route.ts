import { env } from '@/env';
import { database } from '@repo/database';
import { NextResponse } from 'next/server';
import {
  type MetaLead,
  ingestMetaLead,
  listRecentMetaLeads,
} from '../_lib/meta-leads';

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
 * No-ops until META_PAGE_ACCESS_TOKEN and META_PAGE_ID are set.
 */

export const maxDuration = 300;

/** Meta keeps a lead for 90 days. A week covers any outage we would miss. */
const LOOKBACK_DAYS = 7;

async function handle(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pageAccessToken = env.META_PAGE_ACCESS_TOKEN;
  const pageId = env.META_PAGE_ID;
  if (!pageAccessToken || !pageId) {
    return NextResponse.json({ skipped: true, reason: 'not configured' });
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
    found: leads.length,
    created,
    duplicate,
    failed,
  });
}

export const POST = handle;
export const GET = handle;
