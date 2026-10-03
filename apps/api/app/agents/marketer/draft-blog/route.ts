import { database } from '@repo/database';
import { KEPT_AGENT_PROPOSITION, KEPT_VOICE_RULES } from '@repo/ai/brand-voice';
import { callClaude, callClaudeForJson } from '@repo/ai/claude';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateAgentAuth, unauthorizedResponse } from '../../_lib/auth';

/**
 * POST /agents/marketer/draft-blog
 *
 * The Marketer agent (or the founder via curl) asks for a draft SEO blog
 * post on a specific topic + vendor segment. We:
 *
 *   1. DRAFT — the model writes the post in Kept voice. The voice block
 *      comes from @repo/ai/brand-voice, which derives from
 *      docs/brand/KEPT.md § Voice (the Beth Sims bar) and the copy-truth
 *      rules. Do not add voice rules here; add them there.
 *   2. AUDIT — a second Claude pass reviews the draft against the UK
 *      compliance ruleset (CPR 2008, NTSELAT, ICO/UK GDPR, PECR, ASA/CAP)
 *      and returns a structured list of risks.
 *   3. PARK — both outputs are persisted to a FounderAction of type
 *      `approve_blog_draft` with the post body in metadata. The
 *      founder reviews + Counsel signs off before publish.
 *
 * NEVER publishes directly. Vendor-facing content is always held — per the
 * "iron rule" in the marketing plan §6.
 *
 * Cost: 2 × Claude calls per request. Draft is ~3-5k tokens output.
 * Audit is ~1k tokens output. At Sonnet 4.5 pricing ~$0.08 per draft.
 * 2 drafts/week × 4 weeks = ~$0.65/month. Trivial.
 */

// ────────────────────────────────────────────────────────────────────────────
// Schema
// ────────────────────────────────────────────────────────────────────────────

const Body = z.object({
  /** Blog post topic — short title-cased phrase, e.g. "What happens when your buyer pulls out". */
  topic: z.string().min(5).max(200),
  /**
   * Seller segment. Drives the brief + landing page CTA. One entry per live
   * apps/web landing route, so a draft can never link to a page that does
   * not exist (`distress` maps to /your-situation; there is no /distress).
   */
  segment: z.enum([
    'probate',
    'chain_break',
    'separation',
    'relocation',
    'distress',
    'problem_property',
    'agent',
  ]),
  /** Primary SEO keyword (used in title + first paragraph). */
  primaryKeyword: z.string().min(2).max(80).optional(),
  /** Supporting keywords (≤ 5). Sprinkled naturally — no stuffing. */
  supportingKeywords: z.array(z.string().min(2).max(60)).max(5).optional(),
  /** Free-text founder context — e.g. specific data point to include, audience nuance. */
  audienceNotes: z.string().max(500).optional(),
});

// ────────────────────────────────────────────────────────────────────────────
// Prompts
// ────────────────────────────────────────────────────────────────────────────

/**
 * Landing routes are the live apps/web pages. Briefs describe the person,
 * not the pitch; the promise and the bans live in KEPT_VOICE_RULES.
 */
const SEGMENT_BRIEF: Record<z.infer<typeof Body>['segment'], string> = {
  probate:
    'Executors and families selling an inherited home. Grieving, often doing this for the first time, sometimes from a distance. Landing page: /probate. Lead with closure and getting back to what matters. No numbers of any kind: no inheritance tax, no interest, no carrying costs, no council tax, no clock. Suggest a solicitor where the estate is complex.',
  chain_break:
    'Sellers whose buyer has just pulled out, often with an onward purchase at risk. Landing page: /chain-break. Lead with certainty: one buyer, a viewing, a written offer within two working days of it, held for a week. State no faster timing than that.',
  separation:
    'Two people selling a shared home after a separation who need one clean decision and no drawn-out marketing. Landing page: /separation. Even-handed and neutral: no assumptions about fault, who is staying, or who wants what.',
  relocation:
    'Sellers moving for work or family with a date they cannot miss. Landing page: /relocation. Lead with a fixed timetable and one buyer instead of a chain.',
  distress:
    'Sellers in financial difficulty: arrears, repossession risk, a debt that a sale would clear. Highest sensitivity. Landing page: /your-situation. Signpost StepChange and Citizens Advice in the body. Never fear-led, never urgent, never a figure. Say plainly that our offer is below market and that other routes may serve them better.',
  problem_property:
    'Sellers of difficult properties: knotweed, short lease, cladding, structural issues, non-standard construction. Landing page: /problem-property. Be frank about what we will and will not buy, and that our offer reflects the work needed. No discount band, no percentage, no figure.',
  agent: `Estate agents (branch managers, partners at independents). NOT a seller: peer-to-peer professional tone. Landing page: /agents (chain-break referrals: /save-the-sale). What they keep: ${KEPT_AGENT_PROPOSITION} Service claims only as stated in the promise.`,
};

