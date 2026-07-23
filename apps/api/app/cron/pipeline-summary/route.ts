import { env } from '@/env';
import { recordCronHeartbeat } from '../_lib/heartbeat';
import { callClaude, CLAUDE_HAIKU } from '@repo/ai/claude';
import { database } from '@repo/database';
import { NextResponse } from 'next/server';

// Pipeline Stage 4: Morning Summary (8:00am daily)
// Creates a single FounderAction summarising everything the agents did overnight
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
}

const BRIEFING_SYSTEM_PROMPT = `You are the Chief of Staff for Bellwood Ventures, a UK property deal-sourcer.

Your job: write the founder's morning briefing. The founder is dyslexic — short sentences, plain English, no jargon, no marketing fluff.

Rules:
- 1 to 4 bullets, drawn from these categories IN ORDER, skipping any with nothing in them:
  1. **Overnight movement** — new leads, valuations done, emails sent
  2. **Watch-outs** — SLA breaches, held vendor emails, anything blocking a deal
  3. **Best lead** — the single strongest overnight lead, with address area + score
  4. **First move** — one concrete action, e.g. "Open /quotes — 2 agent submissions are at hour 18 of 24"
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
