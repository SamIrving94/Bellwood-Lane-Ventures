import { env } from '@/env';
import { database } from '@repo/database';
import { labelInbox, syncViewingToCalendar } from '@repo/google';
import { log } from '@repo/observability/log';
import { NextResponse } from 'next/server';
import { recordCronHeartbeat } from '../_lib/heartbeat';

// Google sync (every 30 minutes). Two small jobs against the Kept Google
// account, both no-ops until it is connected in Settings → Google:
//
// 1. Label inbox mail from sellers, solicitors and agents on our deals.
//    Labels only: it never replies, archives or marks anything read.
// 2. Re-mirror viewings changed in the last few hours into the calendar.
//    The dashboard does this at booking time; this pass catches the ones
//    it missed (Google down, or a change made from the partner's form).
export const maxDuration = 300;

const VIEWING_LOOKBACK_MS = 3 * 60 * 60 * 1000;

export const POST = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Each job is isolated: a Gmail failure must not stop the calendar pass.
  const describe = (err: unknown) =>
    err instanceof Error ? err.message : String(err);

  let inbox: Awaited<ReturnType<typeof labelInbox>> | { error: string };
  try {
    inbox = await labelInbox();
  } catch (err) {
    inbox = { error: describe(err) };
    log.warn('google-sync: inbox labelling failed', inbox);
  }

  const viewings = await database.viewing.findMany({
    where: { updatedAt: { gte: new Date(Date.now() - VIEWING_LOOKBACK_MS) } },
    select: { id: true },
    take: 50,
  });
  let viewingsSynced = 0;
  let viewingErrors = 0;
  for (const { id } of viewings) {
    try {
      const result = await syncViewingToCalendar(id, env.NEXT_PUBLIC_APP_URL);
      if (result.skipped) {
        break; // Not connected: nothing else will work either.
      }
      viewingsSynced += 1;
    } catch (err) {
      viewingErrors += 1;
      log.warn('google-sync: viewing sync failed', {
        id,
        error: describe(err),
      });
    }
  }

  await recordCronHeartbeat('google-sync', {
    note: `inbox ${JSON.stringify(inbox)}, ${viewingsSynced} viewings, ${viewingErrors} errors`,
  });

  return NextResponse.json({
    success: true,
    inbox,
    viewingsSynced,
    viewingErrors,
  });
};

// Vercel cron sends GET by default. Accept either method so a manual
// POST and an automated GET both reach the same handler.
export const GET = POST;
