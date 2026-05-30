import { env } from '@/env';
import { callClaudeForJson } from '@repo/ai/claude';
import { database } from '@repo/database';
import { sendEmail } from '@repo/email';
import { getAgentsByPostcode } from '@repo/property-data';
import { NextResponse } from 'next/server';

/**
 * Cap on how many newly surfaced firms get LLM-drafted personalised
 * outreach per Monday run. The cron may surface 50+ firms across all
 * postcodes — drafting for every one is overkill for a single founder
 * who can only follow up on a handful per week.
 *
 * Cost guard at 15 firms ≈ 15 × ~$0.008 = $0.12 per Monday = ~$6/year.
 */
const MAX_DRAFTS_PER_RUN = 15;

/**
 * Weekly agent prospecting cron.
 *
 * Runs Mondays at 8am UTC. For each target postcode in
 * AGENT_PROSPECTING_POSTCODES (or the hardcoded fallback below), pulls
 * PropertyData's `/agents` endpoint — a ranked list of estate agents by
 * active listing volume.
 *
 * Each agent surfaced is upserted into the Contact table as
 * type='estate_agent'. New firms (not seen in any prior run) are flagged
 * via tags + counted into the run summary, which is then sent to Sam as
 * a Founder Action and an optional email.
 *
 * Cost: ~3 credits per postcode × N postcodes per week. At 20 postcodes
 * that's ~60 credits/week = ~240/month, well within the 5k plan.
 *
 * The actual outreach (email/WhatsApp campaigns) lives in /outreach in
 * apps/app — this cron just keeps the prospect list fresh.
 */

const FALLBACK_POSTCODES = [
  // Manchester / Stockport — primary patch
  'M14',
  'M19',
  'M20',
  'M21',
  'SK4',
  'SK5',
  'SK7',
  'SK8',
  // Leeds
  'LS1',
  'LS6',
  'LS8',
  'LS17',
  // Sheffield
  'S1',
  'S7',
  'S11',
  'S17',
];

const SOURCE_TAG = 'source:propertydata';

/**
 * Resolve target postcodes in this order:
 *   1. DB setting `scouting.targetPostcodes` (founder-managed via dashboard)
 *   2. AGENT_PROSPECTING_POSTCODES env var (legacy)
 *   3. Hardcoded FALLBACK_POSTCODES (sensible default for first launch)
 */
async function targetPostcodes(): Promise<string[]> {
  try {
    const setting = await database.setting.findUnique({
      where: { key: 'scouting.targetPostcodes' },
    });
    if (setting && Array.isArray(setting.value)) {
      const list = (setting.value as unknown[])
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .map((p) => p.trim().toUpperCase());
      if (list.length > 0) return list;
    }
  } catch (err) {
    console.warn('[cron/agent-prospecting] failed to read postcodes from DB', err);
  }
  const fromEnv = env.AGENT_PROSPECTING_POSTCODES;
  if (fromEnv) {
    return fromEnv
      .split(',')
      .map((p) => p.trim().toUpperCase())
      .filter(Boolean);
  }
  return FALLBACK_POSTCODES;
}

type ProspectAgent = {
  postcode: string;
  name: string;
  phone?: string;
  address?: string;
  numberOfListings?: number;
  url?: string;
};

