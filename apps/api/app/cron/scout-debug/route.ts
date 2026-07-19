import { env } from '@/env';
import { database } from '@repo/database';
import { runScoutingPipeline, mergeScorerConfig } from '@repo/scouting';
import { NextResponse } from 'next/server';

export const maxDuration = 300;

/**
 * GET / POST /cron/scout-debug
 *
 * Diagnostic-only route. Runs the scouting pipeline with the same config the
 * daily cron uses, but returns a verbose per-source breakdown so we can see
 * EXACTLY which sources produced data, which silently returned 0, and which
 * threw. Does NOT persist any leads or create FounderActions — read-only.
 *
 * Use this when scouting "should be running but isn't producing leads" — the
 * response tells you whether the cron itself is broken, an API key is
 * missing, a source is rate-limited, or there genuinely are 0 leads to find.
 *
 * Auth: same CRON_SECRET as production crons. Can be invoked manually:
 *
 *   curl -X POST https://bellwood-api.vercel.app/cron/scout-debug \
 *     -H "Authorization: Bearer $CRON_SECRET" | jq .
 */
async function handle(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const envSnapshot = {
    PROPERTYDATA_API_KEY: Boolean(process.env.PROPERTYDATA_API_KEY),
    COMPANIES_HOUSE_API_KEY: Boolean(process.env.COMPANIES_HOUSE_API_KEY),
    HMCTS_PROBATE_API_KEY: Boolean(process.env.HMCTS_PROBATE_API_KEY),
    OS_PLACES_API_KEY: Boolean(process.env.OS_PLACES_API_KEY),
    EPC_API_TOKEN: Boolean(process.env.EPC_API_TOKEN),
    ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
    CRON_SECRET: Boolean(process.env.CRON_SECRET),
  };

  // Read scouting.areas the same way the production cron does.
  type Area = {
    label?: string;
    seedPostcode: string;
    district: string;
    radiusMiles: number;
  };
  let areas: Area[] = [];
  let areasSource: 'scouting.areas' | 'legacy_fallback' | 'env_fallback' | 'none' =
    'none';

  try {
    const areasSetting = await database.setting.findUnique({
      where: { key: 'scouting.areas' },
    });
    if (areasSetting && Array.isArray(areasSetting.value)) {
      areas = (areasSetting.value as unknown[]).flatMap((raw) => {
        if (!raw || typeof raw !== 'object') return [];
        const a = raw as Record<string, unknown>;
        const seedPostcode =
          typeof a.seedPostcode === 'string' ? a.seedPostcode : null;
        const district = typeof a.district === 'string' ? a.district : null;
        const radiusMiles =
          typeof a.radiusMiles === 'number' ? a.radiusMiles : 1.5;
        const label = typeof a.label === 'string' ? a.label : undefined;
        if (!seedPostcode || !district) return [];
        return [{ seedPostcode, district, radiusMiles, label }];
      });
      if (areas.length > 0) areasSource = 'scouting.areas';
    }
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        stage: 'read_scouting_areas',
        error: (err as Error)?.message ?? String(err),
      },
      { status: 500 },
    );
  }

  if (areas.length === 0) {
    return NextResponse.json({
      ok: false,
      stage: 'config',
      reason: 'no_scan_seeds',
      hint:
        'scouting.areas Setting is empty and no legacy fallback resolved. Configure target postcodes in /settings/scouting.',
      env: envSnapshot,
    });
  }

  const scanSeeds = areas.map((a) => ({
    label: a.label,
    postcode: a.seedPostcode,
    radiusMiles: a.radiusMiles,
  }));
  const districts = Array.from(new Set(areas.map((a) => a.district)));

  // Active EvalConfig version.
  let evalConfigVersion: number | null = null;
  try {
    const active = await database.evalConfig.findFirst({
      where: { evalType: 'lead_scoring', activatedAt: { not: null } },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    evalConfigVersion = active?.version ?? null;
  } catch {
    // Non-fatal — pipeline falls back to defaults.
  }

  const startedAt = Date.now();
  let result:
    | Awaited<ReturnType<typeof runScoutingPipeline>>
    | { thrown: string }
    | null = null;

  try {
    result = await runScoutingPipeline({
      limit: 50,
      minScore: 0, // catch everything in diag mode
      sourcedPropertyPostcodes: districts,
      scanSeeds,
      scorerConfig: mergeScorerConfig(null),
      evalConfigVersion,
    });
  } catch (err) {
    result = { thrown: (err as Error)?.message ?? String(err) };
  }

  const durationMs = Date.now() - startedAt;

  return NextResponse.json({
    ok: result && !('thrown' in result),
    durationMs,
    env: envSnapshot,
    config: {
      areasSource,
      areaCount: areas.length,
      districtCount: districts.length,
      seedCount: scanSeeds.length,
      evalConfigVersion,
    },
    result,
    hint:
      result && 'thrown' in result
        ? 'Pipeline threw — see result.thrown for the error message'
        : 'Compare result.sources counts vs result.sourceErrors to see which feeds work and which fail',
  });
}

export const POST = handle;
export const GET = handle;
