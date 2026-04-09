import { env } from '@/env';
import { database } from '@repo/database';
import { runScoutingPipeline } from '@repo/scouting';
import { NextResponse } from 'next/server';

// Daily scouting pipeline — runs at 7am
// Fetches new probate leads, enriches, scores, and saves to DB
export const POST = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runScoutingPipeline({ limit: 50, minScore: 30 });

  if (result.leads.length > 0) {
    await database.scoutLead.createMany({
      data: result.leads,
      skipDuplicates: true,
    });
  }

  return NextResponse.json({
    success: true,
    runDate: result.runDate.toISOString(),
    fetched: result.fetched,
    enriched: result.enriched,
    qualified: result.leads.length,
    summary: result.summary,
    gdprFieldsStripped: result.gdprStripped.length,
  });
};
