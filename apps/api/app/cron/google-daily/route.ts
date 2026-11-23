import { env } from '@/env';
import { refreshPartnerSheet, sendMorningBrief } from '@repo/google';
import { log } from '@repo/observability/log';
import { NextResponse } from 'next/server';
import { recordCronHeartbeat } from '../_lib/heartbeat';

// Google daily (06:40 UTC). Both no-ops until the Kept Google account is
// connected in Settings → Google:
//
// 1. Morning brief: one short email from the Kept mailbox to itself.
//    Internal only, so it is sent rather than drafted.
// 2. Partner sheet: refresh the anonymised pipeline Sheet in Drive.
export const maxDuration = 120;

export const POST = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const attempt = async <T>(name: string, job: () => Promise<T>) => {
    try {
      return await job();
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      log.warn(`google-daily: ${name} failed`, { error });
      return { error };
    }
  };

  const brief = await attempt('brief', () =>
    sendMorningBrief(env.NEXT_PUBLIC_APP_URL)
  );
  const sheet = await attempt('partner sheet', () => refreshPartnerSheet());

  await recordCronHeartbeat('google-daily', {
    note: `brief ${JSON.stringify(brief)}, sheet ${'error' in sheet ? sheet.error : 'ok'}`,
  });

  return NextResponse.json({ success: true, brief, sheet });
};

// Vercel cron sends GET by default. Accept either method so a manual
// POST and an automated GET both reach the same handler.
export const GET = POST;
