import { env } from '@/env';
import { database } from '@repo/database';
import { NextResponse } from 'next/server';
import {
  CRON_MAX_STALENESS_HOURS,
  type CronName,
  readCronHeartbeat,
} from '../_lib/heartbeat';

// Cron watchdog — checks every registered cron's heartbeat and raises a single
// deduped FounderAction when one has gone silent past its window. Run this on a
// schedule that is at least as frequent as the crons it watches (e.g. hourly).
//
// Dedup bucket is the UTC day, so a persistently-dead cron produces at most one
// alert per day rather than one per watchdog run.
export const POST = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  const dayBucket = new Date().toISOString().slice(0, 10);
  const stale: Array<{ name: CronName; hoursSince: number | null }> = [];

  for (const name of Object.keys(CRON_MAX_STALENESS_HOURS) as CronName[]) {
    const hb = await readCronHeartbeat(name);
    const maxAgeMs = CRON_MAX_STALENESS_HOURS[name] * 3_600_000;

    if (!hb) {
      // No recorded success yet — either it has never run or it fails before it
      // can report. Surface it so a never-running cron doesn't stay invisible.
      stale.push({ name, hoursSince: null });
      continue;
    }

    const ageMs = now - new Date(hb.lastSuccessAt).getTime();
    if (ageMs > maxAgeMs) {
      stale.push({ name, hoursSince: Math.round(ageMs / 3_600_000) });
    }
  }

  let raised = 0;
  for (const s of stale) {
    const dedupKey = `cron-watchdog:${s.name}:${dayBucket}`;
    const description =
      s.hoursSince === null
        ? `The "${s.name}" cron has no recorded successful run. It may never have run, or is failing before it can report success. Check the Vercel cron logs for this function.`
        : `The "${s.name}" cron last succeeded ~${s.hoursSince}h ago, past its ${CRON_MAX_STALENESS_HOURS[s.name]}h window. It is likely failing or timing out. Check the Vercel cron logs for this function.`;

    try {
      await database.founderAction.create({
        data: {
          type: 'general',
          priority: 'high',
          title: `Cron "${s.name}" has gone silent`,
          description,
          agent: 'system',
          dedupKey,
          metadata: { cron: s.name, hoursSince: s.hoursSince, dayBucket },
        },
      });
      raised++;
    } catch {
      // Unique violation on dedupKey == already alerted for this cron today.
      // Any other error is non-fatal for a monitoring route; skip silently.
    }
  }

  return NextResponse.json({
    success: true,
    checked: Object.keys(CRON_MAX_STALENESS_HOURS).length,
    stale: stale.map((s) => s.name),
    raised,
  });
};

// Vercel cron sends GET by default.
export const GET = POST;
