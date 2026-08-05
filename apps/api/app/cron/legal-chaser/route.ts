import { env } from '@/env';
import { database } from '@repo/database';
import { LEGAL_STEPS, LEGAL_STEP_BY_KEY } from '@repo/database/legal-steps';
import { NextResponse } from 'next/server';
import { recordCronHeartbeat } from '../_lib/heartbeat';

// Weekday legal chaser — the "solicitor nag" that keeps chain-free purchases
// on the ~8-10 week track instead of drifting to the market's 12-20.
//
// For every deal in conveyancing it finds steps past their target day and
// drafts a chaser email to the panel firm. Drafts are NEVER auto-sent: they
// land as a legal_flag FounderAction and go out via sendSolicitorChaser after
// founder review — same posture as vendor outreach holds.

const MAX_DEALS_PER_RUN = 50;
// Don't nag the same firm more often than this, however late the steps are.
const CHASE_COOLDOWN_DAYS = 3;

/** ISO-week bucket so the dedup key replays to zero rows within a week. */
function weekBucket(now: Date): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export const POST = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const cooldownCutoff = new Date(
    now.getTime() - CHASE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  );

  const deals = await database.deal.findMany({
    where: { status: { in: ['under_offer', 'exchanged'] } },
    select: {
      id: true,
      address: true,
      postcode: true,
      solicitorFirm: true,
      solicitorName: true,
      solicitorEmail: true,
      solicitorRef: true,
      legalChasedAt: true,
      legalSteps: {
        select: { stepKey: true, completed: true, createdAt: true },
      },
    },
    take: MAX_DEALS_PER_RUN,
  });

  let drafted = 0;
  let missingChecklist = 0;

  for (const deal of deals) {
    // Deals that predate the checklist: flag once so the founder seeds it.
    if (deal.legalSteps.length === 0) {
      missingChecklist++;
      await database.founderAction
        .create({
          data: {
            type: 'legal_flag',
            priority: 'medium',
            title: `No legal checklist: ${deal.address}`,
            description:
              'This deal is in conveyancing but has no legal steps tracked. Open the deal and seed the checklist so the chaser can drive it.',
            agent: 'system',
            dealId: deal.id,
            dedupKey: `legal-seed:${deal.id}`,
          },
        })
        .catch(() => {
          // dedupKey collision = already flagged. Fine.
        });
      continue;
    }

    // The legal clock starts when the checklist was seeded.
    const seededAt = deal.legalSteps.reduce(
      (min, s) => (s.createdAt < min ? s.createdAt : min),
      deal.legalSteps[0].createdAt
    );
    const daysSinceSeed = Math.floor(
      (now.getTime() - seededAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    const overdue = deal.legalSteps
      .filter((s) => !s.completed)
      .map((s) => LEGAL_STEP_BY_KEY[s.stepKey])
      .filter(
        (t) => t && t.owner === 'solicitor' && daysSinceSeed > t.targetDay
      )
      .sort((a, b) => a.targetDay - b.targetDay);

    if (overdue.length === 0) continue;
    if (deal.legalChasedAt && deal.legalChasedAt > cooldownCutoff) continue;

    const firmLine = deal.solicitorFirm
      ? `${deal.solicitorFirm}${deal.solicitorRef ? ` (ref ${deal.solicitorRef})` : ''}`
      : 'the panel firm';
    const greeting = deal.solicitorName
      ? `Hi ${deal.solicitorName.split(' ')[0]},`
      : 'Hi,';

    const draftSubject = `${deal.address}, ${deal.postcode}${deal.solicitorRef ? ` — ref ${deal.solicitorRef}` : ''}: progress check`;
    const draftBody = [
      greeting,
      '',
      `Quick progress check on ${deal.address}, ${deal.postcode} — we're a chain-free cash buyer on this one, so nothing is waiting on us.`,
      '',
      'Could you update us on:',
      ...overdue.map((t) => `  • ${t.label}`),
      '',
      'If anything is blocked on our side, tell us and we will clear it same day.',
      '',
      'Thanks,',
      'Kept',
    ].join('\n');

    const created = await database.founderAction
      .create({
        data: {
          type: 'legal_flag',
          priority: overdue.length >= 3 ? 'high' : 'medium',
          title: `Chase ${firmLine}: ${deal.address} (${overdue.length} step${overdue.length === 1 ? '' : 's'} overdue)`,
          description: `Day ${daysSinceSeed} of conveyancing. Overdue: ${overdue
            .map((t) => t.label)
            .join('; ')}. ${
            deal.solicitorEmail
              ? 'A chaser draft is ready — review and send from the deal page.'
              : 'No solicitor email on the deal yet — add the panel firm to send chasers.'
          }`,
          agent: 'counsel',
          dealId: deal.id,
          dedupKey: `legal-chase:${deal.id}:${weekBucket(now)}`,
          metadata: {
            draftSubject,
            draftBody,
            overdueSteps: overdue.map((t) => t.key),
            daysSinceSeed,
          },
        },
      })
      .catch(() => null); // dedupKey collision = already drafted this week

    if (created) drafted++;
  }

  if (drafted > 0) {
    await database.agentEvent.create({
      data: {
        agent: 'counsel',
        eventType: 'legal_chasers_drafted',
        summary: `Legal chaser drafted ${drafted} solicitor nudge${drafted === 1 ? '' : 's'} (${LEGAL_STEPS.length}-step checklist)`,
        count: drafted,
      },
    });
  }

  await recordCronHeartbeat('legal-chaser', {
    note: `${drafted} drafted, ${missingChecklist} missing checklist`,
  });

  return NextResponse.json({
    success: true,
    dealsChecked: deals.length,
    drafted,
    missingChecklist,
  });
};

// Vercel cron sends GET by default. Accept either method so a manual
// POST and an automated GET both reach the same handler.
export const GET = POST;
