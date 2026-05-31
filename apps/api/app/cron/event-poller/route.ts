import { env } from '@/env';
import { callClaudeForJson, CLAUDE_HAIKU } from '@repo/ai/claude';
import { database } from '@repo/database';
import { NextResponse } from 'next/server';

/**
 * Event poller cron — runs every 30 minutes.
 *
 * Idempotent by design (Vercel can retry; we MUST NOT duplicate). Every
 * FounderAction this cron creates carries a `dedupKey` so an upsert-style
 * check skips work already done.
 *
 * Two scans per run, both bounded to the last 30 minutes:
 *
 *   1. New held outreach where the recipient is a vendor (`individual`).
 *      We treat these as inbound triage candidates — draft a triage reply
 *      with Haiku and create one `approve_outreach_draft` FounderAction
 *      (priority high, agent liaison).
 *
 *   2. Fresh `Deal` transitions to `offer_made` in the last 30 minutes that
 *      don't yet have an `approve_ig_post` action. Catches anything the
 *      daily marketer cron missed (founder may have triggered an offer mid-
 *      day). We create the draft via the same path the daily cron uses.
 *
 * NEVER auto-sends. All output is held for founder review.
 */

const WINDOW_MS = 30 * 60 * 1000;

const VENDOR_TRIAGE_SYSTEM_PROMPT = `You triage held vendor outreach for Bellwood Ventures, a UK direct-to-vendor property buyer.

You will receive ONE held outreach record (subject + body + recipient context). Your job: classify what the founder needs to know in 30 seconds, then draft the suggested reply.

Voice:
- Empathetic, plain, slightly formal. UK spelling. No emoji.
- Short paragraphs. No marketing fluff. No urgency or countdown language.
- Never claim "we will buy any house" — Bellwood is selective.

Return ONLY JSON (no markdown fences, no preamble):

{
  "intent": "interested" | "needs_info" | "not_interested" | "complaint" | "unclear",
  "summary": string,                       // ≤ 25 words, what this vendor wants right now
  "urgency": "high" | "medium" | "low",
  "suggestedReply": {
    "subject": string,                     // ≤ 60 chars
    "bodyPlainText": string                // 2-3 short paragraphs, ≤ 140 words total. Sign off as "Sam — Bellwood Ventures".
  },
  "complianceFlags": string[]              // ICO / CPR / anonymisation concerns. Empty array if clean.
}`;

interface VendorTriage {
  intent: 'interested' | 'needs_info' | 'not_interested' | 'complaint' | 'unclear';
  summary: string;
  urgency: 'high' | 'medium' | 'low';
  suggestedReply: { subject: string; bodyPlainText: string };
  complianceFlags: string[];
}

// Mirrored from cron/marketer-daily — kept in-file to avoid a shared util just
// for two callers.
const IG_SYSTEM_PROMPT = `You write Instagram captions for Bellwood Ventures, a UK direct-to-vendor property buyer.

Voice: short, dry, UK property professional. Plain English. ≤ 150 words.

ANONYMISATION (marketing plan §11, non-negotiable):
- Postcode AREA only (e.g. "M14"). NEVER full postcode, NEVER street, NEVER house number.
- NEVER vendor name, executor name, solicitor name.
- NEVER distinguishing exterior features.

NEVER use: "AI", "we buy any house", urgency language, stock-photo platitudes.

Return ONLY JSON (no markdown fences):

{
  "caption": string,                       // ≤ 150 words, ends with a CTA
  "hashtags": string[],                    // 4-8, lowercase, UK property + segment
  "altText": string,                       // ≤ 200 chars, generic stock-image description
  "anonymisationCheck": {
    "postcodeAreaOnly": boolean,
    "noStreetNumbers": boolean,
    "noVendorName": boolean
  },
  "complianceFlags": string[]
}`;

interface IgDraft {
  caption: string;
  hashtags: string[];
  altText: string;
  anonymisationCheck: {
    postcodeAreaOnly: boolean;
    noStreetNumbers: boolean;
    noVendorName: boolean;
  };
  complianceFlags: string[];
}

function postcodeArea(full: string): string {
  const trimmed = full.trim().toUpperCase();
  const match = trimmed.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)/);
  return match?.[1] ?? trimmed.split(' ')[0] ?? trimmed;
}

