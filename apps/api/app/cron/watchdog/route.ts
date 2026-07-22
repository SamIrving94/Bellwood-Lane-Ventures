import { env } from '@/env';
import { database } from '@repo/database';
import { NextResponse } from 'next/server';
import {
  CRON_MAX_STALENESS_HOURS,
  type CronName,
  readCronHeartbeat,
} from '../_lib/heartbeat';

// Cron watchdog — checks every registered cron's heartbeat.
//
// Noise contract (the founder reviews these cards by hand):
//   - ONE open card per silent cron, ever — keyed `cron-watchdog:<name>`.
//     Repeat watchdog runs UPDATE that card (fresher hours-since) instead of
//     stacking a new card per day.
//   - When the cron recovers, its card is auto-completed. Founders should
//     only ever see alerts that are CURRENTLY true.
//   - Legacy day-bucketed cards (`cron-watchdog:<name>:<date>`) are swept by
//     the same recovery pass, clearing the historical pile-up.
export const POST = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  const stale: Array<{ name: CronName; hoursSince: number | null }> = [];
  const healthy: CronName[] = [];

  for (const name of Object.keys(CRON_MAX_STALENESS_HOURS) as CronName[]) {
    const hb = await readCronHeartbeat(name);
    const maxAgeMs = CRON_MAX_STALENESS_HOURS[name] * 3_600_000;

    if (!hb) {
      // No recorded success yet — either it has never run or it fails before
      // it can report. Surface it so a never-running cron doesn't stay
      // invisible.
      stale.push({ name, hoursSince: null });
      continue;
    }

    const ageMs = now - new Date(hb.lastSuccessAt).getTime();
    if (ageMs > maxAgeMs) {
      stale.push({ name, hoursSince: Math.round(ageMs / 3_600_000) });
    } else {
      healthy.push(name);
    }
  }

  let raised = 0;
  for (const s of stale) {
    const dedupKey = `cron-watchdog:${s.name}`;
    const title = `Cron "${s.name}" has gone silent`;
    const description =
      s.hoursSince === null
        ? `The "${s.name}" cron has no recorded successful run. It may never have run, or is failing before it can report success. Check the Vercel cron logs for this function.`
        : `The "${s.name}" cron last succeeded ~${s.hoursSince}h ago, past its ${CRON_MAX_STALENESS_HOURS[s.name]}h window. It is likely failing or timing out. Check the Vercel cron logs for this function.`;

    try {
      // Upsert: first detection creates the card; while the cron stays dead,
      // subsequent runs refresh the same card (and reopen it if it was
      // completed and the cron died again).
      await database.founderAction.upsert({
        where: { dedupKey },
        create: {
          type: 'general',
          priority: 'high',
          title,
          description,
          agent: 'system',
          dedupKey,
          metadata: { cron: s.name, hoursSince: s.hoursSince },
        },
        update: {
          status: 'pending',
          priority: 'high',
          title,
          description,
          resolvedAt: null,
          resolvedBy: null,
          metadata: { cron: s.name, hoursSince: s.hoursSince },
        },
      });
      raised++;
    } catch {
      // Non-fatal for a monitoring route.
    }
  }

  // Recovery sweep: complete every open watchdog card (current stable key OR
  // legacy day-bucketed keys) for crons that are healthy again.
  let autoResolved = 0;
  for (const name of healthy) {
    try {
      const res = await database.founderAction.updateMany({
        where: {
          dedupKey: { startsWith: `cron-watchdog:${name}` },
          status: { in: ['pending', 'in_progress'] },
        },
        data: { status: 'completed', resolvedAt: new Date() },
      });
      autoResolved += res.count;
    } catch {
      // Non-fatal.
    }
  }

  return NextResponse.json({
    success: true,
    checked: Object.keys(CRON_MAX_STALENESS_HOURS).length,
    stale: stale.map((s) => s.name),
    raised,
    autoResolved,
  });
};

// Vercel cron sends GET by default.
export const GET = POST;
