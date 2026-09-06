import { env } from '@/env';
import { database } from '@repo/database';
import {
  type MedianShift,
  type ShareShift,
  compareMedianShift,
  compareShareShift,
} from '@repo/valuation';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Payload shape of the per-appraisal `avm_uncertainty` AgentEvents. Untrusted
// JSON — validate before trending, skip anything malformed.
const uncertaintyEventSchema = z.object({
  source: z.string().optional(),
  intervalWidthRatio: z.number().finite().nullable().optional(),
});

const pct = (v: number | null) =>
  v === null ? '—' : `${(v * 100).toFixed(1)}%`;

/**
 * GET/POST /cron/weekly-patterns
 *
 * Sunday-evening retrospective. Runs once a week, gathers last-7-day
 * platform activity, and creates a CEO `general` FounderAction asking
 * the CEO (Paperclip board agent) to surface patterns + a single
 * highest-leverage move for the week ahead.
 *
 * Token budget: one prompt per week. Designed to be the cheapest possible
 * "what should we change?" signal — not a daily nag.
 */
export const POST = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Idempotency — don't double-fire if Vercel retries within the same week.
  const recent = await database.founderAction.findFirst({
    where: {
      type: 'general',
      agent: 'orchestrator',
      metadata: { path: ['workflow'], equals: 'weekly_pattern_review' },
      createdAt: { gte: weekAgo },
    },
  });
  if (recent) {
    return NextResponse.json({
      ok: true,
      skipped: 'already_created_this_week',
    });
  }

  // Aggregate the week
  const [
    quotesCreated,
    quotesQuoted,
    dealsCreated,
    dealsCompleted,
    leadsCreated,
    actionsCompleted,
    actionsBreaching,
  ] = await Promise.all([
    database.quoteRequest.count({ where: { createdAt: { gte: weekAgo } } }),
    database.quoteRequest.count({
      where: { createdAt: { gte: weekAgo }, status: 'quoted' },
    }),
    database.deal.count({ where: { createdAt: { gte: weekAgo } } }),
    database.deal.count({
      where: { createdAt: { gte: weekAgo }, status: 'completed' },
    }),
    // No Lead model — count newly-scouted leads via AgentEvent instead
    database.agentEvent
      .count({
        where: {
          createdAt: { gte: weekAgo },
          eventType: { in: ['scouting_complete', 'lead_created'] },
        },
      })
      .catch(() => 0),
    database.founderAction.count({
      where: { status: 'completed', resolvedAt: { gte: weekAgo } },
    }),
    database.founderAction.count({
      where: {
        status: { in: ['pending', 'in_progress'] },
        createdAt: { lt: weekAgo },
      },
    }),
  ]);

  // ── Model-confidence trend + regime signals (the Zillow lesson) ────────
  // Median prediction-interval width this week vs last, from the
  // per-appraisal `avm_uncertainty` events. Deep appraisals run ~2× wider
  // intervals than the AVM by design, so the two instruments are trended
  // separately — a shifting mix between them must not read as degradation.
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const uncertaintyEvents = await database.agentEvent.findMany({
    where: { eventType: 'avm_uncertainty', createdAt: { gte: twoWeeksAgo } },
    select: { createdAt: true, payload: true },
  });

  const widths = {
    avm: { current: [] as number[], prior: [] as number[] },
    deep: { current: [] as number[], prior: [] as number[] },
  };
  for (const evt of uncertaintyEvents) {
    const parsed = uncertaintyEventSchema.safeParse(evt.payload);
    if (!parsed.success || typeof parsed.data.intervalWidthRatio !== 'number') {
      continue;
    }
    const family = parsed.data.source === 'deep-appraisal' ? 'deep' : 'avm';
    const bucket = evt.createdAt >= weekAgo ? 'current' : 'prior';
    widths[family][bucket].push(parsed.data.intervalWidthRatio);
  }

  // Widening only — narrowing intervals are good news, not a pattern to flag.
  const avmWidthShift = compareMedianShift(
    widths.avm.current,
    widths.avm.prior
  );
  const deepWidthShift = compareMedianShift(
    widths.deep.current,
    widths.deep.prior
  );

  // Regime-change signals from the week's sourced leads: days-on-market
  // distribution and price-drop share shifting week-over-week means the
  // market the model was calibrated on has moved. Raw SQL extracts just the
  // two scalars — rawPayload rows are far too heavy to pull whole. Entirely
  // best-effort: a failure here must never break the weekly review.
  let domShift: MedianShift | null = null;
  let dropShift: ShareShift | null = null;
  try {
    const regimeRows = await database.$queryRaw<
      Array<{ createdAt: Date; dom: number | null; reductions: number | null }>
    >`
      SELECT "createdAt",
             ("rawPayload" #>> '{propertyData,daysOnMarket}')::float AS dom,
             ("rawPayload" #>> '{propertyData,reductionCount}')::float AS reductions
      FROM "ScoutLead"
      WHERE "createdAt" >= ${twoWeeksAgo}
    `;
    const dom = { current: [] as number[], prior: [] as number[] };
    const drops = { current: [] as boolean[], prior: [] as boolean[] };
    for (const row of regimeRows) {
      const bucket = row.createdAt >= weekAgo ? 'current' : 'prior';
      if (
        typeof row.dom === 'number' &&
        Number.isFinite(row.dom) &&
        row.dom > 0
      ) {
        dom[bucket].push(row.dom);
      }
      if (
        typeof row.reductions === 'number' &&
        Number.isFinite(row.reductions)
      ) {
        drops[bucket].push(row.reductions > 0);
      }
    }
    // Either direction matters: a market suddenly slow OR suddenly fast both
    // mean the comps behind our valuations aged badly.
    domShift = compareMedianShift(dom.current, dom.prior, {
      direction: 'both',
    });
    dropShift = compareShareShift(drops.current, drops.prior);
  } catch (err) {
    console.warn('[weekly-patterns] regime-signal extraction failed', err);
  }

  const confidenceLines = [
    `- AVM interval width (median): ${pct(avmWidthShift.currentMedian)} of estimate (${avmWidthShift.currentCount} runs) vs ${pct(avmWidthShift.priorMedian)} (${avmWidthShift.priorCount}) last week`,
    ...(deepWidthShift.currentCount + deepWidthShift.priorCount > 0
      ? [
          `- Deep-appraisal 80% interval width (median): ${pct(deepWidthShift.currentMedian)} (${deepWidthShift.currentCount} runs) vs ${pct(deepWidthShift.priorMedian)} (${deepWidthShift.priorCount})`,
        ]
      : []),
    ...(domShift
      ? [
          `- Days on market for new leads (median): ${domShift.currentMedian !== null ? `${Math.round(domShift.currentMedian)}d` : '—'} vs ${domShift.priorMedian !== null ? `${Math.round(domShift.priorMedian)}d` : '—'} last week`,
        ]
      : []),
    ...(dropShift
      ? [
          `- Share of new leads with a price reduction: ${pct(dropShift.currentShare)} vs ${pct(dropShift.priorShare)} last week`,
        ]
      : []),
  ];

  const summary = [
    `Week ending ${now.toISOString().slice(0, 10)}:`,
    `- Quotes created: ${quotesCreated} (of which ${quotesQuoted} priced)`,
    `- Deals created: ${dealsCreated}, completed: ${dealsCompleted}`,
    `- New scouted leads: ${leadsCreated}`,
    `- FounderActions resolved: ${actionsCompleted}`,
    `- Stale actions (>7 days unresolved): ${actionsBreaching}`,
    '',
    'Model confidence & market signals:',
    ...confidenceLines,
  ].join('\n');

  // ── One deduped card when confidence degrades or the regime moves ──────
  // The Zillow failure mode: the model keeps sounding confident while its
  // evidence thins. When the median interval widens materially — or the
  // market's own tempo (days on market, price-drop share) jumps — the
  // founder gets exactly one card. Nothing is blocked and no scores change.
  const confidenceDegraded = avmWidthShift.material || deepWidthShift.material;
  const regimeShifted =
    Boolean(domShift?.material) || Boolean(dropShift?.material);
  let uncertaintyActionId: string | null = null;

  if (confidenceDegraded || regimeShifted) {
    const movedLines = [
      ...(avmWidthShift.material
        ? [
            `- **AVM intervals widened**: median ${pct(avmWidthShift.currentMedian)} of the estimate, from ${pct(avmWidthShift.priorMedian)} last week (${avmWidthShift.currentCount} vs ${avmWidthShift.priorCount} runs).`,
          ]
        : []),
      ...(deepWidthShift.material
        ? [
            `- **Deep-appraisal intervals widened**: median ${pct(deepWidthShift.currentMedian)} of the ARV, from ${pct(deepWidthShift.priorMedian)} last week.`,
          ]
        : []),
      ...(domShift?.material
        ? [
            `- **Days on market moved**: median ${domShift.currentMedian !== null ? `${Math.round(domShift.currentMedian)}d` : '—'} for new leads, from ${domShift.priorMedian !== null ? `${Math.round(domShift.priorMedian)}d` : '—'} last week.`,
          ]
        : []),
      ...(dropShift?.material
        ? [
            `- **Price-reduced share moved**: ${pct(dropShift.currentShare)} of new leads arrived already reduced, from ${pct(dropShift.priorShare)} last week.`,
          ]
        : []),
    ];

    try {
      const uncertaintyAction = await database.founderAction.create({
        data: {
          type: 'general',
          priority: 'high',
          agent: 'appraiser',
          title: confidenceDegraded
            ? 'Model confidence check — valuation intervals are widening'
            : 'Market shift check — this week reads differently from last',
          description: [
            'This is the Zillow check. Their pricing model kept sounding confident while the evidence under it thinned — nobody watched the width of the interval, only the middle.',
            '',
            '**What moved this week:**',
            ...movedLines,
            '',
            '**What to do:** give this week’s appraisals a closer comparables check before any offer goes out. Appraisals past the width bound are already stamped "second check required" on the lead.',
            '',
            '**What has NOT happened:** nothing is blocked, no scores changed, no offers were altered. This card is the early warning, not the brake.',
          ].join('\n'),
          // One card per weekly window, even if Vercel replays the cron.
          dedupKey: `avm_uncertainty:trend:${now.toISOString().slice(0, 10)}`,
          metadata: JSON.parse(
            JSON.stringify({
              workflow: 'avm_uncertainty_trend',
              weekEnding: now.toISOString(),
              avmWidthShift,
              deepWidthShift,
              domShift,
              dropShift,
            })
          ),
        },
      });
      uncertaintyActionId = uncertaintyAction.id;
    } catch (err) {
      // Unique dedupKey violation on a replay is the expected quiet path.
      console.warn('[weekly-patterns] uncertainty card create skipped', err);
    }
  }

  const action = await database.founderAction.create({
    data: {
      type: 'general',
      priority: 'medium',
      agent: 'orchestrator',
      title: `Weekly review — week of ${now.toISOString().slice(0, 10)}`,
      description: [
        'Once-a-week pattern review. Read the activity snapshot below, then answer three things:',
        '',
        "1. **One pattern you noticed this week** — what's working, what's stuck, what surprised you.",
        '2. **One thing to STOP doing next week** — subtraction beats addition.',
        '3. **One highest-leverage move for next week** — the single thing that, if it lands, makes the week.',
        '',
        'Post your answer as a `system_summary` AgentEvent so the platform timeline records it. Then resolve this action.',
        '',
        '---',
        '',
        summary,
        '',
        `Stale actions backlog: ${actionsBreaching}. If > 10, propose a triage pass.`,
      ].join('\n'),
      metadata: {
        assignedToAgent: 'board',
        workflow: 'weekly_pattern_review',
        weekEnding: now.toISOString(),
        snapshot: {
          quotesCreated,
          quotesQuoted,
          dealsCreated,
          dealsCompleted,
          leadsCreated,
          actionsCompleted,
          actionsBreaching,
        },
      },
    },
  });

  await database.agentEvent
    .create({
      data: {
        agent: 'system',
        eventType: 'weekly_patterns_prompt',
        summary: `Weekly pattern review queued for CEO (${quotesCreated} quotes, ${dealsCompleted} completions).`,
        count: 1,
        payload: { actionId: action.id },
      },
    })
    .catch(() => undefined);

  return NextResponse.json({
    ok: true,
    actionId: action.id,
    uncertaintyActionId,
    uncertainty: { avmWidthShift, deepWidthShift, domShift, dropShift },
    snapshot: {
      quotesCreated,
      quotesQuoted,
      dealsCreated,
      dealsCompleted,
      leadsCreated,
      actionsCompleted,
      actionsBreaching,
    },
  });
};

export const GET = POST;
