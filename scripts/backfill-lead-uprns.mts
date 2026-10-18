/**
 * One-off UPRN backfill for existing leads and deals (Oct 2026).
 *
 * The daily lead-appraise cron stamps UPRNs 25 leads at a time, and until the
 * OS Places → PropertyData swap no lead could reach "high" (OS Places had been
 * failing silently). This runs the same matcher over every lead and deal that
 * still needs one, in one go:
 *
 *   - never checked;
 *   - checked and unresolved for a reason that can change (no_match,
 *     ambiguous, sources_disagree);
 *   - resolved at "medium" from EPC alone, which a second source can now
 *     confirm (it never downgrades: a medium that PropertyData can't confirm
 *     keeps its UPRN).
 *
 * Dry run by default: prints what it would write and the credit estimate.
 * ALWAYS pass --cache-dir (outside the repo) so the --write run reuses the
 * dry run's PropertyData answers instead of buying them again:
 *   export EPC_API_TOKEN=… PROPERTYDATA_API_KEY=…   (from apps/api/.env.local)
 *   npx tsx --conditions=react-server scripts/run-with-prod-env.mts scripts/backfill-lead-uprns.mts --cache-dir=<tmp folder>
 * Apply:
 *   … scripts/backfill-lead-uprns.mts --cache-dir=<same folder> --write
 *
 * Same write shape as apps/api/app/cron/_lib/uprn.ts. A lead whose sources
 * were both unreachable is NOT stamped (an outage is not a no-match). A
 * converted lead's deal gets the same UPRN unless one was set by hand.
 * Street-only addresses are refused before any lookup, so they cost nothing;
 * each other postcode costs ~6-9 PropertyData credits once (cached 60 days
 * in-process). `--conditions=react-server` lets the server-only PropertyData
 * client load outside Next.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PrismaClient } from '../packages/database/generated/client/index.js';
import * as EpcNs from '../packages/property-data/src/epc.ts';
import * as PdNs from '../packages/property-data/src/propertydata.ts';
import * as UprnNs from '../packages/property-data/src/uprn.ts';

// @repo/property-data has no `"type": "module"`, so under tsx its TS source
// arrives CJS-wrapped with named exports under `default` (same unwrap as
// scripts/avm-backtest.mts).
function unwrap<T>(ns: T): T {
  return ((ns as { default?: T }).default ?? ns) as T;
}
const { addressKey, isFullPostcode, resolveUprn } = unwrap(UprnNs);
const { searchDomesticEpc } = unwrap(EpcNs);
const { getPostcodeUprnsResult } = unwrap(PdNs);

const db = new PrismaClient();
const write = process.argv.includes('--write');

// The dry run has to make the real lookups to show real outcomes. Without a
// cache, `--write` then bought every postcode a second time (Oct 2026: ~600
// credits wasted). Each successful PropertyData answer is kept in this folder
// so a later run, dry or not, reads it back for free. Keep it outside the
// repo; PropertyData's licence allows holding a response for 60 days.
const cacheArg = process.argv.find((a) => a.startsWith('--cache-dir='));
const cacheDir = cacheArg?.slice('--cache-dir='.length) ?? null;
if (cacheDir && !existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });

const lookups = {
  async epc(postcode: string) {
    if (!process.env.EPC_API_TOKEN) return null;
    const rows = await searchDomesticEpc(postcode);
    return rows.map((r) => ({ uprn: r.uprn, address: r.address }));
  },
  async addresses(postcode: string) {
    const file = cacheDir
      ? `${cacheDir}/${postcode.replace(/\s+/g, '')}.json`
      : null;
    if (file && existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
    const res = await getPostcodeUprnsResult(postcode);
    if (res.outcome === 'failed') return null;
    const homes = res.outcome === 'ok' ? res.value : [];
    if (file) writeFileSync(file, JSON.stringify(homes));
    return homes;
  },
};
const RETRYABLE = ['no_match', 'ambiguous', 'sources_disagree'];

type Target = {
  kind: 'lead' | 'deal';
  id: string;
  address: string;
  postcode: string;
  current: { uprn: string | null; confidence: string | null };
  dealId: string | null;
};

function needsCheck(r: {
  uprn: string | null;
  uprnConfidence: string | null;
  uprnSources: string | null;
  uprnReason: string | null;
  uprnCheckedAt: Date | null;
}): boolean {
  if (!r.uprnCheckedAt) return true;
  if (!r.uprn) return RETRYABLE.includes(r.uprnReason ?? '');
  return r.uprnConfidence === 'medium' && r.uprnSources === 'epc';
}

const uprnFields = {
  uprn: true,
  uprnConfidence: true,
  uprnSources: true,
  uprnReason: true,
  uprnCheckedAt: true,
} as const;

async function main() {
  const [leads, deals] = await Promise.all([
    db.scoutLead.findMany({
      select: {
        id: true,
        address: true,
        postcode: true,
        rawPayload: true,
        convertedDealId: true,
        ...uprnFields,
      },
    }),
    db.deal.findMany({
      where: { convertedFromLeadId: null },
      select: { id: true, address: true, postcode: true, ...uprnFields },
    }),
  ]);

  const targets: Target[] = [
    ...leads.filter(needsCheck).map((l): Target => {
      // The listing's house-numbered address beats the display address.
      const pd = (l.rawPayload as Record<string, unknown> | null)
        ?.propertyData as Record<string, unknown> | undefined;
      return {
        kind: 'lead',
        id: l.id,
        address:
          typeof pd?.preciseAddress === 'string'
            ? pd.preciseAddress
            : l.address,
        postcode: l.postcode,
        current: { uprn: l.uprn, confidence: l.uprnConfidence },
        dealId: l.convertedDealId,
      };
    }),
    ...deals.filter(needsCheck).map(
      (d): Target => ({
        kind: 'deal',
        id: d.id,
        address: d.address,
        postcode: d.postcode,
        current: { uprn: d.uprn, confidence: d.uprnConfidence },
        dealId: null,
      })
    ),
  ];

  const postcodesToLookUp = new Set(
    targets
      .filter(
        (t) =>
          isFullPostcode(t.postcode) &&
          addressKey(t.address).designator !== null
      )
      .map((t) => t.postcode.toUpperCase().replace(/\s+/g, ' ').trim())
  );
  console.log(
    `${leads.length} leads, ${deals.length} standalone deals; ${targets.length} need a check.`
  );
  console.log(
    `${postcodesToLookUp.size} postcodes to look up (~${postcodesToLookUp.size * 6}-${postcodesToLookUp.size * 9} PropertyData credits). The rest are street-only or have no full postcode: no lookup.`
  );
  console.log(write ? 'WRITING.\n' : 'Dry run: nothing written.\n');

  const tally: Record<string, number> = {};
  let written = 0;
  for (const t of targets) {
    const r = await resolveUprn(
      { address: t.address, postcode: t.postcode },
      lookups
    );
    const outcome = r.uprn ? `resolved ${r.confidence}` : (r.reason as string);
    tally[outcome] = (tally[outcome] ?? 0) + 1;
    if (r.reason === 'sources_unavailable') continue;
    // Never downgrade: an EPC-only match PropertyData can't confirm keeps it.
    if (t.current.uprn && (!r.uprn || r.uprn !== t.current.uprn)) {
      if (r.uprn) {
        console.log(
          `  CHANGED? ${t.kind} ${t.id}: ${t.current.uprn} -> ${r.uprn} (left as is; check by hand)`
        );
      }
      continue;
    }
    if (r.uprn) {
      console.log(
        `  ${t.kind} ${t.id}  ${r.confidence?.padEnd(6)}  ${r.uprn.padEnd(13)}  ${t.address.slice(0, 55)}`
      );
    }
    if (!write) continue;

    const data = {
      uprn: r.uprn,
      uprnConfidence: r.confidence,
      uprnSources: r.sources.length ? r.sources.join(',') : null,
      uprnReason: r.reason,
      uprnCheckedAt: new Date(),
    };
    if (t.kind === 'lead') {
      await db.scoutLead.update({ where: { id: t.id }, data });
      if (r.uprn && t.dealId) {
        await db.deal.updateMany({
          where: {
            id: t.dealId,
            OR: [{ uprn: null }, { uprn: r.uprn }],
          },
          data,
        });
      }
    } else {
      await db.deal.update({ where: { id: t.id }, data });
    }
    written++;
  }

  console.log('\nOutcomes:', tally);
  if (write) console.log(`Wrote ${written} rows.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