export const POST = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const runDate = new Date();
  const windowStart = new Date(runDate.getTime() - WINDOW_MS);

  const triageResult = await pollVendorHolds(windowStart);
  const igResult = await pollFreshOffers(windowStart);

  await database.agentEvent
    .create({
      data: {
        agent: 'liaison',
        eventType: 'event_poller_run',
        summary: `Event poller: ${triageResult.created} vendor triages + ${igResult.created} catch-up IG drafts`,
        count: triageResult.created + igResult.created,
        payload: {
          triage: triageResult,
          igCatchUp: igResult,
          windowStart: windowStart.toISOString(),
        },
      },
    })
    .catch((err) => {
      console.warn('[event-poller] event log failed', err);
    });

  return NextResponse.json({
    success: true,
    runDate: runDate.toISOString(),
    windowStart: windowStart.toISOString(),
    triage: triageResult,
    igCatchUp: igResult,
  });
};

// ────────────────────────────────────────────────────────────────────────────
// Scan 1 — Held vendor outreach awaiting triage
// ────────────────────────────────────────────────────────────────────────────

async function pollVendorHolds(windowStart: Date): Promise<{
  scanned: number;
  created: number;
  skippedDuplicate: number;
  fallback: number;
}> {
  const holds = await database.outreachHold.findMany({
    where: {
      createdAt: { gte: windowStart },
      recipientType: 'individual',
      status: 'held',
    },
    orderBy: { createdAt: 'asc' },
  });

  let created = 0;
  let skippedDuplicate = 0;
  let fallback = 0;

  for (const hold of holds) {
    const dedupKey = `outreachHold:${hold.id}:reply`;
    const existing = await database.founderAction
      .findFirst({ where: { dedupKey } })
      .catch(() => null);
    if (existing) {
      skippedDuplicate++;
      continue;
    }

    const userPrompt = [
      `Recipient: ${hold.recipientName ?? '(unknown vendor)'}`,
      hold.recipientEmail ? `Email: ${hold.recipientEmail}` : null,
      '',
      `Held subject: ${hold.renderedSubject}`,
      '',
      'Held body:',
      hold.renderedBody.slice(0, 4000),
      '',
      'Triage + draft reply per system rules. JSON only.',
    ]
      .filter(Boolean)
      .join('\n');

    const triage = await callClaudeForJson<VendorTriage>({
      system: VENDOR_TRIAGE_SYSTEM_PROMPT,
      user: userPrompt,
      maxTokens: 700,
      temperature: 0.3,
      model: CLAUDE_HAIKU,
      feature: 'vendor_reply_triage',
      cacheSystemPrompt: true,
    }).catch((err) => {
      console.warn(`[event-poller] LLM triage failed for hold ${hold.id}`, err);
      return null;
    });

    if (!triage?.suggestedReply?.bodyPlainText) {
      // Fallback action so it still hits the founder's inbox.
      await database.founderAction
        .create({
          data: {
            type: 'general',
            priority: 'low',
            status: 'pending',
            agent: 'liaison',
            dedupKey,
            title: `Vendor outreach awaiting manual triage: ${hold.renderedSubject.slice(0, 60)}`,
            description: [
              'Claude was unavailable for triage on this held outreach. Read + draft a reply manually.',
              '',
              `Recipient: ${hold.recipientName ?? '(unknown)'} (${hold.recipientEmail ?? '?'})`,
              `Subject: ${hold.renderedSubject}`,
            ].join('\n'),
            metadata: JSON.parse(
              JSON.stringify({
                workflow: 'vendor_triage_fallback',
                outreachHoldId: hold.id,
                recipientName: hold.recipientName,
                recipientEmail: hold.recipientEmail,
                heldSubject: hold.renderedSubject,
              }),
            ),
          },
        })
        .catch((err) => {
          console.warn('[event-poller] vendor triage fallback failed', err);
        });
      fallback++;
      continue;
    }

    try {
      await database.founderAction.create({
        data: {
          type: 'approve_outreach_draft',
          priority: 'high',
          status: 'pending',
          agent: 'liaison',
          dedupKey,
          title: `Vendor triage: ${triage.intent} · ${hold.recipientName ?? hold.recipientEmail ?? 'vendor'}`,
          description: [
            triage.summary,
            '',
            `**Intent:** ${triage.intent} · **Urgency:** ${triage.urgency}`,
            '',
            `**Suggested reply — "${triage.suggestedReply.subject}"**`,
            '',
            triage.suggestedReply.bodyPlainText,
            triage.complianceFlags?.length
              ? `\n**Compliance flags:** ${triage.complianceFlags.join('; ')}`
              : '',
          ].join('\n'),
          metadata: JSON.parse(
            JSON.stringify({
              workflow: 'approve_then_send',
              channel: 'email',
              outreachHoldId: hold.id,
              recipientName: hold.recipientName,
              recipientEmail: hold.recipientEmail,
              heldSubject: hold.renderedSubject,
              triage,
              link: '/outreach/holds',
            }),
          ),
        },
      });
      created++;
    } catch (err) {
      console.warn('[event-poller] vendor triage action create failed', err);
    }
  }

  return { scanned: holds.length, created, skippedDuplicate, fallback };
}

