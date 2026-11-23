/**
 * Clear the "Deal flow" notification badge: dismiss every open FounderAction
 * EXCEPT blog-post reviews (type `approve_blog_draft`).
 *
 * Founder request (22 Nov 2026): "clear all notifications from the deal flow
 * except for those related to reviewing blog posts".
 *
 * The badge counts FounderActions with status pending | in_progress (see
 * apps/app/app/(authenticated)/layout.tsx). We set those to `dismissed` —
 * never delete — so the history stays in the DB and can be reversed by id.
 *
 * Dry run by default (prints counts per type). Add --write to apply:
 *
 *   npx tsx scripts/run-with-prod-env.mts scripts/clear-founder-actions.mts
 *   npx tsx scripts/run-with-prod-env.mts scripts/clear-founder-actions.mts --write
 */

import { PrismaClient } from '../packages/database/generated/client/index.js';

const db = new PrismaClient();
const write = process.argv.includes('--write');

const KEEP_TYPES = ['approve_blog_draft'] as const;

async function main() {
  const byType = await db.founderAction.groupBy({
    by: ['type'],
    where: { status: { in: ['pending', 'in_progress'] } },
    _count: { _all: true },
  });

  let toClear = 0;
  let kept = 0;
  console.log('Open actions by type:');
  for (const row of byType.sort((a, b) => b._count._all - a._count._all)) {
    const keep = (KEEP_TYPES as readonly string[]).includes(row.type);
    console.log(
      `  ${keep ? 'KEEP ' : 'CLEAR'}  ${row.type.padEnd(28)} ${row._count._all}`
    );
    if (keep) {
      kept += row._count._all;
    } else {
      toClear += row._count._all;
    }
  }
  console.log(`\nWill dismiss ${toClear}, keep ${kept} blog reviews.`);

  if (!write) {
    console.log('Dry run — nothing changed. Re-run with --write to apply.');
    return;
  }

  const result = await db.founderAction.updateMany({
    where: {
      status: { in: ['pending', 'in_progress'] },
      type: { notIn: [...KEEP_TYPES] },
    },
    data: {
      status: 'dismissed',
      resolvedAt: new Date(),
      resolvedBy: 'script:clear-founder-actions',
    },
  });
  console.log(`Dismissed ${result.count} actions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
