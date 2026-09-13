/**
 * One-off: print the full payload of the most recent scouting completion
 * AgentEvent (agent 'system', eventType 'leads_created', source
 * 'cron_scouting'), plus any per-area / per-district breakdown it carries.
 * Read-only. Usage: npx tsx scripts/dump-latest-scout-event.mts
 */

import { PrismaClient } from '../packages/database/generated/client/index.js';
import { loadProdEnv } from './prod-env.mts';

loadProdEnv();
const db = new PrismaClient();
try {
  const event = await db.agentEvent.findFirst({
    where: {
      agent: 'system',
      eventType: 'leads_created',
      payload: { path: ['source'], equals: 'cron_scouting' },
    },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, summary: true, payload: true },
  });
  if (!event) {
    console.log('No scouting completion event found.');
  } else {
    console.log(`at: ${event.createdAt.toISOString()}`);
    console.log(`summary: ${event.summary}`);
    console.log(JSON.stringify(event.payload, null, 2).slice(0, 12_000));
  }
} finally {
  await db.$disconnect();
}
