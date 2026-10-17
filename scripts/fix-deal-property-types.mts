/**
 * Backfill for the lead→deal property-type bug (data-quality spec, step 1).
 *
 * Conversion wrote the lead's SELLER type ("probate", "chain_break" …) into
 * Deal.propertyType, so those deals were valued as terraced houses with no
 * bedroom count. This lists every deal whose type isn't a property type,
 * re-derives the type from the lead it came from, and flags the ones whose
 * valuation already ran on the wrong type.
 *
 * Dry run by default — prints what it would change and writes nothing.
 *   npx tsx scripts/run-with-prod-env.mts scripts/fix-deal-property-types.mts
 * Apply:
 *   … scripts/fix-deal-property-types.mts --apply
 *
 * --apply only fills in a type the lead actually states. A deal whose lead
 * has no type is left as "unknown" (the deal page now says so) — never
 * guessed. Existing valuations are not touched: they are history, and the
 * activity note tells the founder to re-run them.
 */
import { PrismaClient } from '../packages/database/generated/client/index.js';
import * as TypeNs from '../packages/property-data/src/property-type.ts';

// @repo/property-data has no `"type": "module"`, so under tsx its TS source
// arrives CJS-wrapped with named exports under `default` (same unwrap as
// scripts/avm-backtest.mts).
function unwrap<T>(ns: T): T {
  return ((ns as { default?: T }).default ?? ns) as T;
}
const { canonicalPropertyType } = unwrap(TypeNs);

const db = new PrismaClient();
const apply = process.argv.includes('--apply');

function leadFacts(rawPayload: unknown) {
  const pd = (rawPayload as { propertyData?: Record<string, unknown> } | null)
    ?.propertyData;
  const beds = pd?.bedrooms;
  return {
    type: canonicalPropertyType(
      typeof pd?.propertyType === 'string' ? pd.propertyType : null
    ),
    bedrooms:
      typeof beds === 'number' && Number.isInteger(beds) && beds > 0
        ? beds
        : null,
  };
}

async function main() {
  const deals = await db.deal.findMany({
    select: {
      id: true,
      address: true,
      postcode: true,
      propertyType: true,
      bedrooms: true,
      convertedFromLeadId: true,
      ourOfferPence: true,
      _count: { select: { avmResults: true } },
    },
  });
  const bad = deals.filter(
    (d) => canonicalPropertyType(d.propertyType) === null
  );

  console.log(`${deals.length} deals, ${bad.length} without a property type.`);
  console.log(apply ? 'APPLYING changes.\n' : 'Dry run — nothing written.\n');

  let fixed = 0;
  let stillUnknown = 0;
  let valuedWrong = 0;
  for (const d of bad) {
    const lead = d.convertedFromLeadId
      ? await db.scoutLead.findUnique({
          where: { id: d.convertedFromLeadId },
          select: { rawPayload: true },
        })
      : null;
    const facts = leadFacts(lead?.rawPayload);
    const valued = d._count.avmResults > 0 || d.ourOfferPence !== null;
    if (valued) valuedWrong++;

    const to = facts.type ?? 'unknown';
    const bedsTo = d.bedrooms ?? facts.bedrooms;
    console.log(
      [
        d.id,
        `${d.address}, ${d.postcode}`.slice(0, 50).padEnd(50),
        `"${d.propertyType}" -> "${to}"`,
        bedsTo !== d.bedrooms ? `beds -> ${bedsTo}` : '',
        valued ? `VALUED AS TERRACED (${d._count.avmResults} runs)` : '',
      ]
        .filter(Boolean)
        .join('  ')
    );

    if (!facts.type) stillUnknown++;
    if (!apply) continue;

    await db.deal.update({
      where: { id: d.id },
      data: { propertyType: to, bedrooms: bedsTo },
    });
    await db.dealActivity.create({
      data: {
        dealId: d.id,
        action: 'property_type_corrected',
        detail: `Property type corrected from "${d.propertyType}" to "${to}"${
          bedsTo !== d.bedrooms ? `, bedrooms set to ${bedsTo}` : ''
        } (lead-conversion bug).${
          valued
            ? ' Earlier valuations assumed a terraced house. Re-run the valuation before using the offer.'
            : ''
        }`,
      },
    });
    if (facts.type) fixed++;
  }

  console.log(
    `\n${bad.length} affected · ${valuedWrong} already valued on the wrong type · ` +
      `${bad.length - stillUnknown} have a type on their lead · ${stillUnknown} stay "unknown".`
  );
  if (apply)
    console.log(`Updated ${bad.length} deals (${fixed} with a real type).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
