import { env } from '@/env';
import { recordCronHeartbeat } from '../_lib/heartbeat';
import { callClaude, callClaudeForObject, CLAUDE_HAIKU } from '@repo/ai/claude';
import { database } from '@repo/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Pipeline Stage 4: Morning Summary (8:00am daily)
// Creates a single FounderAction summarising everything the agents did
// overnight, and — first — runs the founder desk: every pending action gets
// a ranked, one-line suggested call (see rankFounderDesk below).
//
// The desk is one Haiku call over up to DESK_MAX_ACTIONS actions plus one
// metadata update per action; comfortably inside this budget.
export const maxDuration = 120;

export const POST = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Gather today's agent activity
  const [
    todayEvents,
    pendingActions,
    newLeadsToday,
    strongLeadsToday,
    dealsAppraised,
    outreachSent,
    heldComms,
    slaBreaches,
    topPendingActions,
    topStrongLeads,
  ] = await Promise.all([
    database.agentEvent.findMany({
      where: { createdAt: { gte: todayStart } },
      orderBy: { createdAt: 'desc' },
    }),
    database.founderAction.count({
      where: { status: { in: ['pending', 'in_progress'] } },
    }),
    database.scoutLead.count({
      where: { createdAt: { gte: todayStart } },
    }),
    database.scoutLead.count({
      where: {
        createdAt: { gte: todayStart },
        verdict: 'STRONG',
      },
    }),
    database.agentEvent.count({
      where: {
        createdAt: { gte: todayStart },
        agent: 'appraiser',
        eventType: { in: ['avm_completed', 'pipeline_appraise'] },
      },
    }),
    database.agentEvent.findFirst({
      where: {
        createdAt: { gte: todayStart },
        agent: 'marketer',
        eventType: 'pipeline_outreach',
      },
      select: { payload: true },
    }),
    database.outreachHold.count({
      where: { status: 'held', createdAt: { gte: todayStart } },
    }),
    database.founderAction.count({
      where: {
        type: 'sla_breach',
        status: 'pending',
      },
    }),
    // Top 3 highest-priority pending actions — input for the LLM briefing.
    // System alerts (cron watchdog, source failures) are EXCLUDED: they have
    // their own cards, and echoing them here is what made the briefing read
    // as a duplicate of the rest of the Action Centre.
    database.founderAction.findMany({
      where: {
        status: { in: ['pending', 'in_progress'] },
        agent: { not: 'system' },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take: 3,
      select: { title: true, priority: true },
    }),
    // Top 5 STRONG leads from overnight — input for the LLM briefing
    database.scoutLead.findMany({
      where: { createdAt: { gte: todayStart }, verdict: 'STRONG' },
      orderBy: { leadScore: 'desc' },
      take: 5,
      select: { address: true, postcode: true, leadScore: true, leadType: true },
    }),
  ]);

  // ── Founder desk — rank the queue and draft the call on each item ──
  // The bottleneck is decisions, not generation: the queue was sitting at
  // 24 pending / 0 resolved in a week. Each pending action now carries a
  // suggested call + why (metadata.desk), and the briefing leads with the
  // top of that ranking. Graceful: no key / failure → no desk, briefing as
  // before.
  const desk = await rankFounderDesk();

  const outreachPayload = outreachSent?.payload as Record<string, number> | null;
  const emailsSent = outreachPayload?.autoSent ?? 0;

  // Build the deterministic fallback summary
  const lines: string[] = [];

  if (newLeadsToday > 0) {
    lines.push(`**Scout:** ${newLeadsToday} new leads found (${strongLeadsToday} STRONG)`);
  } else {
    lines.push('**Scout:** No new leads today');
  }

  if (dealsAppraised > 0) {
    lines.push(`**Appraiser:** ${dealsAppraised} valuations completed`);
  }

  if (emailsSent > 0 || heldComms > 0) {
    const parts = [];
    if (emailsSent > 0) parts.push(`${emailsSent} emails auto-sent`);
    if (heldComms > 0) parts.push(`${heldComms} vendor emails awaiting review`);
    lines.push(`**Marketer:** ${parts.join(', ')}`);
  }

  if (slaBreaches > 0) {
    lines.push(`**SLA:** ${slaBreaches} breach${slaBreaches === 1 ? '' : 'es'} need attention`);
  }

  // NOTE: no "total pending actions" line — the Action Centre already shows
  // that count right next to this card. Repeating it was pure noise.

  const dayBucket = new Date().toISOString().slice(0, 10);
  const summaryTitle = `Morning briefing — ${new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`;
  const deterministicBody = lines.join('\n');

  // Try the LLM-synthesised 4-bullet briefing. If it fails or the key is
  // missing, fall back to the deterministic summary above. LLM is always
  // additive — never load-bearing.
  const llmBody = await buildLlmBriefing({
    newLeadsToday,
    strongLeadsToday,
    dealsAppraised,
    emailsSent,
    heldComms,
    slaBreaches,
    pendingActions,
    topPendingActions,
    topStrongLeads,
    deskTop: desk.slice(0, 5),
  });

  const summaryBody = llmBody ?? deterministicBody;

  // Determine priority based on what needs attention
  const hasCritical = slaBreaches > 0 || heldComms > 0;
  const hasActivity = newLeadsToday > 0 || dealsAppraised > 0 || emailsSent > 0;

  // Quiet days get NO briefing card. A briefing that says "nothing happened,
  // N actions pending" restates what the Action Centre already shows —
  // pendingActions alone is deliberately not a trigger anymore.
  if (hasActivity || hasCritical) {
    // Unique violation on dedupKey == already briefed today (cron retry).
    await database.founderAction.create({
      data: {
        type: 'general',
        priority: hasCritical ? 'high' : 'medium',
        title: summaryTitle,
        description: summaryBody,
        agent: 'orchestrator',
        // One briefing per UTC day, even if Vercel retries the cron.
        dedupKey: `morning-briefing:${dayBucket}`,
        // Yesterday's briefing is dead news — expire instead of piling up.
        expiresAt: new Date(Date.now() + 24 * 3600_000),
        metadata: {
          newLeadsToday,
          strongLeadsToday,
          dealsAppraised,
          emailsSent,
          heldComms,
          slaBreaches,
          pendingActions,
          totalEvents: todayEvents.length,
          deskTop: desk.slice(0, 5),
        },
      },
    }).catch(() => {
      // Already briefed today — cron retry, nothing to do.
    });
  }

  // Log the summary event
  await database.agentEvent.create({
    data: {
      agent: 'orchestrator',
      eventType: 'morning_summary',
      summary: summaryTitle,
      count: todayEvents.length,
      payload: {
        newLeadsToday,
        strongLeadsToday,
        dealsAppraised,
        emailsSent,
        heldComms,
        slaBreaches,
        pendingActions,
      },
    },
  });

  await recordCronHeartbeat('pipeline-summary');

  return NextResponse.json({
    success: true,
    summary: {
      newLeadsToday,
      strongLeadsToday,
      dealsAppraised,
      emailsSent,
      heldComms,
      slaBreaches,
      pendingActions,
      totalEvents: todayEvents.length,
    },
  });
};

