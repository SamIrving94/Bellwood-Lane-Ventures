import { env } from '@/env';
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
    // Top 3 highest-priority pending actions — input for the LLM briefing
    database.founderAction.findMany({
      where: { status: { in: ['pending', 'in_progress'] } },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take: 3,
      select: { title: true, priority: true },
    }),
    // Top 5 STRONG leads from overnight — input for the LLM briefing
    database.scoutLead.findMany({
      where: { createdAt: { gte: todayStart }, verdict: 'STRONG' },
      orderBy: { score: 'desc' },
      take: 5,
      select: { address: true, postcode: true, score: true, leadType: true },
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

  lines.push(`\n**Total pending actions:** ${pendingActions}`);

  const summaryTitle = `Morning briefing: ${newLeadsToday} leads, ${pendingActions} actions pending`;
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

  // Only create summary if there's something to report
  if (hasActivity || pendingActions > 0) {
    await database.founderAction.create({
      data: {
        type: 'general',
        priority: hasCritical ? 'high' : 'medium',
        title: summaryTitle,
        description: summaryBody,
        agent: 'orchestrator',
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
    score: number | null;
    leadType: string | null;
  }>;
}

const BRIEFING_SYSTEM_PROMPT = `You are the Chief of Staff for Bellwood Ventures, a UK property deal-sourcer.

Your job: write the founder's 4-bullet morning briefing. The founder is dyslexic — short sentences, plain English, no jargon, no marketing fluff.

Rules:
- Exactly 4 bullets, in this order:
  1. **Overnight movement** — what changed since yesterday (new leads, valuations done, emails sent)
  2. **What needs your eyes today** — the highest-priority pending actions (be specific, name titles)
  3. **Watch-outs** — SLA breaches, held vendor emails, anything blocking
  4. **Recommended first move** — one concrete action, e.g. "Open /quotes — 2 agent submissions are at hour 18 of 24"
- Each bullet ≤ 25 words.
- Use **bold** for numbers and key entities.
- If a category has nothing in it, say so plainly — don't pad.
- Return ONLY the 4 bullets in Markdown, no preamble, no closing line.`;

async function buildLlmBriefing(input: BriefingInput): Promise<string | null> {
  const leadLines =
    input.topStrongLeads.length === 0
      ? '(none)'
      : input.topStrongLeads
          .map(
            (l) =>
              `- ${l.address ?? '?'} ${l.postcode ?? ''} · ${l.leadType ?? '?'} · score ${l.score ?? '?'}`,
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
    `- total pending founder actions: ${input.pendingActions}`,
    '',
    'Top 3 pending actions:',
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
