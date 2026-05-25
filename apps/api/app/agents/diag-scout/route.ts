import { NextResponse } from 'next/server';
import { database, Prisma } from '@repo/database';
import { runScoutingPipeline } from '@repo/scouting';
import { validateAgentAuth, unauthorizedResponse } from '../_lib/auth';

export const maxDuration = 300;
export const runtime = 'nodejs';

/**
 * POST /agents/diag-scout
 *
 * Triggers a real scouting run + persistence, returns counts. Same code
 * path as /cron/scouting but auth'd via BELLWOOD_API_KEY so we can test
 * without the cron secret.
 */
export const POST = async (request: Request) => {
  if (!validateAgentAuth(request)) return unauthorizedResponse();

  // Read scan areas from Setting (same logic as the cron)
  type ScanSeed = { label?: string; postcode: string; radiusMiles: number };
  let scanSeeds: ScanSeed[] = [];
  let districts: string[] = [];

  const areasSetting = await database.setting.findUnique({
    where: { key: 'scouting.areas' },
  });
  if (areasSetting && Array.isArray(areasSetting.value)) {
    const areas = (areasSetting.value as unknown[]).flatMap((raw) => {
      if (!raw || typeof raw !== 'object') return [];
      const a = raw as Record<string, unknown>;
      const seedPostcode =
        typeof a.seedPostcode === 'string' ? a.seedPostcode : null;
      const district = typeof a.district === 'string' ? a.district : null;
      const radiusMiles =
        typeof a.radiusMiles === 'number' ? a.radiusMiles : 1.5;
      if (!seedPostcode || !district) return [];
      return [{ seedPostcode, district, radiusMiles }];
    });
    scanSeeds = areas.map((a) => ({
      postcode: a.seedPostcode,
      radiusMiles: a.radiusMiles,
    }));
    districts = Array.from(new Set(areas.map((a) => a.district)));
  }

  // Fallback for diagnostics: if no areas configured yet, use a known-good
  // seed so we can verify the pipeline end-to-end without manual setup.
  if (scanSeeds.length === 0) {
    scanSeeds = [{ postcode: 'M14 5LL', radiusMiles: 3 }];
    districts = ['M14'];
  }

  const result = await runScoutingPipeline({
    limit: 50,
    minScore: 30,
    sourcedPropertyPostcodes: districts,
    scanSeeds,
  });

  let createdCount = 0;
  if (result.leads.length > 0) {
    const written = await database.scoutLead.createMany({
      data: result.leads.map((lead) => ({
        ...lead,
        rawPayload:
          lead.rawPayload === null
            ? Prisma.JsonNull
            : (lead.rawPayload as Prisma.InputJsonValue),
      })),
      skipDuplicates: true,
    });
    createdCount = written.count;
  }

  return NextResponse.json({
    ok: true,
    seedsScanned: scanSeeds.length,
    seeds: scanSeeds.map((s) => s.postcode),
    fetched: result.fetched,
    qualified: result.leads.length,
    persistedToDb: createdCount,
    strong: result.leads.filter((l) => l.verdict === 'STRONG').length,
    highScore: result.leads.filter((l) => l.leadScore >= 70).length,
    sources: result.sources,
    sourceErrors: result.sourceErrors,
    sampleLeads: result.leads.slice(0, 5).map((l) => ({
      address: l.address,
      postcode: l.postcode,
      leadScore: l.leadScore,
      verdict: l.verdict,
      source: l.source,
    })),
  });
};