// ────────────────────────────────────────────────────────────────────────────
// LLM-synthesised morning briefing
//
// Takes the metrics + headline titles and produces a 4-bullet briefing the
// founder can read in 30 seconds. Returns null if Claude is unavailable —
// caller MUST fall back to the deterministic summary.
// ────────────────────────────────────────────────────────────────────────────

interface BriefingInput {
  newLeadsToday: number;
  strongLeadsToday: number;
  dealsAppraised: number;
  emailsSent: number;
  heldComms: number;
  slaBreaches: number;
  pendingActions: number;
  topPendingActions: Array<{ title: string; priority: string }>;
  topStrongLeads: Array<{
    address: string | null;
    postcode: string | null;
    leadScore: number | null;
    leadType: string | null;
  }>;
  /** Top of the founder desk ranking — the calls the briefing should lead with. */
  deskTop: DeskCall[];
}

const BRIEFING_SYSTEM_PROMPT = `You are the Chief of Staff for Kept, a UK property deal-sourcer.

Your job: write the founder's morning briefing. The founder is dyslexic — short sentences, plain English, no jargon, no marketing fluff.

Rules:
- 1 to 4 bullets, drawn from these categories IN ORDER, skipping any with nothing in them:
  1. **Overnight movement** — new leads, valuations done, emails sent
  2. **Watch-outs** — SLA breaches, held vendor emails, anything blocking a deal
  3. **Best lead** — the single strongest overnight lead, with address area + score
  4. **First move** — the top-ranked desk call when one is supplied (use its wording), else one concrete action, e.g. "Open /quotes — 2 agent submissions are at hour 18 of 24"
- SKIP empty categories entirely. Never write "no new leads" or "nothing to report" bullets.
- NEVER mention how many actions are pending — the dashboard shows that next to this card.
- NEVER comment on cron, system, or pipeline health — system alerts have their own cards.
- Each bullet ≤ 20 words.
- Use **bold** for numbers and key entities.
- Return ONLY the bullets in Markdown, no preamble, no closing line.`;