export const POST = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date();
  const postcodes = await targetPostcodes();
  const surfaced: ProspectAgent[] = [];

  for (const postcode of postcodes) {
    const data = await getAgentsByPostcode(postcode);
    const agents = (data as { result?: { agents?: unknown[] } } | null)?.result
      ?.agents;
    if (!Array.isArray(agents)) continue;

    for (const raw of agents) {
      const a = raw as {
        name?: string;
        phone?: string;
        address?: string;
        number_of_listings?: number;
        url?: string;
      };
      if (!a.name) continue;
      surfaced.push({
        postcode,
        name: a.name.trim(),
        phone: a.phone?.trim(),
        address: a.address?.trim(),
        numberOfListings: a.number_of_listings,
        url: a.url?.trim(),
      });
    }
  }

  // Upsert into Contact table. We match on (name + postcode) - same firm
  // appearing in two postcodes counts as two records, which is right
  // because we'll outreach per-branch.
  let newCount = 0;
  let updatedCount = 0;
  for (const prospect of surfaced) {
    const existing = await database.contact.findFirst({
      where: {
        type: 'estate_agent',
        name: prospect.name,
        location: { contains: prospect.postcode, mode: 'insensitive' },
      },
    });

    const baseTags = [
      SOURCE_TAG,
      `postcode:${prospect.postcode}`,
      ...(typeof prospect.numberOfListings === 'number'
        ? [`listings:${prospect.numberOfListings}`]
        : []),
    ];

    if (existing) {
      // Refresh listing volume + url; preserve any human-added tags.
      const preservedTags = existing.tags.filter(
        (t) =>
          !t.startsWith('listings:') &&
          !t.startsWith('postcode:') &&
          t !== SOURCE_TAG,
      );
      await database.contact.update({
        where: { id: existing.id },
        data: {
          phone: prospect.phone ?? existing.phone,
          notes: prospect.url
            ? `${existing.notes ?? ''}\n[${startedAt.toISOString()}] Listing volume refresh: ${prospect.numberOfListings ?? '?'} active listings.`
                .trim()
                .slice(0, 1900)
            : existing.notes,
          tags: Array.from(new Set([...preservedTags, ...baseTags])),
        },
      });
      updatedCount++;
    } else {
      await database.contact.create({
        data: {
          type: 'estate_agent',
          name: prospect.name,
          phone: prospect.phone,
          location: prospect.address ?? prospect.postcode,
          notes: prospect.url
            ? `${prospect.numberOfListings ?? '?'} active listings.\nURL: ${prospect.url}`
            : `${prospect.numberOfListings ?? '?'} active listings.`,
          tags: [...baseTags, 'status:not_yet_contacted'],
        },
      });
      newCount++;
    }
  }

  // Top 5 newly surfaced firms by listing volume (most worth outreaching)
  const topNew = surfaced
    .filter((a) => typeof a.numberOfListings === 'number')
    .sort((a, b) => (b.numberOfListings ?? 0) - (a.numberOfListings ?? 0))
    .slice(0, 5);

  // Identify the highest-leverage NEW firms (not refreshes) for personalised
  // outreach drafts. We rank by listing volume and cap at MAX_DRAFTS_PER_RUN
  // to keep token spend predictable. Each surviving firm gets an LLM-drafted
  // peer-style email + LinkedIn DM held in a FounderAction for board approval.
  const draftCandidates = await selectDraftCandidates(surfaced);
  const draftsCreated = await draftAndPersistOutreach(draftCandidates);

  const summary = `Prospecting run scanned ${postcodes.length} postcodes, ` +
    `surfaced ${surfaced.length} agent records ` +
    `(${newCount} new, ${updatedCount} refreshed)` +
    (draftsCreated > 0 ? `, drafted ${draftsCreated} personalised outreach pairs.` : '.');

  // FounderAction so Sam sees the run in /actions
  try {
    const topNewLines = topNew
      .map(
        (a) =>
          `· ${a.name} (${a.postcode}) — ${a.numberOfListings ?? '?'} listings${
            a.phone ? ` — ${a.phone}` : ''
          }`,
      )
      .join('\n');
    await database.founderAction.create({
      data: {
        type: 'general',
        priority: 'medium',
        status: 'pending',
        agent: 'scout',
        title: `Weekly agent prospecting: ${newCount} new firm${newCount === 1 ? '' : 's'} surfaced`,
        description: `${summary}\n\nTop new firms by listing volume:\n${topNewLines || '(none new this run)'}\n\nReview in /contacts (filter type=estate_agent).`,
        metadata: {
          runDate: startedAt.toISOString(),
          postcodes,
          surfaced: surfaced.length,
          new: newCount,
          updated: updatedCount,
          link: '/contacts',
        },
      },
    });
  } catch (err) {
    console.warn('[agent-prospecting] founder-action create failed', err);
  }

  // Optional summary email
  const reportTo = env.AGENT_PROSPECTING_REPORT_EMAIL;
  if (reportTo && (newCount > 0 || updatedCount > 0)) {
    try {
      const topNewLines = topNew
        .map(
          (a) =>
            `- ${a.name} (${a.postcode}) — ${a.numberOfListings ?? '?'} listings${a.phone ? ` — ${a.phone}` : ''}`,
        )
        .join('\n');
      await sendEmail({
        to: reportTo,
        subject: `Weekly prospecting: ${newCount} new agent${newCount === 1 ? '' : 's'}`,
        text: [
          `Hi,`,
          ``,
          summary,
          ``,
          `Top new firms by listing volume:`,
          topNewLines || '(none new this run)',
          ``,
          `Open the dashboard to action: https://bellwood-app.vercel.app/contacts`,
          ``,
          `— Bellwoods scout`,
        ].join('\n'),
      });
    } catch (err) {
      console.warn('[agent-prospecting] summary email failed', err);
    }
  }

  return NextResponse.json({
    success: true,
    runDate: startedAt.toISOString(),
    postcodesScanned: postcodes.length,
    agentsSurfaced: surfaced.length,
    newCount,
    updatedCount,
    topNew,
    draftsCreated,
  });
};

// ────────────────────────────────────────────────────────────────────────────
// LLM-drafted personalised outreach
//
// Pattern: held-for-review. Every draft becomes a FounderAction with the
// email + LinkedIn DM in metadata. The founder reviews in /actions and
// chooses to send (manually or via the outreach flow). NEVER auto-send to
// estate agents in cold prospecting — relationship risk too high.
// ────────────────────────────────────────────────────────────────────────────

