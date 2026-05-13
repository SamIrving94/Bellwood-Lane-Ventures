import { PrismaClient } from '../packages/database/generated/client/index.js';
const db = new PrismaClient();

const DEFAULTS = [
  // Manchester / Stockport (primary patch)
  'M14', 'M19', 'M20', 'M21', 'SK4', 'SK5', 'SK7', 'SK8',
  // Leeds
  'LS1', 'LS6', 'LS8', 'LS17',
  // Sheffield
  'S1', 'S7', 'S11', 'S17',
];

async function main() {
  const existing = await db.setting.findUnique({ where: { key: 'scouting.targetPostcodes' } });
  if (existing) {
    console.log('Already seeded:', existing.value);
    return;
  }
  await db.setting.create({
    data: { key: 'scouting.targetPostcodes', value: DEFAULTS },
  });
  console.log(`Seeded ${DEFAULTS.length} default target postcodes.`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
