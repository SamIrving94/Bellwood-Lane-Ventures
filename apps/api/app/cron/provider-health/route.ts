import { env } from '@/env';
import { NextResponse } from 'next/server';
import { recordCronHeartbeat } from '../_lib/heartbeat';
import { runProviderHealth } from '../_lib/provider-health';

// Daily data-provider key check (06:45, before the morning appraisal crons).
// One cheap read-only call each to EPC, OS Places and PropertyData; a
// provider that flips to failing raises one deduplicated founder card. Why it
// exists and the card rules live in ../_lib/provider-health.ts.
export const maxDuration = 60;

export const POST = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { checks, raised } = await runProviderHealth();
  const failing = checks.filter((c) => c.status === 'failing');

  await recordCronHeartbeat('provider-health', {
    note:
      failing.length === 0
        ? 'all ok'
        : `failing: ${failing.map((c) => c.provider).join(', ')}`,
  });

  return NextResponse.json({ success: true, checks, raised });
};

// Vercel cron sends GET by default.
export const GET = POST;