const OUTREACH_SYSTEM_PROMPT = `You write peer-to-peer outreach for Bellwood Ventures, a UK property-buying firm specialising in fall-through deals, probate, and distressed sales.

You are writing to branch managers and partners at independent estate agents — busy professionals who get 5+ cold outreach messages a day. Most go straight to bin. Yours must NOT.

Voice: peer-to-peer, professional, slightly dry, specific. Closer to a working surveyor than a sales rep. Short sentences. No marketing fluff. No countdown urgency. No "synergy" or "revolutionise". UK spelling.

You will receive a structured profile of one firm. Produce a JSON object containing TWO drafts:

{
  "email": {
    "subject": string,              // ≤ 7 words, specific, no clickbait
    "bodyPlainText": string         // 3 short paragraphs, ≤ 110 words total. Sign off as "Sam — Bellwood Ventures, hello@bellwoodslane.co.uk".
  },
  "linkedInDm": {
    "openingHook": string,          // 1 sentence, ≤ 18 words, references something specific about their firm or patch
    "bodyPlainText": string         // 2 short paragraphs, ≤ 80 words total. Sign off as "Sam".
  },
  "personalisedHook": string        // 1 sentence, ≤ 25 words. WHY this firm specifically — e.g. "M14 listing volume signals chain-break exposure"
}

Iron rules:
- Lead with what's in it for THEM: 24-hour cash backup when a chain breaks, agreed introducer fee, no listing sacrificed.
- NAME the firm + their patch + (if known) their listing volume so it doesn't read as a template.
- NEVER promise "we will buy any house" — we are selective; that's the brand.
- NEVER use "AI", "machine learning", "algorithm" — peer language only.
- The LinkedIn DM is SHORTER than the email. Different opening from the email subject.
- Output ONLY the JSON object, no markdown fences, no prose.`;

interface OutreachDraft {
  email: { subject: string; bodyPlainText: string };
  linkedInDm: { openingHook: string; bodyPlainText: string };
  personalisedHook: string;
}

async function selectDraftCandidates(
  surfaced: Array<{
    postcode: string;
    name: string;
    phone?: string;
    address?: string;
    numberOfListings?: number;
    url?: string;
  }>,
): Promise<typeof surfaced> {
  // Only NEW firms (no Contact yet) get drafts — refreshing the same firm
  // every Monday would create churny duplicate actions.
  const existingNames = await database.contact
    .findMany({
      where: { type: 'estate_agent' },
      select: { name: true },
    })
    .then((rows) => new Set(rows.map((r) => r.name)))
    .catch(() => new Set<string>());

  return surfaced
    .filter((a) => !existingNames.has(a.name))
    .filter((a) => typeof a.numberOfListings === 'number')
    .sort((a, b) => (b.numberOfListings ?? 0) - (a.numberOfListings ?? 0))
    .slice(0, MAX_DRAFTS_PER_RUN);
}

async function draftAndPersistOutreach(
  candidates: Array<{
    postcode: string;
    name: string;
    phone?: string;
    address?: string;
    numberOfListings?: number;
    url?: string;
  }>,
): Promise<number> {
  if (candidates.length === 0) return 0;

  let created = 0;

  for (const firm of candidates) {
    const lines: string[] = [
      `Firm: ${firm.name}`,
      `Target postcode: ${firm.postcode}`,
    ];
    if (typeof firm.numberOfListings === 'number') {
      lines.push(`Active listings (PropertyData snapshot): ${firm.numberOfListings}`);
    }
    if (firm.address) lines.push(`Branch address: ${firm.address}`);
    if (firm.url) lines.push(`Public profile / listings page: ${firm.url}`);
    lines.push('', 'Draft the email + LinkedIn DM per the system rules. JSON only.');

    const draft = await callClaudeForJson<OutreachDraft>({
      system: OUTREACH_SYSTEM_PROMPT,
      user: lines.join('\n'),
      maxTokens: 800,
      temperature: 0.5,
      feature: 'agent_outreach_draft',
      cacheSystemPrompt: true,
    }).catch((err) => {
      console.warn(`[agent-prospecting] LLM draft failed for ${firm.name}`, err);
      return null;
    });

    if (!draft || !draft.email || !draft.linkedInDm) continue;

    try {
      await database.founderAction.create({
        data: {
          type: 'approve_outreach_draft',
          priority: 'medium',
          status: 'pending',
          agent: 'marketer',
          title: `Approve outreach draft: ${firm.name} (${firm.postcode})`,
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
          metadata: {
            assignedToAgent: 'board',
            workflow: 'approve_then_send',
            firm: {
              name: firm.name,
              postcode: firm.postcode,
              address: firm.address,
              phone: firm.phone,
              listings: firm.numberOfListings,
              url: firm.url,
            },
            email: draft.email,
            linkedInDm: draft.linkedInDm,
            personalisedHook: draft.personalisedHook,
            link: '/outreach',
          },
        },
      });
      created++;
    } catch (err) {
      console.warn(`[agent-prospecting] FounderAction create failed for ${firm.name}`, err);
    }
  }

  return created;
}
