import { env } from '@/env';
import { database } from '@repo/database';
import { runDeepAppraisal } from '@repo/valuation';
import { runPreflightChecks } from '@repo/property-data';
import { renderSignedOfferPdf } from '@repo/quote-ops';
import { NextResponse } from 'next/server';

/**
 * /cron/quote-ops — runs every 30 min on Vercel Pro (minimum cadence).
 *
 * Two phases per pass:
 *
 *   1. Enrich + re-AVM + PDF draft for fresh `agent_quick_form` QuoteRequests
 *      in the last 24h. For each candidate that has no prior
 *      `quote_ops:enrich:<id>` FounderAction we run preflight checks,
 *      deep-appraisal, render the signed binding PDF to Vercel Blob, and
 *      file an `approve_offer` FounderAction with the URL in metadata + a
 *      4-hour expiry.
 *
 *   2. Breach watch for any `approve_offer` action whose `expiresAt`
 *      already passed. We create a `sla_breach` action so the founder sees
 *      it on `/today` and `/actions`.
 *
 * Idempotent: every action carries a dedupKey so Vercel retries can fire
 * the same window without duplicating work.
 */

export const maxDuration = 300;

const MAX_PER_RUN = 5;
const WINDOW_HOURS = 24;
const SLA_HOURS = 4;

