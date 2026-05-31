import { env } from '@/env';
import { callClaudeForJson, CLAUDE_HAIKU } from '@repo/ai/claude';
import { database } from '@repo/database';
import { NextResponse } from 'next/server';

/**
 * Monthly marketer cron (1st of each month, 08:00 UTC).
 *
 * Two batches:
 *
 *   Batch 1 — Solicitor outreach drafts
 *     Pulls up to 15 solicitor contacts tagged probate or divorce. Drafts a
 *     peer-to-peer outreach email + LinkedIn DM per firm and persists as
 *     `approve_solicitor_outreach` FounderActions.
 *
 *   Batch 2 — Paid ad copy variants
 *     For each of (probate, chain_break) segments, drafts 3 headlines and
 *     3 body copies (6 variants total per segment). Persisted as
 *     `approve_paid_ad_copy` FounderActions.
 *
 * Cost cap (Haiku 4.5):
 *   - Batch 1: ≤ 15 × ~$0.004 ≈ $0.06
 *   - Batch 2: 2 × ~$0.004 ≈ $0.01
 *   ≈ $0.07/month
 */

const MAX_SOLICITORS_PER_RUN = 15;

// ─── Outreach draft prompt (lifted from cron/agent-prospecting) ─────────
const OUTREACH_SYSTEM_PROMPT = `You write peer-to-peer outreach for Bellwood Ventures, a UK property-buying firm specialising in fall-through deals, probate, and distressed sales.

You are writing to senior solicitors at independent firms — busy professionals who get cold outreach daily. Most go straight to bin. Yours must NOT.

Voice: peer-to-peer, professional, slightly dry, specific. Closer to a working surveyor than a sales rep. Short sentences. No marketing fluff. No countdown urgency. No "synergy" or "revolutionise". UK spelling.

You will receive a structured profile of one firm. Produce a JSON object containing TWO drafts:

{
  "email": {
    "subject": string,              // ≤ 7 words, specific, no clickbait
    "bodyPlainText": string         // 3 short paragraphs, ≤ 110 words total. Sign off as "Sam — Bellwood Ventures, hello@bellwoodslane.co.uk".
  },
  "linkedInDm": {
    "openingHook": string,          // 1 sentence, ≤ 18 words, references something specific about the firm or their probate / divorce practice
    "bodyPlainText": string         // 2 short paragraphs, ≤ 80 words total. Sign off as "Sam".
  },
  "personalisedHook": string        // 1 sentence, ≤ 25 words. WHY this firm specifically.
}

Iron rules:
- Lead with what's in it for THEM: a fast, cash-buyer route for executor sales where the beneficiaries want closure within 8 weeks. Frees up admin time.
- NAME the firm + their probate / divorce practice so it doesn't read as a template.
- NEVER promise "we will buy any house" — we are selective; that's the brand.
- NEVER use "AI", "machine learning", "algorithm" — peer language only.
- NEVER use urgency / countdown language. We are a quiet, peer offer — not a sales pitch.
- The LinkedIn DM is SHORTER than the email. Different opening from the email subject.
- Output ONLY the JSON object, no markdown fences, no prose.`;

interface OutreachDraft {
  email: { subject: string; bodyPlainText: string };
  linkedInDm: { openingHook: string; bodyPlainText: string };
  personalisedHook: string;
}

// ─── Paid ad copy prompt ─────────────────────────────────────────────────

const PAID_AD_SYSTEM_PROMPT = `You write Google / Meta paid search and social ad variants for Bellwood Ventures, a UK direct-to-vendor property buyer.

Voice (marketing plan §2):
- Numbers and specifics over adjectives. Plain English. UK spelling.
- Professional, slightly dry. Closer to a chartered surveyor than a property influencer.

You will be given a single vendor segment (e.g. "probate", "chain_break"). Produce 3 headline variants + 3 body copy variants.

NEVER use:
- "AI", "machine learning", "algorithm", "powered by"
- "We buy any house" — Bellwood is selective; that's the brand
- "Get cash today!", countdown timers, urgency language
- Stock-photo platitudes about families/happiness
- "World-class", "best-in-class", "industry-leading", "revolutionary"

ALWAYS:
- Lead with the reader's situation, not Bellwood
- One concrete promise per variant (24h cash backup, 8 week completion, no agent fee, etc.)
- ASA/CAP code compliant — every numeric claim must be substantiable

Return ONLY JSON (no markdown fences, no preamble):

{
  "segment": string,                                  // echo back the segment
  "headlines": Array<{ text: string; angle: string }>,  // 3 variants, ≤ 30 chars each, "angle" is 1-3 words describing the strategic frame
  "bodies": Array<{ text: string; angle: string }>,    // 3 variants, ≤ 90 chars each, distinct from each other and from the headlines
  "complianceNotes": string[]                          // any factual claims that need substantiation before going live
}`;

