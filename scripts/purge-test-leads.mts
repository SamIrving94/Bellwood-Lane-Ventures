import { PrismaClient } from '../packages/database/generated/client/index.js';
const db = new PrismaClient();

async function main() {
  const before = await db.scoutLead.count();
  console.log(`Before: ${before} ScoutLeads in DB`);

  // Delete all remaining test/manual/non-real-source leads.
  // Per Sam: 'they aren't real, they are test entries' (13 May 2026).
  const deleted = await db.scoutLead.deleteMany({});
  console.log(`Deleted ${deleted.count} ScoutLeads`);

  const after = await db.scoutLead.count();
  console.log(`After: ${after} ScoutLeads — clean slate`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