const DRAFT_SYSTEM_PROMPT = `You write SEO blog posts for Kept, a UK direct-to-vendor property buyer specialising in chain-break, probate, and problem properties.

${KEPT_VOICE_RULES}

FORMAT.
- UK spelling. £ symbol with grouped thousands where a figure is legitimately public (house-price indices, not our offers). Dates DD Month YYYY.
- Lead with the reader's situation, not Kept.
- Where the topic touches financial difficulty, signpost StepChange and Citizens Advice in the body.
- One clear CTA at the end, pointing to the landing page named in the segment brief. Never a route that is not named there.

You MUST return JSON only, no markdown fences, no preamble. Schema:

{
  "title": string,                     // ≤ 70 chars, includes primary keyword if given, no clickbait
  "slug": string,                      // kebab-case, ≤ 60 chars
  "metaDescription": string,           // 140-160 chars, includes primary keyword
  "h1": string,                        // matches or rephrases title
  "bodyMarkdown": string,              // 800-1200 words, proper headings (## and ###), short paragraphs (≤ 3 sentences)
  "ctaLine": string,                   // 1 sentence, plain text, end-of-post call to action
  "internalLinks": Array<{ anchor: string; target: string }>,  // 2-4 internal links to other Kept pages
  "keywordsUsedNaturally": string[]    // list of which provided keywords actually appear in the body
}`;

const COMPLIANCE_SYSTEM_PROMPT = `You are senior in-house counsel for a UK property-buying company. You review marketing copy against UK consumer protection + advertising standards BEFORE it is published. Your job is to catch reputational and regulatory landmines.

You will receive a blog post draft. Audit it against these rule sets and return a structured JSON report.

Rule sets:
1. **CPR 2008** — Consumer Protection from Unfair Trading Regulations. No misleading actions/omissions, no aggressive practices.
2. **NTSELAT** — National Trading Standards Estate and Letting Agency Team. Material information must be disclosed in writing; fee structures must be clear.
3. **ICO + UK GDPR** — Data protection. Opt-out language required on every email collection point; data minimisation; lawful basis named.
4. **PECR** — Privacy and Electronic Communications Regulations. Opt-out on every B2B email is still required even with the B2B exemption.
5. **ASA / CAP Code** — Advertising Standards Authority. Every factual claim must be substantiable; comparative claims must be honest and verifiable.
6. **Kept marketing plan §11** — anonymisation rules. Postcode AREA only (e.g. M14), no street numbers, no vendor names without explicit written consent, 30-day delay between completion and any identifiable post.
7. **Voice and copy truth** — the draft must obey every line of the Kept voice block below. Treat any service claim faster than the promise, any figure or discount band in front of a seller, the word "advice", "legally binding", an em dash, or a probate piece that mentions tax, interest or costs as a blocker.

Kept voice block:
${KEPT_VOICE_RULES}

Return ONLY JSON (no markdown fences):

{
  "overallVerdict": "publish_ready" | "edit_required" | "do_not_publish",
  "issues": Array<{
    "ruleSet": "CPR" | "NTSELAT" | "ICO" | "PECR" | "ASA" | "Anonymisation" | "Voice",
    "severity": "blocker" | "high" | "medium" | "low",
    "excerpt": string,                 // ≤ 25 words quoted from the draft
    "problem": string,                 // 1 sentence, plain English
    "suggestedFix": string             // 1 sentence, concrete edit
  }>,
  "substantiationNeeded": string[],    // factual claims that need a linked source before publish
  "missingSignposts": string[]         // if the topic is distress-related and StepChange/Citizens Advice are absent
}

Be exacting. A 'publish_ready' verdict means a senior solicitor would approve as-is. If there is ANY doubt, mark 'edit_required'.`;

// ────────────────────────────────────────────────────────────────────────────
// Handler
// ────────────────────────────────────────────────────────────────────────────

interface BlogDraft {
  title: string;
  slug: string;
  metaDescription: string;
  h1: string;
  bodyMarkdown: string;
  ctaLine: string;
  internalLinks: Array<{ anchor: string; target: string }>;
  keywordsUsedNaturally: string[];
}

interface ComplianceReport {
  overallVerdict: 'publish_ready' | 'edit_required' | 'do_not_publish';
  issues: Array<{
    ruleSet: string;
    severity: 'blocker' | 'high' | 'medium' | 'low';
    excerpt: string;
    problem: string;
    suggestedFix: string;
  }>;
  substantiationNeeded: string[];
  missingSignposts: string[];
}

