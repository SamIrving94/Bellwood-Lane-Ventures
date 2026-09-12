/**
 * One-off: wait for a scouting run to finish.
 *
 * The scouting cron records completion as an AgentEvent (agent 'system',
 * eventType 'leads_created', payload.source 'cron_scouting'). Poll for one
 * created after the given start time, every 2 minutes, up to 18 minutes.
 *
 *   npx tsx scripts/watch-scout-run.mts 2026-09-07T09:00:00.000Z
 */

import { PrismaClient } from '../packages/database/generated/client/index.js';
import { loadProdEnv } from './prod-env.mts';

loadProdEnv();

const sinceArg = process.argv[2];
if (!sinceArg || Number.isNaN(Date.parse(sinceArg))) {
  throw new Error('usage: npx tsx scripts/watch-scout-run.mts <ISO start time>');
}
const since = new Date(sinceArg);

const db = new PrismaClient();
const POLL_MS = 120_000;
const MAX_WAIT_MS = 18 * 60_000;
const startedPolling = Date.now();

try {
  for (;;) {
    // A transient Neon blip (P1001 etc.) must not kill an 18-minute watch —
    // treat any query failure as "not finished yet" and try again next tick.
    const event = await db.agentEvent
      .findFirst({
        where: {
        agent: 'system',
        eventType: 'leads_created',
        // Other crons (e.g. the CH stream drain) emit leads_created too —
        // only the scouting run's own completion event counts here.
        payload: { path: ['source'], equals: 'cron_scouting' },
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, createdAt: true, summary: true, payload: true },
      })
      .catch((err) => {
        console.log(
          `${new Date().toISOString()} — query failed (${err?.code ?? 'error'}), retrying next tick`
        );
        return null;
      });

    if (event) {
      console.log(`DONE at ${event.createdAt.toISOString()}`);
      console.log(`summary: ${event.summary}`);
      const payload = event.payload as Record<string, unknown> | null;
      if (payload && typeof payload === 'object') {
        const interesting = Object.fromEntries(
          Object.entries(payload).filter(
            ([, v]) => typeof v !== 'object' || v === null
          )
        );
        console.log(`payload (scalars): ${JSON.stringify(interesting)}`);
      }
      break;
    }

    if (Date.now() - startedPolling > MAX_WAIT_MS) {
      console.log(
        'TIMEOUT — no completion event after 18 minutes. Check Vercel logs for /cron/scouting.'
      );
      process.exitCode = 2;
      break;
    }

    console.log(
      `${new Date().toISOString()} — not finished yet, checking again in 2 min`
    );
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
} finally {
  await db.$disconnect();
}
