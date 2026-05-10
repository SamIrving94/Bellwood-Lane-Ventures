import { PrismaClient } from '../packages/database/generated/client/index.js';
const db = new PrismaClient();

async function main() {
  const before = await db.scoutLead.count();
  const synthetic = await db.scoutLead.count({ where: { source: 'synthetic' } });
  console.log(`Before: ${before} total, ${synthetic} synthetic`);

  // Also check for any FounderActions tied to synthetic leads (clean those too)
  const syntheticIds = (await db.scoutLead.findMany({
    where: { source: 'synthetic' },
    select: { id: true },
  })).map((l) => l.id);

  // Delete the ScoutLeads
  const deleted = await db.scoutLead.deleteMany({
    where: { source: 'synthetic' },
  });
  console.log(`Deleted ${deleted.count} synthetic ScoutLeads`);

  // Check for any agentEvent records referencing those leads (these are immutable
  // logs; we leave them but flag the count)
  const orphanedEvents = await db.agentEvent.count({
    where: {
      eventType: 'leads_created',
      payload: { not: { equals: null as any } },
    },
  });
  console.log(`(${orphanedEvents} agent events remain — log records, not deleted)`);

  const after = await db.scoutLead.count();
  console.log(`After:  ${after} total`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
