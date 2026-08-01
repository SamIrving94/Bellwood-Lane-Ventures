import { env } from '@/env';
import { database } from '@repo/database';
import { NextResponse } from 'next/server';

// Daily sweep of expired rate-limit counters.
//
// checkRateLimit writes one RateLimitCounter row per (bucket, subject, window).
// Nothing read those rows once their window closed, so without this they
// accumulate forever — and the subject is caller-influenced (IP, submitted
// email, track token), so a bot hitting a public endpoint grows the table with
// rows that will never be consulted again.
//
// Rows are only useful until expiresAt, so anything past it is safe to drop.
// A day of slack is kept so a clock skew between instances cannot delete a
// window that is still counting.
const SLACK_MS = 24 * 60 * 60 * 1000;

export const POST = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - SLACK_MS);

  const { count } = await database.rateLimitCounter.deleteMany({
    where: { expiresAt: { lt: cutoff } },
  });

  return NextResponse.json({ ok: true, deleted: count, cutoff });
};

// Vercel cron sends GET by default.
export const GET = POST;
