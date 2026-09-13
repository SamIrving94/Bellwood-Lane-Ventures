/**
 * One-off: dump ScoutLeads for E11 (Wanstead) + E18 (South Woodford).
 *
 *   npx tsx scripts/report-e11-e18-leads.mts <ISO since> [out.json]
 *
 * Selects leads created at/after <since> whose postcode sits in E11 or E18
 * (outward-code match, so "E1 1AA" never leaks in). Prints a compact line
 * per lead and, when an output path is given, writes the full rows as JSON
 * for downstream formatting. Read-only.
 */

import { writeFileSync } from 'node:fs';
import { PrismaClient } from '../packages/database/generated/client/index.js';
import { loadProdEnv } from './prod-env.mts';

loadProdEnv();

const sinceArg = process.argv[2];
if (!sinceArg || Number.isNaN(Date.parse(sinceArg))) {
  throw new Error(
    'usage: npx tsx scripts/report-e11-e18-leads.mts <ISO since> [out.json]'
  );
}
const outPath = process.argv[3];
const since = new Date(sinceArg);

/** Outward code = everything before the inward "digit + 2 letters" tail. */
function outward(postcode: string): string {
  const compact = postcode.replace(/\s+/g, '').toUpperCase();
  const m = compact.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)\d[A-Z]{2}$/);
  return m ? (m[1] as string) : compact;
}

const db = new PrismaClient();
try {
  const rows = await db.scoutLead.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { leadScore: 'desc' },
    select: {
      id: true,
      address: true,
      postcode: true,
      source: true,
      leadType: true,
      track: true,
      leadScore: true,
      verdict: true,
      estimatedEquityPence: true,
      sourceTrail: true,
      createdAt: true,
      rawPayload: true,
    },
  });

  const wanted = rows.filter((r) => ['E11', 'E18'].includes(outward(r.postcode)));

  const shaped = wanted.map((r) => {
    const raw = (r.rawPayload ?? {}) as Record<string, unknown>;
    const pd = (raw.propertyData ?? {}) as Record<string, unknown>;
    const text = [pd.summary, raw.rationale, r.leadType, r.source]
      .filter((v): v is string => typeof v === 'string')
      .join(' | ');
    return {
      district: outward(r.postcode),
      address: r.address,
      postcode: r.postcode,
      source: r.source,
      leadType: r.leadType,
      track: r.track,
      leadScore: r.leadScore,
      verdict: r.verdict,
      bedrooms: typeof pd.bedrooms === 'number' ? pd.bedrooms : null,
      propertyType: typeof pd.propertyType === 'string' ? pd.propertyType : null,
      pricePence: typeof pd.pricePence === 'number' ? pd.pricePence : null,
      estimatedEquityPence: r.estimatedEquityPence,
      summary: typeof pd.summary === 'string' ? pd.summary : null,
      gardenMentioned: /\bgardens?\b/i.test(text),
      chainFree: /chain[- ]?free|no (?:onward )?chain/i.test(text),
      unmodernised: /unmodernised|needs? (?:of )?(?:modernisation|refurb|renovation|updating)|doer[- ]upper/i.test(
        text
      ),
      sourceTrail: r.sourceTrail,
      createdAt: r.createdAt.toISOString(),
      leadId: r.id,
    };
  });

  console.log(
    `Leads since ${since.toISOString()}: ${rows.length} total, ${shaped.length} in E11/E18`
  );
  for (const s of shaped) {
    console.log(
      `  [${s.district}] ${s.address} | ${s.leadType ?? s.source} | beds:${s.bedrooms ?? '?'} | £${s.pricePence ? Math.round(s.pricePence / 100).toLocaleString('en-GB') : '?'} | score:${s.leadScore} ${s.verdict} | garden:${s.gardenMentioned ? 'y' : '?'}${s.chainFree ? ' | chain-free' : ''}${s.unmodernised ? ' | unmodernised' : ''}`
    );
  }

  if (outPath) {
    writeFileSync(outPath, JSON.stringify(shaped, null, 2));
    console.log(`\nWrote ${shaped.length} rows to ${outPath}`);
  }
} finally {
  await db.$disconnect();
}