export async function POST(request: Request) {
  if (!validateAgentAuth(request)) return unauthorizedResponse();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const segmentBrief = SEGMENT_BRIEF[input.segment];

  // Step 1 — Draft
  const draftUserPrompt = [
    `Topic: ${input.topic}`,
    `Vendor segment: ${input.segment}`,
    `Segment brief: ${segmentBrief}`,
    input.primaryKeyword ? `Primary keyword: ${input.primaryKeyword}` : null,
    input.supportingKeywords?.length
      ? `Supporting keywords: ${input.supportingKeywords.join(', ')}`
      : null,
    input.audienceNotes ? `Founder notes: ${input.audienceNotes}` : null,
    '',
    'Draft the post per the system rules. JSON only.',
  ]
    .filter(Boolean)
    .join('\n');

  const draft = await callClaudeForJson<BlogDraft>({
    system: DRAFT_SYSTEM_PROMPT,
    user: draftUserPrompt,
    maxTokens: 4000,
    temperature: 0.6,
    feature: 'blog_draft',
    cacheSystemPrompt: true,
  });

  if (!draft || !draft.bodyMarkdown) {
    return NextResponse.json(
      {
        error:
          'Draft generation failed: the model returned no parseable draft. Check OPENROUTER_API_KEY or ANTHROPIC_API_KEY is set on bellwood-api and try again.',
      },
      { status: 502 }
    );
  }

  // Step 2 — Compliance audit (separate pass — gives counsel an independent
  // assessment that won't be biased by the drafter's frame).
  const auditUserPrompt = [
    `Segment: ${input.segment}`,
    `Title: ${draft.title}`,
    `Meta description: ${draft.metaDescription}`,
    '',
    'Body:',
    draft.bodyMarkdown,
    '',
    `CTA: ${draft.ctaLine}`,
  ].join('\n');

  const compliance = await callClaudeForJson<ComplianceReport>({
    system: COMPLIANCE_SYSTEM_PROMPT,
    user: auditUserPrompt,
    maxTokens: 1500,
    temperature: 0.2,
    feature: 'blog_compliance_audit',
    cacheSystemPrompt: true,
  });

  // Step 3 — Persist a FounderAction so Counsel + Founder see it in /actions.
  const blockerCount =
    compliance?.issues?.filter((i) => i.severity === 'blocker').length ?? 0;
  const priority =
    compliance?.overallVerdict === 'do_not_publish' || blockerCount > 0
      ? 'high'
      : compliance?.overallVerdict === 'publish_ready'
        ? 'low'
        : 'medium';

  const action = await database.founderAction
    .create({
      data: {
        type: 'approve_blog_draft',
        priority,
        status: 'pending',
        agent: 'marketer',
        title: `Approve blog draft: ${draft.title}`,
        description: [
          `**Segment:** ${input.segment}`,
          `**Counsel verdict:** ${compliance?.overallVerdict ?? '(audit unavailable)'}`,
          compliance?.issues?.length
            ? `**Issues flagged:** ${compliance.issues.length} (${blockerCount} blocker${blockerCount === 1 ? '' : 's'})`
            : '**Issues flagged:** none',
          '',
          `**Draft length:** ~${draft.bodyMarkdown.split(/\s+/).length} words`,
          `**Meta description:** ${draft.metaDescription}`,
          '',
          'Full draft + compliance report in metadata. Open the action to review.',
        ].join('\n'),
        // Cast — Prisma's Json input type requires an index signature, but
        // our BlogDraft / ComplianceReport interfaces are strictly shaped.
        // Round-trip via JSON to satisfy InputJsonValue at the boundary.
        metadata: JSON.parse(
          JSON.stringify({
            assignedToAgent: 'counsel',
            workflow: 'review_then_publish',
            input,
            draft,
            compliance: compliance ?? null,
          })
        ),
      },
    })
    .catch((err) => {
      console.warn('[draft-blog] FounderAction create failed', err);
      return null;
    });

  return NextResponse.json({
    success: true,
    actionId: action?.id ?? null,
    draft,
    compliance: compliance ?? {
      overallVerdict: 'edit_required',
      issues: [
        {
          ruleSet: 'Voice',
          severity: 'medium',
          excerpt: '(audit unavailable)',
          problem:
            'Compliance audit call returned null — Claude unavailable or API key missing',
          suggestedFix:
            'Re-run /agents/marketer/draft-blog once ANTHROPIC_API_KEY is healthy, or do a manual Counsel review.',
        },
      ],
      substantiationNeeded: [],
      missingSignposts: [],
    },
  });
}

// Helper used during local prototyping — kept here so the file is one-stop.
void callClaude;