interface PaidAdCopy {
  segment: string;
  headlines: Array<{ text: string; angle: string }>;
  bodies: Array<{ text: string; angle: string }>;
  complianceNotes: string[];
}

export const POST = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const runDate = new Date();

  const solicitorResult = await draftSolicitorOutreach();
  const paidAdResult = await draftPaidAdCopy();

  await database.agentEvent
    .create({
      data: {
        agent: 'marketer',
        eventType: 'marketer_monthly',
        summary: `Marketer monthly: ${solicitorResult.drafted} solicitor drafts + ${paidAdResult.drafted} paid-ad segments`,
        count: solicitorResult.drafted + paidAdResult.drafted,
        payload: {
          solicitors: solicitorResult,
          paidAds: paidAdResult,
        },
      },
    })
    .catch((err) => {
      console.warn('[marketer-monthly] event log failed', err);
    });

  return NextResponse.json({
    success: true,
    runDate: runDate.toISOString(),
    solicitors: solicitorResult,
    paidAds: paidAdResult,
  });
};

// ────────────────────────────────────────────────────────────────────────────
// Batch 1 — Solicitor outreach
// ────────────────────────────────────────────────────────────────────────────

async function draftSolicitorOutreach(): Promise<{
  scanned: number;
  drafted: number;
  fallback: boolean;
}> {
  const solicitors = await database.contact.findMany({
    where: {
      type: 'solicitor',
      tags: { hasSome: ['probate', 'divorce'] },
    },
    take: MAX_SOLICITORS_PER_RUN,
    orderBy: { updatedAt: 'desc' },
  });

  if (solicitors.length === 0) {
    return { scanned: 0, drafted: 0, fallback: false };
  }

  let drafted = 0;
  const fallbackNames: string[] = [];

  for (const firm of solicitors) {
    const focus = firm.tags
      .filter((t) => t === 'probate' || t === 'divorce')
      .join(' + ') || 'probate';

    const userPrompt = [
      `Firm: ${firm.name}`,
      firm.company ? `Branch / parent: ${firm.company}` : null,
      firm.location ? `Location: ${firm.location}` : null,
      `Practice focus (per our tags): ${focus}`,
      firm.notes ? `Notes: ${firm.notes.slice(0, 400)}` : null,
      '',
      'Draft the email + LinkedIn DM per the system rules. JSON only.',
    ]
      .filter(Boolean)
      .join('\n');

    const draft = await callClaudeForJson<OutreachDraft>({
      system: OUTREACH_SYSTEM_PROMPT,
      user: userPrompt,
      maxTokens: 800,
      temperature: 0.5,
      model: CLAUDE_HAIKU,
      feature: 'solicitor_outreach',
      cacheSystemPrompt: true,
    }).catch((err) => {
      console.warn(`[marketer-monthly] LLM draft failed for ${firm.name}`, err);
      return null;
    });

    if (!draft?.email?.subject || !draft?.linkedInDm?.openingHook) {
      fallbackNames.push(firm.name);
      continue;
    }

    try {
      await database.founderAction.create({
        data: {
          type: 'approve_solicitor_outreach',
          priority: 'medium',
          status: 'pending',
          agent: 'marketer',
          title: `Approve solicitor outreach: ${firm.name}`,
          description: [
            draft.personalisedHook,
            '',
            `**Email — "${draft.email.subject}"**`,
            '',
            draft.email.bodyPlainText,
            '',
            `**LinkedIn DM**`,
            '',
            draft.linkedInDm.openingHook,
            '',
            draft.linkedInDm.bodyPlainText,
          ].join('\n'),
          metadata: JSON.parse(
            JSON.stringify({
              assignedToAgent: 'board',
              workflow: 'approve_then_send',
              channel: 'email+linkedin',
              firm: {
                id: firm.id,
                name: firm.name,
                company: firm.company,
                email: firm.email,
                location: firm.location,
                tags: firm.tags,
              },
              email: draft.email,
              linkedInDm: draft.linkedInDm,
              personalisedHook: draft.personalisedHook,
              link: '/outreach',
            }),
          ),
        },
      });
      drafted++;
    } catch (err) {
      console.warn(`[marketer-monthly] action create failed for ${firm.name}`, err);
      fallbackNames.push(firm.name);
    }
  }

  if (fallbackNames.length > 0) {
    await database.founderAction
      .create({
        data: {
          type: 'general',
          priority: 'low',
          status: 'pending',
          agent: 'marketer',
          title: `Marketer monthly: ${fallbackNames.length} solicitor outreach drafts need manual writing`,
          description: [
            'Claude was unavailable (or returned no parseable JSON) for the following solicitor firms.',
            '',
            ...fallbackNames.map((n) => `- ${n}`),
          ].join('\n'),
          metadata: JSON.parse(
            JSON.stringify({
              workflow: 'marketer_monthly_solicitor_fallback',
              firms: fallbackNames,
            }),
          ),
        },
      })
      .catch((err) => {
        console.warn('[marketer-monthly] solicitor fallback failed', err);
      });
  }

  return {
    scanned: solicitors.length,
    drafted,
    fallback: fallbackNames.length > 0,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Batch 2 — Paid ad copy
// ────────────────────────────────────────────────────────────────────────────

const PAID_AD_SEGMENTS: Array<'probate' | 'chain_break'> = [
  'probate',
  'chain_break',
];

async function draftPaidAdCopy(): Promise<{
  segments: string[];
  drafted: number;
  fallback: boolean;
}> {
  let drafted = 0;
  const fallbackSegments: string[] = [];

  for (const segment of PAID_AD_SEGMENTS) {
    const copy = await callClaudeForJson<PaidAdCopy>({
      system: PAID_AD_SYSTEM_PROMPT,
      user: [
        `Segment: ${segment}`,
        '',
        'Draft 3 headline variants + 3 body copy variants. JSON only.',
      ].join('\n'),
      maxTokens: 700,
      temperature: 0.6,
      model: CLAUDE_HAIKU,
      feature: 'paid_ad_copy',
      cacheSystemPrompt: true,
    }).catch((err) => {
      console.warn(`[marketer-monthly] LLM ad copy failed for ${segment}`, err);
      return null;
    });

    if (!copy || !Array.isArray(copy.headlines) || !Array.isArray(copy.bodies)) {
      fallbackSegments.push(segment);
      continue;
    }

    try {
      await database.founderAction.create({
        data: {
          type: 'approve_paid_ad_copy',
          priority: 'low',
          status: 'pending',
          agent: 'marketer',
          title: `Approve paid ad copy: ${segment} (3 headlines + 3 bodies)`,
          description: [
            `**Segment:** ${segment}`,
            '',
            `**Headlines:**`,
            ...copy.headlines.map((h, i) => `${i + 1}. ${h.text} _(angle: ${h.angle})_`),
            '',
            `**Bodies:**`,
            ...copy.bodies.map((b, i) => `${i + 1}. ${b.text} _(angle: ${b.angle})_`),
            copy.complianceNotes?.length
              ? `\n**Compliance notes:** ${copy.complianceNotes.join('; ')}`
              : '',
          ].join('\n'),
          metadata: JSON.parse(
            JSON.stringify({
              workflow: 'approve_then_launch',
              channel: 'paid_ads',
              segment,
              headlines: copy.headlines,
              bodies: copy.bodies,
              complianceNotes: copy.complianceNotes ?? [],
            }),
          ),
        },
      });
      drafted++;
    } catch (err) {
      console.warn(`[marketer-monthly] paid-ad action create failed for ${segment}`, err);
      fallbackSegments.push(segment);
    }
  }

  if (fallbackSegments.length > 0) {
    await database.founderAction
      .create({
        data: {
          type: 'general',
          priority: 'low',
          status: 'pending',
          agent: 'marketer',
          title: `Marketer monthly: ${fallbackSegments.length} paid-ad copy set${fallbackSegments.length === 1 ? '' : 's'} need manual drafting`,
          description: [
            'Claude was unavailable (or returned no parseable JSON) for the following paid-ad segments. Draft 3 headlines + 3 bodies for each manually.',
            '',
            ...fallbackSegments.map((s) => `- ${s}`),
          ].join('\n'),
          metadata: JSON.parse(
            JSON.stringify({
              workflow: 'marketer_monthly_paid_ad_fallback',
              segments: fallbackSegments,
            }),
          ),
        },
      })
      .catch((err) => {
        console.warn('[marketer-monthly] paid-ad fallback failed', err);
      });
  }

  return {
    segments: PAID_AD_SEGMENTS as unknown as string[],
    drafted,
    fallback: fallbackSegments.length > 0,
  };
}
