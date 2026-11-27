import { env } from '@/env';
import { database } from '@repo/database';
import {
  importDealMail,
  labelInbox,
  syncViewingToCalendar,
} from '@repo/google';
import { log } from '@repo/observability/log';
import { NextResponse } from 'next/server';
import { digestPendingDealEmails } from '../_lib/deal-email-digest';
import { recordCronHeartbeat } from '../_lib/heartbeat';

// Google sync (every 30 minutes). Three small jobs against the Kept Google
// account, all no-ops until it is connected in Settings → Google:
//
// 1. Label inbox mail from sellers, solicitors and agents on our deals.
//    Labels only: it never replies, archives or marks anything read.
// 2. Re-mirror viewings changed in the last few hours into the calendar.
//    The dashboard does this at booking time; this pass catches the ones
//    it missed (Google down, or a change made from the partner's form).
// 3. The deal email log: read mail since the last run and keep the deal
//    mail on its deal (`importDealMail`). Read-only, apart from adding the
//    `Kept/Logged` label to what it stored. Then write the two-line read
//    for new emails (`deal_email_digest`); that part needs no Google.
export const maxDuration = 300;

/** Two-line reads written per run. A burst catches up over a few runs. */
const DIGESTS_PER_RUN = 15;

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

  let dealMail: Awaited<ReturnType<typeof importDealMail>> | { error: string };
  try {
    dealMail = await importDealMail();
  } catch (err) {
    dealMail = { error: describe(err) };
    log.warn('google-sync: deal email import failed', dealMail);
  }

  let digests:
    | Awaited<ReturnType<typeof digestPendingDealEmails>>
    | { error: string };
  try {
    digests = await digestPendingDealEmails(DIGESTS_PER_RUN);
  } catch (err) {
    digests = { error: describe(err) };
    log.warn('google-sync: deal email reads failed', digests);
  }

  await recordCronHeartbeat('google-sync', {
    note: `inbox ${JSON.stringify(inbox)}, ${viewingsSynced} viewings, ${viewingErrors} errors, deal mail ${JSON.stringify(dealMail)}, reads ${JSON.stringify(digests)}`,
  });

  return NextResponse.json({
    success: true,
    inbox,
    viewingsSynced,
    viewingErrors,
    dealMail,
    digests,
  });
};

// Vercel cron sends GET by default. Accept either method so a manual
// POST and an automated GET both reach the same handler.
export const GET = POST;