async function handle(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date();
  const since = new Date(Date.now() - WINDOW_HOURS * 3600_000);

  // ── Phase 1 — enrich + re-AVM + PDF draft ────────────────────
  const candidates = await database.quoteRequest.findMany({
    where: {
      source: 'agent_quick_form',
      createdAt: { gte: since },
    },
    include: { offer: true },
    orderBy: { createdAt: 'asc' },
    take: MAX_PER_RUN,
  });

  let enriched = 0;
  let skippedDedup = 0;
  let failed = 0;
  const sample: Array<{ quoteId: string; address: string; verdict: string }> = [];

  for (const q of candidates) {
    const dedupKey = `quote_ops:enrich:${q.id}`;
    const existing = await database.founderAction.findUnique({
      where: { dedupKey },
      select: { id: true },
    });
    if (existing) {
      skippedDedup++;
      continue;
    }

    try {
      // Reuse existing wrappers. PreflightChecks takes a single object.
      const enrichment = await runPreflightChecks({
        postcode: q.postcode,
        address: q.address,
      }).catch(() => null);

      const appraisal = await runDeepAppraisal({
        address: q.address,
        postcode: q.postcode,
        propertyTypeHint: q.propertyType ?? undefined,
        bedroomsHint: q.bedrooms ?? undefined,
        isAuction: false,
        sellerType: mapSellerSituation(q.sellerSituation),
      });

      if (!appraisal) {
        failed++;
        continue;
      }

      // The price on a binding document is the offer we actually made, never
      // the appraisal's ARV. Non-auction leads have bidCap = null by design, so
      // there is no offer figure in the appraisal at all: for those the deep
      // appraisal re-checks market value and condition, it does not re-price.
      const offerPence = appraisal.bidCap?.hardCapPence ?? q.offer?.offerPence;
      if (!offerPence || offerPence <= 0) {
        console.warn(
          `[cron/quote-ops] no offer figure for quote ${q.id} — skipping rather than issuing a binding document without a price`
        );
        failed++;
        continue;
      }

      const pdfUrl = await renderSignedOfferPdf({
        quoteId: q.id,
        address: q.address,
        postcode: q.postcode,
        agentFirmName: q.firmName,
        agentContactName: q.contactName,
        offerPence,
        appraisal,
        enrichment,
      });

      // Numbers for the FounderAction body. Drift compares the re-appraised
      // MARKET VALUE against the market value the original offer was built on
      // — comparing an offer to an ARV would show a permanent ~20% "drift".
      const newOfferPence = offerPence;
      const indicativePence = q.offer?.offerPence ?? offerPence;
      const drift =
        indicativePence > 0
          ? Math.abs(newOfferPence - indicativePence) / indicativePence
          : 0;

      const expiresAt = new Date(Date.now() + SLA_HOURS * 3600_000);
      await database.founderAction.create({
        data: {
          type: 'approve_offer',
          priority: drift > 0.05 ? 'critical' : 'high',
          status: 'pending',
          agent: 'appraiser',
          dedupKey,
          title: `Approve signed offer: ${q.address.slice(0, 60)}`,
          description: [
            `Agent: ${q.contactName ?? q.firmName ?? 'unknown'}`,
            `Offer on the document: £${(newOfferPence / 100).toLocaleString('en-GB')}`,
            `Indicative offer given earlier: £${(indicativePence / 100).toLocaleString('en-GB')} (${(drift * 100).toFixed(1)}% drift)`,
            `Re-appraised market value (ARV): £${(appraisal.arv.pointEstimatePence / 100).toLocaleString('en-GB')}`,
            `Verdict: ${appraisal.recommendation.verdict.toUpperCase()}`,
            `Confidence: ${appraisal.confidence.level}`,
          ].join('\n'),
          expiresAt,
          metadata: JSON.parse(
            JSON.stringify({
              quoteRequestId: q.id,
              signedOfferUrl: pdfUrl,
              appraisal,
              enrichment,
              indicativePence,
              newOfferPence,
              drift,
              link: `/quotes/${q.id}`,
              workflow: 'approve_then_send_email',
            }),
          ),
        },
      });

      enriched++;
      sample.push({
        quoteId: q.id,
        address: q.address.slice(0, 40),
        verdict: appraisal.recommendation.verdict,
      });
    } catch (err) {
      console.warn(`[quote-ops] enrich failed for ${q.id}`, err);
      failed++;
    }
  }

  // ── Phase 2 — breach watch ──────────────────────────────────
  const overdue = await database.founderAction.findMany({
    where: {
      type: 'approve_offer',
      status: 'pending',
      expiresAt: { lt: startedAt },
    },
    take: 20,
  });

  let breachesLogged = 0;
  for (const action of overdue) {
    const dedupKey = `quote_ops:breach:${action.id}`;
    const existing = await database.founderAction.findUnique({
      where: { dedupKey },
      select: { id: true },
    });
    if (existing) continue;

    const meta = (action.metadata ?? {}) as Record<string, unknown>;
    const link =
      typeof meta.link === 'string' ? (meta.link as string) : '/actions';

    await database.founderAction.create({
      data: {
        type: 'sla_breach',
        priority: 'critical',
        status: 'pending',
        agent: 'system',
        dedupKey,
        title: `SLA BREACH: signed offer overdue · ${action.title
          .replace(/^Approve signed offer:\s*/, '')
          .slice(0, 50)}`,
        description: [
          `The 4-hour signed-offer SLA expired ${formatRelativeMins(action.expiresAt!, startedAt)}.`,
          ``,
          `Action: ${action.id}`,
          `Apologise to the agent and send the signed PDF urgently.`,
        ].join('\n'),
        metadata: JSON.parse(
          JSON.stringify({
            breachedActionId: action.id,
            expiresAt: action.expiresAt,
            originalMetadata: action.metadata,
            link,
          }),
        ),
      },
    });
    breachesLogged++;
  }

  // Telemetry
  await database.agentEvent
    .create({
      data: {
        agent: 'appraiser',
        eventType: 'quote_ops_run',
        summary: `Quote-ops: ${enriched} enriched, ${skippedDedup} dedup, ${failed} failed, ${breachesLogged} breaches`,
        count: enriched + breachesLogged,
        payload: {
          candidates: candidates.length,
          enriched,
          skippedDedup,
          failed,
          breachesLogged,
        },
      },
    })
    .catch((err: unknown) =>
      console.warn('[quote-ops] event log failed', err),
    );

  return NextResponse.json({
    success: true,
    runDate: startedAt.toISOString(),
    enriched,
    skippedDedup,
    failed,
    breachesLogged,
    sample,
  });
}

function mapSellerSituation(
  s: string | null | undefined,
): 'probate' | 'chain_break' | 'short_lease' | 'repossession' | 'standard' {
  switch ((s ?? '').toLowerCase()) {
    case 'probate':
      return 'probate';
    case 'chain_break':
      return 'chain_break';
    case 'short_lease':
      return 'short_lease';
    case 'repossession':
      return 'repossession';
    default:
      return 'standard';
  }
}

function formatRelativeMins(expiredAt: Date, now: Date): string {
  const mins = Math.floor((now.getTime() - expiredAt.getTime()) / 60_000);
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

export const POST = handle;
export const GET = handle;
