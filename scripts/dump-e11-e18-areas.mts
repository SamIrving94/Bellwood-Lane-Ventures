/**
 * One-off: print the full stored Area rows for E11 + E18 (lastProbe +
 * history), to see what the latest scout sweep found there. Read-only.
 * Usage: npx tsx scripts/dump-e11-e18-areas.mts
 */

import { PrismaClient } from '../packages/database/generated/client/index.js';
import { loadProdEnv } from './prod-env.mts';

loadProdEnv();
const db = new PrismaClient();
try {
  const row = await db.setting.findUnique({ where: { key: 'scouting.areas' } });
  const areas = Array.isArray(row?.value)
    ? (row.value as Array<Record<string, unknown>>)
    : [];
  for (const a of areas) {
    if (['E11', 'E18'].includes(String(a.district ?? '').toUpperCase())) {
      console.log(JSON.stringify(a, null, 2));
    }
  }
} finally {
  await db.$disconnect();
}
