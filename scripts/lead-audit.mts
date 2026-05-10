import { PrismaClient } from '../packages/database/generated/client/index.js';

const db = new PrismaClient();

async function main() {
  const [total, newLeads, strong, score70, byVerdict, bySource, l30, l7, l1, top5] =
    await Promise.all([
      db.scoutLead.count(),
      db.scoutLead.count({ where: { status: 'new' } }),
      db.scoutLead.count({ where: { verdict: 'STRONG', status: 'new' } }),
      db.scoutLead.count({ where: { leadScore: { gte: 70 }, status: 'new' } }),
      db.scoutLead.groupBy({ by: ['verdict'], _count: { id: true } }),
      db.scoutLead.groupBy({ by: ['source'], _count: { id: true } }),
      db.scoutLead.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } }),
      db.scoutLead.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
      db.scoutLead.count({ where: { createdAt: { gte: new Date(Date.now() - 86400000) } } }),
      db.scoutLead.findMany({
        where: { status: 'new' },
        orderBy: { leadScore: 'desc' },
        take: 5,
        select: { address: true, postcode: true, leadType: true, leadScore: true, verdict: true, createdAt: true },
      }),
    ]);

  console.log('=== ScoutLead audit ===');
  console.log('Total in DB:          ', total);
  console.log('Status: new:          ', newLeads);
  console.log('STRONG + new:         ', strong);
  console.log('Score >= 70 + new:    ', score70);
  console.log('Last 24h:             ', l1);
  console.log('Last 7d:              ', l7);
  console.log('Last 30d:             ', l30);
  console.log('');
  console.log('By verdict:');
  for (const v of byVerdict) console.log('  ', String(v.verdict).padEnd(20), v._count.id);
  console.log('');
  console.log('By source:');
  for (const s of bySource) console.log('  ', String(s.source).padEnd(20), s._count.id);
  console.log('');
  console.log('Top 5 unreviewed:');
  for (const t of top5) {
    console.log('  ', String(t.leadScore).padStart(3), '·', String(t.verdict).padEnd(8), '·', String(t.leadType).padEnd(16), '·', t.address, t.postcode);
  }
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