async function buildLlmBriefing(input: BriefingInput): Promise<string | null> {
  const leadLines =
    input.topStrongLeads.length === 0
      ? '(none)'
      : input.topStrongLeads
          .map(
            (l) =>
              `- ${l.address ?? '?'} ${l.postcode ?? ''} · ${l.leadType ?? '?'} · score ${l.leadScore ?? '?'}`,
          )
          .join('\n');

  const actionLines =
    input.topPendingActions.length === 0
      ? '(none)'
      : input.topPendingActions
          .map((a) => `- [${a.priority}] ${a.title}`)
          .join('\n');

  const userPrompt = [
    'Yesterday-to-now metrics:',
    `- new leads: ${input.newLeadsToday} (STRONG: ${input.strongLeadsToday})`,
    `- valuations completed: ${input.dealsAppraised}`,
    `- B2B emails auto-sent: ${input.emailsSent}`,
    `- vendor emails awaiting review: ${input.heldComms}`,
    `- SLA breaches needing attention: ${input.slaBreaches}`,
    '',
    'Top pending deal actions (system alerts excluded — do not mention them):',
    actionLines,
    '',
    'Top STRONG leads from overnight:',
    leadLines,
    '',
    'Founder desk — ranked calls already drafted for the queue (lead the "First move" bullet with #1):',
    input.deskTop.length === 0
      ? '(none)'
      : input.deskTop
          .map((d) => `${d.rank}. ${d.title} → ${d.call}`)
          .join('\n'),
  ].join('\n');

  return callClaude({
    system: BRIEFING_SYSTEM_PROMPT,
    user: userPrompt,
    maxTokens: 500,
    temperature: 0.4,
    model: CLAUDE_HAIKU,
    feature: 'morning_briefing',
  });
}

// Vercel cron sends GET by default. Accept either method so a manual
// POST and an automated GET both reach the same handler.
export const GET = POST;

// ────────────────────────────────────────────────────────────────────────────
// Founder desk — rank the pending queue and draft the call on each item
//
// Reads every pending / in-progress action (system alerts excluded — they
// are not decisions), asks Haiku to order them by what moves a deal or
// protects money TODAY, and to draft a one-line call plus the why for each.
// The result is stamped on each action as metadata.desk so the Action
// Centre shows it inline. Steps, not Thoughts: the founder still decides;
// the desk just means every card opens with a recommendation instead of a
// blank.
//
// Feature 'founder_desk' — routable from Settings → AI models.
// ────────────────────────────────────────────────────────────────────────────

