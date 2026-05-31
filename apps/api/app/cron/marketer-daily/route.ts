import { env } from '@/env';
import { callClaudeForJson, CLAUDE_HAIKU } from '@repo/ai/claude';
import { database } from '@repo/database';
import { NextResponse } from 'next/server';

/**
 * Daily marketer cron (07:45 UTC).
 *
 * Picks up yesterday's pipeline movements and drafts social posts for each:
 *
 *   - Deals that entered `offer_made` yesterday    → IG post draft
 *   - Deals that hit `completed` yesterday         → IG post draft
 *                                                  + case-study placeholder
 *                                                    gated to acquiredAt + 30d
 *
 * NEVER auto-publishes. Each draft becomes a `approve_ig_post` (or
 * `approve_case_study`) FounderAction that the founder reviews in /actions.
 *
 * All anonymisation rules from PLAN.md §11 are baked into the system prompt:
 *   - Postcode AREA only (e.g. "M14"), never the full postcode or street
 *   - No street numbers
 *   - No vendor names
 *   - For completions: the case-study cannot publish for 30 days post-completion
 */

const SYSTEM_PROMPT = `You write Instagram captions for Bellwood Ventures, a UK direct-to-vendor property buyer specialising in chain-break, probate, and problem properties.

Voice (marketing plan §2):
- Numbers and specifics over adjectives. Plain English. UK spelling.
- Professional, slightly dry. Closer to a chartered surveyor than a property influencer.
- Short sentences. ≤ 150 words for the caption.
- One concrete fact, one human note, one CTA. Nothing else.

ANONYMISATION — these rules from marketing plan §11 are NON-NEGOTIABLE:
- Use the postcode AREA only (e.g. "M14", "SK4"). NEVER the full postcode (no "M14 5AB"), NEVER the street, NEVER the house number.
- NEVER include the vendor's name, the executor's name, the solicitor's name, or any other personal identifier.
- NEVER describe distinguishing exterior features (the specific bay, the green door, the neighbour's hedge).
- For completed deals: the founder may STILL hold for 30 days even if your draft passes. That gate is the founder's; you just draft.

NEVER use:
- "AI", "machine learning", "algorithm", "powered by"
- "We buy any house" — Bellwood is selective; that's the brand
- "Get cash today!", countdown timers, urgency language
- Stock-photo platitudes about families/happiness

You will be given a structured profile of one deal. Return ONLY JSON (no markdown fences, no preamble):

{
  "caption": string,                       // ≤ 150 words, IG-friendly, ends with a CTA
  "hashtags": string[],                    // 4-8 hashtags, lowercase, UK property + segment relevant
  "altText": string,                       // ≤ 200 chars, describes the GENERIC stock image we'd pair with this (no addresses)
  "anonymisationCheck": {
    "postcodeAreaOnly": boolean,           // true iff the caption uses postcode AREA only
    "noStreetNumbers": boolean,            // true iff no house numbers appear in caption
    "noVendorName": boolean                // true iff no personal name appears in caption
  },
  "complianceFlags": string[]              // list any concerns you saw (CPR / ASA / ICO / anonymisation). Empty array if clean.
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

/** Extract postcode area (e.g. "M14" from "M14 5AB"). */
function postcodeArea(full: string): string {
  const trimmed = full.trim().toUpperCase();
  const match = trimmed.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)/);
  return match?.[1] ?? trimmed.split(' ')[0] ?? trimmed;
}

function buildUserPrompt(
  deal: {
    postcode: string;
    propertyType: string;
    bedrooms: number | null;
    sellerType: string;
  },
  context: 'offer_made' | 'completed',
): string {
  const lines: string[] = [
    `Pipeline event: ${context}`,
    `Postcode area: ${postcodeArea(deal.postcode)}`,
    `Property type: ${deal.propertyType}`,
    deal.bedrooms ? `Bedrooms: ${deal.bedrooms}` : null,
    `Seller segment: ${deal.sellerType}`,
    '',
    context === 'offer_made'
      ? 'Draft an IG post about us making an offer yesterday on this segment of property. Frame as "this is what we do" — not a celebration of the deal itself (we have not completed yet).'
      : 'Draft an IG post about completing a purchase yesterday in this segment. Generic stock photo, no exterior details. The case-study version will be drafted separately and gated 30 days.',
    '',
    'JSON only.',
  ].filter(Boolean) as string[];
  return lines.join('\n');
}

export const POST = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const runDate = new Date();
  const todayStart = new Date(runDate);
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  // Pull yesterday's pipeline movements.
  const [offers, completions] = await Promise.all([
    database.deal.findMany({
      where: {
        status: 'offer_made',
        stageEnteredAt: { gte: yesterdayStart, lt: todayStart },
      },
      orderBy: { stageEnteredAt: 'asc' },
    }),
    database.deal.findMany({
      where: {
        status: 'completed',
        acquiredAt: { gte: yesterdayStart, lt: todayStart },
      },
      orderBy: { acquiredAt: 'asc' },
    }),
  ]);

  let draftedOffers = 0;
  let draftedCompletions = 0;
  let errorCount = 0;
  const fallbackTitles: string[] = [];

  // ── Offers → 1× approve_ig_post each ─────────────────────────────────
  for (const deal of offers) {
    const draft = await callClaudeForJson<IgDraft>({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(deal, 'offer_made'),
      maxTokens: 700,
      temperature: 0.5,
      model: CLAUDE_HAIKU,
      feature: 'ig_post_draft',
      cacheSystemPrompt: true,
    }).catch((err) => {
      console.warn('[marketer-daily] LLM draft failed for offer', deal.id, err);
      return null;
    });

    if (!draft || !draft.caption) {
      fallbackTitles.push(`Offer on ${deal.address} (${deal.postcode}) — IG post needs manual drafting`);
      errorCount++;
      continue;
    }

    const created = await persistIgAction({
      deal,
      draft,
      context: 'offer_made',
    });
    if (created) draftedOffers++;
    else errorCount++;
  }

  // ── Completions → 1× approve_ig_post + 1× approve_case_study ─────────
  for (const deal of completions) {
    const draft = await callClaudeForJson<IgDraft>({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(deal, 'completed'),
      maxTokens: 700,
      temperature: 0.5,
      model: CLAUDE_HAIKU,
      feature: 'ig_post_draft',
      cacheSystemPrompt: true,
    }).catch((err) => {
      console.warn('[marketer-daily] LLM draft failed for completion', deal.id, err);
      return null;
    });

    if (!draft || !draft.caption) {
      fallbackTitles.push(
        `Completion of ${deal.address} (${deal.postcode}) — IG post + case study need manual drafting`,
      );
      errorCount++;
      continue;
    }

    const ig = await persistIgAction({ deal, draft, context: 'completed' });
    if (ig) draftedCompletions++;

    // Case study placeholder — gated to acquiredAt + 30 days per §11.
    const acquiredAt = deal.acquiredAt ?? deal.stageEnteredAt;
    const publishNotBefore = new Date(acquiredAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    await database.founderAction
      .create({
        data: {
          type: 'approve_case_study',
          priority: 'medium',
          status: 'pending',
          agent: 'marketer',
          dealId: deal.id,
          title: `Approve case study: ${deal.sellerType} completion (${postcodeArea(deal.postcode)})`,
          description: [
            `Draft case-study placeholder for the completion of ${deal.propertyType} in ${postcodeArea(deal.postcode)}.`,
            '',
            `**Publish-not-before:** ${publishNotBefore.toISOString().slice(0, 10)} (acquiredAt + 30 days, per §11).`,
            '',
            `Use the IG-post draft as the starter — expand to 400-600 words once enough anonymised detail is collectable.`,
          ].join('\n'),
          metadata: JSON.parse(
            JSON.stringify({
              dealId: deal.id,
              dealAddress: deal.address,
              channel: 'case_study',
              postcodeArea: postcodeArea(deal.postcode),
              sellerType: deal.sellerType,
              publishNotBefore: publishNotBefore.toISOString(),
              starterCaption: draft.caption,
              starterHashtags: draft.hashtags,
            }),
          ),
        },
      })
      .catch((err) => {
        console.warn('[marketer-daily] case study create failed', err);
        errorCount++;
      });
  }

  // ── Fallback FounderAction if Claude failed entirely ─────────────────
  if (fallbackTitles.length > 0) {
    await database.founderAction
      .create({
        data: {
          type: 'general',
          priority: 'low',
          status: 'pending',
          agent: 'marketer',
          title: `Marketer daily: ${fallbackTitles.length} draft${fallbackTitles.length === 1 ? '' : 's'} need manual writing`,
          description: [
            'Claude was unavailable (or returned no parseable JSON) for the following pipeline movements. Draft the posts manually using the marketing plan §2 voice + §11 anonymisation rules:',
            '',
            ...fallbackTitles.map((t) => `- ${t}`),
          ].join('\n'),
          metadata: JSON.parse(
            JSON.stringify({
              workflow: 'marketer_daily_fallback',
              runDate: runDate.toISOString(),
              fallbackTitles,
            }),
          ),
        },
      })
      .catch((err) => {
        console.warn('[marketer-daily] fallback action create failed', err);
      });
  }

  // Log the run as an AgentEvent so the morning briefing can pick it up.
  await database.agentEvent
    .create({
      data: {
        agent: 'marketer',
        eventType: 'marketer_daily',
        summary: `Marketer daily: ${draftedOffers} offer IG + ${draftedCompletions} completion IG (${errorCount} errors)`,
        count: draftedOffers + draftedCompletions,
        payload: {
          draftedOffers,
          draftedCompletions,
          errorCount,
          offersScanned: offers.length,
          completionsScanned: completions.length,
        },
      },
    })
    .catch((err) => {
      console.warn('[marketer-daily] event log failed', err);
    });

  return NextResponse.json({
    success: true,
    runDate: runDate.toISOString(),
    draftedOffers,
    draftedCompletions,
    errorCount,
  });
};

async function persistIgAction({
  deal,
  draft,
  context,
}: {
  deal: {
    id: string;
    address: string;
    postcode: string;
    sellerType: string;
    acquiredAt: Date | null;
    stageEnteredAt: Date;
  };
  draft: IgDraft;
  context: 'offer_made' | 'completed';
}): Promise<boolean> {
  const area = postcodeArea(deal.postcode);
  const anon = draft.anonymisationCheck;
  const verdict =
    anon.postcodeAreaOnly && anon.noStreetNumbers && anon.noVendorName
      ? 'PASS'
      : 'NEEDS REVIEW';
  const flagsSummary =
    draft.complianceFlags?.length > 0
      ? ` · flags: ${draft.complianceFlags.join('; ')}`
      : '';

  // Completions: still hold the IG post for 30 days too — Sam wants explicit
  // consent before any identifiable post, even if the LLM swears it's anon.
  const publishNotBefore =
    context === 'completed'
      ? new Date(
          (deal.acquiredAt ?? deal.stageEnteredAt).getTime() +
            30 * 24 * 60 * 60 * 1000,
        ).toISOString()
      : undefined;

  try {
    await database.founderAction.create({
      data: {
        type: 'approve_ig_post',
        priority: 'medium',
        status: 'pending',
        agent: 'marketer',
        dealId: deal.id,
        title: `Approve IG post: ${context} in ${area} (${deal.sellerType})`,
        description: [
          `${draft.caption.slice(0, 200)}${draft.caption.length > 200 ? '…' : ''}`,
          '',
          `**Anonymisation check:** ${verdict}${flagsSummary}`,
        ].join('\n'),
        metadata: JSON.parse(
          JSON.stringify({
            dealId: deal.id,
            dealAddress: deal.address,
            caption: draft.caption,
            hashtags: draft.hashtags,
            altText: draft.altText,
            channel: 'instagram',
            postcodeArea: area,
            sellerType: deal.sellerType,
            anonymisationCheck: draft.anonymisationCheck,
            complianceFlags: draft.complianceFlags ?? [],
            ...(publishNotBefore ? { publishNotBefore } : {}),
          }),
        ),
      },
    });
    return true;
  } catch (err) {
    console.warn('[marketer-daily] IG action create failed', err);
    return false;
  }
}
