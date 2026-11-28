import { env } from '@/env';
import { log } from '@repo/observability/log';
import { NextResponse, after } from 'next/server';
import {
  KEPT_PAGE_ID,
  deriveVerifyToken,
  extractLeadgenIds,
  fetchMetaLead,
  ingestMetaLead,
  resolvePageToken,
  verifyMetaSignature,
} from '../../cron/_lib/meta-leads';

/**
 * Meta lead-form webhook.
 *
 * Meta posts here the moment someone sends an instant form on Facebook or
 * Instagram. The post carries only a lead id, so we then read the answers
 * from the Graph API and save the lead to Quotes (see _lib/meta-leads.ts).
 *
 * Setup lives in docs/META-LEADS.md. Until META_APP_SECRET and
 * META_PAGE_ACCESS_TOKEN are set this route answers 503 and does nothing.
 * The sync cron points Meta's webhook here by itself
 * (ensureMetaSubscriptions), so nobody has to type this URL into Meta.
 */

export const maxDuration = 60;

/** One-off handshake: Meta calls this when the webhook is first added. */
export const GET = (request: Request): Response => {
  const params = new URL(request.url).searchParams;
  const verifyToken =
    env.META_WEBHOOK_VERIFY_TOKEN ??
    (env.META_APP_SECRET ? deriveVerifyToken(env.META_APP_SECRET) : undefined);
  if (
    verifyToken &&
    params.get('hub.mode') === 'subscribe' &&
    params.get('hub.verify_token') === verifyToken
  ) {
    return new Response(params.get('hub.challenge') ?? '', { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
};

export const POST = async (request: Request): Promise<Response> => {
  const appSecret = env.META_APP_SECRET;
  const givenToken = env.META_PAGE_ACCESS_TOKEN;
  if (!appSecret || !givenToken) {
    // Fail closed: an unsigned lead is never accepted, in any environment.
    log.error('Meta leads webhook: not configured, refusing payload');
    return new Response('Meta leads not configured', { status: 503 });
  }

  const raw = await request.text();
  if (
    !verifyMetaSignature(
      raw,
      request.headers.get('x-hub-signature-256'),
      appSecret
    )
  ) {
    log.warn('Meta leads webhook: bad signature');
    return new Response('Invalid signature', { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response('Invalid payload', { status: 400 });
  }

  const leadIds = extractLeadgenIds(payload);

  // Answer straight away and do the work after. Meta wants a fast 200 and
  // switches a slow webhook off. A lead that fails here is not lost: the
  // half-hourly /cron/meta-leads-sync sweep picks it up.
  after(async () => {
    if (leadIds.length === 0) {
      return;
    }
    const pageAccessToken = await resolvePageToken(
      givenToken,
      env.META_PAGE_ID ?? KEPT_PAGE_ID,
      env.META_GRAPH_VERSION
    );
    for (const leadId of leadIds) {
      try {
        const lead = await fetchMetaLead(leadId, {
          pageAccessToken,
          graphVersion: env.META_GRAPH_VERSION,
        });
        const result = await ingestMetaLead(lead);
        log.info('Meta leads webhook: lead handled', { leadId, result });
      } catch (error) {
        // Ids only. Never a name, email or phone in the logs.
        log.error('Meta leads webhook: lead failed, sweep will retry', {
          leadId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });

  return NextResponse.json({ ok: true, received: leadIds.length });
};