const DESK_MAX_ACTIONS = 40;

export type DeskCall = {
  id: string;
  rank: number;
  title: string;
  call: string;
  why: string;
};

const DESK_SCHEMA = z.object({
  calls: z.array(
    z.object({
      id: z.string(),
      rank: z.number().int().min(1),
      call: z.string().max(160),
      why: z.string().max(240),
    })
  ),
});

const DESK_SYSTEM_PROMPT = `You are the Chief of Staff for Kept, a UK direct-to-vendor property buyer. The founder is dyslexic and time-poor.

You receive the founder's pending action queue. For EVERY action return:
- rank: 1 = do first. Order by what moves a deal or protects money today: a binding-offer deadline, a vendor waiting on a reply, a held email, an auction this week, then reviews of new leads, then admin.
- call: ONE line, imperative, under 20 words, that the founder can act on as written. Name the decision, not the task. Good: "Approve the hold — the vendor asked for a call back, no price yet." Bad: "Review this item."
- why: under 30 words. The single fact that justifies the call.

Rules:
- Use only the information given. Never invent addresses, prices or dates.
- Every id exactly once. No extra ids.
- Plain English. No jargon, no hedging.`;

async function rankFounderDesk(): Promise<DeskCall[]> {
  const actions = await database.founderAction.findMany({
    where: {
      status: { in: ['pending', 'in_progress'] },
      agent: { not: 'system' },
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    take: DESK_MAX_ACTIONS,
    select: {
      id: true,
      type: true,
      priority: true,
      title: true,
      description: true,
      createdAt: true,
      expiresAt: true,
      metadata: true,
    },
  });
  if (actions.length === 0) return [];

  const block = actions
    .map((a) => {
      const ageDays = Math.floor((Date.now() - a.createdAt.getTime()) / 86_400_000);
      const desc = (a.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
      return [
        `id: ${a.id}`,
        `type: ${a.type} · priority: ${a.priority} · age: ${ageDays}d${a.expiresAt ? ` · expires: ${a.expiresAt.toISOString().slice(0, 10)}` : ''}`,
        `title: ${a.title}`,
        desc ? `detail: ${desc}` : null,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n---\n');

  const result = await callClaudeForObject<z.infer<typeof DESK_SCHEMA>>({
    system: DESK_SYSTEM_PROMPT,
    user: `Pending queue (${actions.length} items):\n\n${block}`,
    schema: DESK_SCHEMA,
    maxTokens: 3000,
    temperature: 0.2,
    model: CLAUDE_HAIKU,
    feature: 'founder_desk',
    attemptTimeoutMs: 60_000,
  });
  if (!result) return [];

  const byId = new Map(actions.map((a) => [a.id, a]));
  const seen = new Set<string>();
  const calls: DeskCall[] = [];
  for (const c of result.calls) {
    // The model cannot rank actions it was not given, or rank one twice.
    const action = byId.get(c.id);
    if (!action || seen.has(c.id)) continue;
    seen.add(c.id);
    calls.push({
      id: c.id,
      rank: c.rank,
      title: action.title,
      call: c.call.trim(),
      why: c.why.trim(),
    });
  }
  calls.sort((a, b) => a.rank - b.rank);
  // Re-number so ranks are dense whatever the model returned.
  calls.forEach((c, i) => {
    c.rank = i + 1;
  });

  const at = new Date().toISOString();
  await Promise.all(
    calls.map((c) => {
      const existing = byId.get(c.id)?.metadata;
      const base =
        existing && typeof existing === 'object' && !Array.isArray(existing)
          ? (existing as Record<string, unknown>)
          : {};
      return database.founderAction
        .update({
          where: { id: c.id },
          data: {
            metadata: { ...base, desk: { rank: c.rank, call: c.call, why: c.why, at } },
          },
        })
        .catch((err: unknown) =>
          console.warn('[cron/pipeline-summary] desk stamp failed', c.id, err)
        );
    })
  );

  return calls;
}