// ────────────────────────────────────────────────────────────────────────────
// Scan 2 — Fresh offer_made transitions without an IG post yet
// ────────────────────────────────────────────────────────────────────────────

async function pollFreshOffers(windowStart: Date): Promise<{
  scanned: number;
  created: number;
  skippedDuplicate: number;
  fallback: number;
}> {
  const offers = await database.deal.findMany({
    where: {
      status: 'offer_made',
      stageEnteredAt: { gte: windowStart },
    },
    orderBy: { stageEnteredAt: 'asc' },
  });

  let created = 0;
  let skippedDuplicate = 0;
  let fallback = 0;

  for (const deal of offers) {
    const dedupKey = `deal:${deal.id}:ig_post`;
    const existing = await database.founderAction
      .findFirst({ where: { dedupKey } })
      .catch(() => null);
    if (existing) {
      skippedDuplicate++;
      continue;
    }

    // Belt-and-braces — also check the daily-cron path that doesn't set
    // dedupKey. If an `approve_ig_post` already exists for this dealId via
    // metadata, skip silently.
    const sameDealExisting = await database.founderAction
      .findFirst({
        where: {
          type: 'approve_ig_post',
          dealId: deal.id,
        },
      })
      .catch(() => null);
    if (sameDealExisting) {
      skippedDuplicate++;
      continue;
    }

    const userPrompt = [
      `Pipeline event: offer_made (catch-up draft, daily cron may not have run yet)`,
      `Postcode area: ${postcodeArea(deal.postcode)}`,
      `Property type: ${deal.propertyType}`,
      deal.bedrooms ? `Bedrooms: ${deal.bedrooms}` : null,
      `Seller segment: ${deal.sellerType}`,
      '',
      'Draft an IG post about us making an offer in this segment. JSON only.',
    ]
      .filter(Boolean)
      .join('\n');

    const draft = await callClaudeForJson<IgDraft>({
      system: IG_SYSTEM_PROMPT,
      user: userPrompt,
      maxTokens: 700,
      temperature: 0.5,
      model: CLAUDE_HAIKU,
      feature: 'ig_post_draft_catchup',
      cacheSystemPrompt: true,
    }).catch((err) => {
      console.warn(`[event-poller] LLM IG catch-up failed for ${deal.id}`, err);
      return null;
    });

    if (!draft?.caption) {
      await database.founderAction
        .create({
          data: {
            type: 'general',
            priority: 'low',
            status: 'pending',
            agent: 'marketer',
            dedupKey,
            dealId: deal.id,
            title: `Offer in ${postcodeArea(deal.postcode)} — IG post needs manual drafting`,
            description: 'Claude was unavailable for catch-up IG draft. Write manually.',
            metadata: JSON.parse(
              JSON.stringify({
                workflow: 'event_poller_ig_fallback',
                dealId: deal.id,
                postcodeArea: postcodeArea(deal.postcode),
                sellerType: deal.sellerType,
              }),
            ),
          },
        })
        .catch((err) => {
          console.warn('[event-poller] IG fallback failed', err);
        });
      fallback++;
      continue;
    }

    const anon = draft.anonymisationCheck;
    const verdict =
      anon.postcodeAreaOnly && anon.noStreetNumbers && anon.noVendorName
        ? 'PASS'
        : 'NEEDS REVIEW';

    try {
      await database.founderAction.create({
        data: {
          type: 'approve_ig_post',
          priority: 'medium',
          status: 'pending',
          agent: 'marketer',
          dedupKey,
          dealId: deal.id,
          title: `Approve IG post (catch-up): offer in ${postcodeArea(deal.postcode)} (${deal.sellerType})`,
          description: [
            `${draft.caption.slice(0, 200)}${draft.caption.length > 200 ? '…' : ''}`,
            '',
            `**Anonymisation check:** ${verdict}`,
          ].join('\n'),
          metadata: JSON.parse(
            JSON.stringify({
              dealId: deal.id,
              dealAddress: deal.address,
              caption: draft.caption,
              hashtags: draft.hashtags,
              altText: draft.altText,
              channel: 'instagram',
              postcodeArea: postcodeArea(deal.postcode),
              sellerType: deal.sellerType,
              anonymisationCheck: draft.anonymisationCheck,
              complianceFlags: draft.complianceFlags ?? [],
              source: 'event_poller_catchup',
            }),
          ),
        },
      });
      created++;
    } catch (err) {
      console.warn('[event-poller] IG action create failed', err);
    }
  }

  return { scanned: offers.length, created, skippedDuplicate, fallback };
}
