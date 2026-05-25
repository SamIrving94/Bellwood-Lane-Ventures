'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import {
  getActiveListings,
  probeSourcedByType,
  type ListTypeBreakdown,
} from '@repo/property-data/src/propertydata';
import { findPlaces } from '@repo/property-data/src/os-places';
import { revalidatePath } from 'next/cache';

const AREAS_KEY = 'scouting.areas';
const LEGACY_DISTRICTS_KEY = 'scouting.targetPostcodes';
const LEGACY_SEEDS_KEY = 'scouting.scanSeeds';

const FULL_POSTCODE_RE = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i;
const DISTRICT_RE = /^[A-Z]{1,2}\d{1,2}[A-Z]?$/i;

export type Area = {
  id: string;
  label: string;
  seedPostcode: string;
  district: string;
  radiusMiles: number;
  lastProbe: {
    listingCount: number;
    checkedAt: string;
    error: string | null;
    /** Per-list-type breakdown: which PropertyData list types work, which don't. */
    sourcedBreakdown?: ListTypeBreakdown;
    /** Active listings from /listings filtered to days_on_market >= 60. */
    staleListingCount?: number;
  } | null;
  /** Rolling 30-day listing-count history for the sparkline. */
  history?: Array<{ date: string; count: number }>;
};

function appendHistory(
  current: Area['history'] | undefined,
  count: number,
): Array<{ date: string; count: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const prev = current ?? [];
  // If we already have today's entry, replace it; otherwise append.
  const withoutToday = prev.filter((h) => h.date !== today);
  const next = [...withoutToday, { date: today, count }];
  // Keep last 30 days
  return next.slice(-30);
}

// ───────────────────────────────────────────────────────────────────────
// Input resolver
//
// Accepts: full postcode, district code, or a known town/city name.
// Returns: a seed postcode + district + radius + display label.
// Anything we can't resolve returns { ok: false } so the UI surfaces it.
// ───────────────────────────────────────────────────────────────────────

/**
 * Sample central postcode per district for the ~120 districts we expect
 * Bellwood to operate in. Manually curated from OS data. Extend by adding
 * rows — no schema changes needed. If a district isn't in here, we still
 * accept the input but the seed becomes "<DISTRICT> 1AA" as a best-guess
 * which PropertyData may or may not accept.
 */
const DISTRICT_SAMPLES: Record<string, string> = {
  // Manchester
  M1: 'M1 1AD', M2: 'M2 5DB', M3: 'M3 4FP', M4: 'M4 5DL',
  M5: 'M5 4WX', M8: 'M8 8DJ', M9: 'M9 4DG', M11: 'M11 3AD',
  M12: 'M12 5JL', M13: 'M13 9PL', M14: 'M14 5LL', M15: 'M15 6AY',
  M16: 'M16 7BD', M17: 'M17 8AS', M18: 'M18 8WJ', M19: 'M19 2FD',
  M20: 'M20 2PJ', M21: 'M21 9LD', M22: 'M22 4HW', M23: 'M23 9LX',
  // Stockport / Cheshire
  SK1: 'SK1 1ND', SK2: 'SK2 6AJ', SK3: 'SK3 8AB', SK4: 'SK4 4QR',
  SK5: 'SK5 6BX', SK6: 'SK6 4DR', SK7: 'SK7 1AB', SK8: 'SK8 1JR',
  SK9: 'SK9 1AT', SK10: 'SK10 1AA', SK12: 'SK12 1AS', SK14: 'SK14 1HJ',
  SK15: 'SK15 1AY', SK16: 'SK16 4DD',
  // Leeds
  LS1: 'LS1 4AP', LS2: 'LS2 9JT', LS6: 'LS6 3HN', LS7: 'LS7 3JB',
  LS8: 'LS8 1ED', LS11: 'LS11 5DJ', LS12: 'LS12 1AA', LS13: 'LS13 3AB',
  LS15: 'LS15 8GB', LS17: 'LS17 6BU', LS18: 'LS18 5BD', LS19: 'LS19 7BN',
  LS25: 'LS25 6AA', LS26: 'LS26 8WA', LS27: 'LS27 0HQ', LS28: 'LS28 5UJ',
  // Bradford
  BD1: 'BD1 1AB', BD2: 'BD2 4SF', BD3: 'BD3 7DH', BD5: 'BD5 8LX',
  BD7: 'BD7 1DP', BD8: 'BD8 9NS', BD9: 'BD9 5DA', BD10: 'BD10 9DF',
  BD11: 'BD11 1HW', BD12: 'BD12 7DD', BD13: 'BD13 1JZ', BD14: 'BD14 6LB',
  BD15: 'BD15 8DR', BD16: 'BD16 4LL', BD17: 'BD17 5JD', BD18: 'BD18 4SF',
  // Sheffield
  S1: 'S1 4DT', S2: 'S2 4UB', S3: 'S3 7TR', S4: 'S4 7WW', S5: 'S5 6FE',
  S6: 'S6 2WB', S7: 'S7 1FH', S8: 'S8 7DH', S9: 'S9 1AA', S10: 'S10 5BG',
  S11: 'S11 8RJ', S12: 'S12 4LJ', S13: 'S13 7AA',
  // Liverpool
  L1: 'L1 8JQ', L3: 'L3 5UF', L4: 'L4 0UF', L5: 'L5 3LF', L6: 'L6 1HD',
  L7: 'L7 7HJ', L8: 'L8 5YN', L13: 'L13 0BE', L15: 'L15 2HG',
  L17: 'L17 7AN', L18: 'L18 1HG', L25: 'L25 5JF',
  // Birmingham
  B1: 'B1 1AE', B2: 'B2 5JR', B3: 'B3 1RB', B5: 'B5 4UB',
  B12: 'B12 8AS', B13: 'B13 9JG', B14: 'B14 6AA', B15: 'B15 3HE',
  B17: 'B17 9LJ', B18: 'B18 7AL', B19: 'B19 1HG', B20: 'B20 1AS',
  // Newcastle / Gateshead
  NE1: 'NE1 4LF', NE2: 'NE2 1RH', NE3: 'NE3 1XF', NE4: 'NE4 5PB',
  NE6: 'NE6 5BB', NE8: 'NE8 1AE', NE9: 'NE9 5HA',
};

/**
 * Map of common UK town/city names → seed postcode.
 * Lowercased keys. Extend freely.
 */
const TOWN_SAMPLES: Record<string, string> = {
  manchester: 'M14 5LL',
  stockport: 'SK4 4QR',
  leeds: 'LS17 6BU',
  bradford: 'BD18 4SF',
  sheffield: 'S10 5BG',
  liverpool: 'L17 7AN',
  birmingham: 'B13 9JG',
  newcastle: 'NE2 1RH',
  gateshead: 'NE8 1AE',
  oldham: 'OL1 1QU',
  rochdale: 'OL11 1JN',
  bolton: 'BL1 1AA',
  bury: 'BL9 0DG',
  salford: 'M5 4WX',
  wigan: 'WN1 1QF',
  warrington: 'WA1 1AA',
  preston: 'PR1 2BG',
  blackburn: 'BB1 7JN',
  blackpool: 'FY1 1AA',
  huddersfield: 'HD1 1AB',
  halifax: 'HX1 1RG',
  wakefield: 'WF1 1AA',
  doncaster: 'DN1 1BG',
  rotherham: 'S60 1DX',
  barnsley: 'S70 1AA',
  derby: 'DE1 1AA',
  nottingham: 'NG1 1AA',
  leicester: 'LE1 1AA',
  coventry: 'CV1 1AA',
  wolverhampton: 'WV1 1AA',
  dudley: 'DY1 1HP',
  walsall: 'WS1 1TP',
};

function normaliseInput(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, ' ');
}

function districtFromPostcode(postcode: string): string {
  const match = postcode.toUpperCase().match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)/);
  return match?.[1] ?? postcode.toUpperCase().split(' ')[0]!;
}

function titleCase(raw: string): string {
  return raw
    .toLowerCase()
    .split(/[\s-]/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ');
}

type Resolved =
  | {
      ok: true;
      label: string;
      seedPostcode: string;
      district: string;
      radiusMiles: number;
    }
  | { ok: false; error: string };

function resolveInput(raw: string): Resolved {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: 'Please type something.' };

  const norm = normaliseInput(trimmed);
  const compact = norm.replace(/\s/g, '');

  // 1. Full postcode (M14 5LL)
  if (FULL_POSTCODE_RE.test(compact)) {
    const seed = compact.slice(0, -3) + ' ' + compact.slice(-3);
    const district = districtFromPostcode(seed);
    return {
      ok: true,
      label: seed,
      seedPostcode: seed,
      district,
      radiusMiles: 1,
    };
  }

  // 2. District code (M14)
  if (DISTRICT_RE.test(compact)) {
    const district = compact;
    const seed = DISTRICT_SAMPLES[district];
    if (seed) {
      return {
        ok: true,
        label: district,
        seedPostcode: seed,
        district,
        radiusMiles: 1.5,
      };
    }
    // Fallback: try district directly. PropertyData may accept.
    return {
      ok: true,
      label: district,
      seedPostcode: `${district} 1AA`,
      district,
      radiusMiles: 2,
    };
  }

  // 3. Town/city name
  const townKey = trimmed.toLowerCase().replace(/\s+/g, ' ').trim();
  const townSeed = TOWN_SAMPLES[townKey];
  if (townSeed) {
    const district = districtFromPostcode(townSeed);
    return {
      ok: true,
      label: titleCase(trimmed),
      seedPostcode: townSeed,
      district,
      radiusMiles: 2,
    };
  }

  return {
    ok: false,
    error: `"${trimmed}" — we couldn't resolve that. Try a full postcode (e.g. "M14 5LL"), a district code (e.g. "M14"), or a UK city name.`,
  };
}

// ───────────────────────────────────────────────────────────────────────
// Probe — hit PropertyData once on the seed and count listings
// ───────────────────────────────────────────────────────────────────────

/**
 * Probe an area honestly:
 *  - Hit /sourced-properties once PER LIST TYPE, surface breakdown
 *  - Hit /listings (active stale) once
 *  - Total = sum of working types + stale listings
 *  - If everything 422s/errors, surface that — don't pretend a 0-count
 *    "0 listings" when really we got no answer
 */
async function probeArea(
  seedPostcode: string,
  radiusMiles: number,
): Promise<{
  listingCount: number;
  error: string | null;
  sourcedBreakdown: ListTypeBreakdown;
  staleListingCount: number;
}> {
  const [sourcedBreakdown, stale] = await Promise.all([
    probeSourcedByType(seedPostcode, { radiusMiles }),
    getActiveListings(seedPostcode, {
      radiusMiles,
      minDaysOnMarket: 60,
    }).catch(() => []),
  ]);

  const sourcedTotal = Object.values(sourcedBreakdown).reduce(
    (s, b) => s + b.count,
    0,
  );

  // Did every list type fail with the SAME error? If so, surface it as
  // the area-level error so the user understands their plan/auth issue.
  const errors = Object.values(sourcedBreakdown)
    .map((b) => b.error)
    .filter((e): e is string => !!e);
  const allFailed =
    errors.length === Object.keys(sourcedBreakdown).length &&
    stale.length === 0;
  const commonError = allFailed
    ? (errors[0] ?? 'All PropertyData probes failed')
    : null;

  return {
    listingCount: sourcedTotal + stale.length,
    error: commonError,
    sourcedBreakdown,
    staleListingCount: stale.length,
  };
}

// ───────────────────────────────────────────────────────────────────────
// Persistence — single Setting key, with one-shot legacy migration
// ───────────────────────────────────────────────────────────────────────

async function loadAreas(): Promise<Area[]> {
  const setting = await database.setting.findUnique({
    where: { key: AREAS_KEY },
  });
  if (!setting || !Array.isArray(setting.value)) return [];
  return (setting.value as unknown[]).flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const a = raw as Record<string, unknown>;
    if (
      typeof a.id !== 'string' ||
      typeof a.label !== 'string' ||
      typeof a.seedPostcode !== 'string' ||
      typeof a.district !== 'string' ||
      typeof a.radiusMiles !== 'number'
    ) {
      return [];
    }
    return [
      {
        id: a.id,
        label: a.label,
        seedPostcode: a.seedPostcode,
        district: a.district,
        radiusMiles: a.radiusMiles,
        lastProbe:
          a.lastProbe && typeof a.lastProbe === 'object'
            ? (a.lastProbe as Area['lastProbe'])
            : null,
        history: Array.isArray(a.history)
          ? (a.history as Array<{ date: string; count: number }>)
          : [],
      },
    ];
  });
}

async function saveAreas(areas: Area[], userId: string): Promise<void> {
  await database.setting.upsert({
    where: { key: AREAS_KEY },
    create: { key: AREAS_KEY, value: areas as never, updatedBy: userId },
    update: { value: areas as never, updatedBy: userId },
  });
}

/**
 * One-shot migration. If scouting.areas is empty but legacy keys have data,
 * convert each legacy district + each legacy seed into a new Area row.
 */
async function migrateLegacyIfNeeded(userId: string): Promise<Area[]> {
  const existing = await loadAreas();
  if (existing.length > 0) return existing;

  const [districtsRow, seedsRow] = await Promise.all([
    database.setting.findUnique({ where: { key: LEGACY_DISTRICTS_KEY } }),
    database.setting.findUnique({ where: { key: LEGACY_SEEDS_KEY } }),
  ]);

  const districts: string[] = Array.isArray(districtsRow?.value)
    ? (districtsRow!.value as unknown[]).filter(
        (v): v is string => typeof v === 'string',
      )
    : [];

  const seeds: Array<{ label?: string; postcode: string; radiusMiles?: number }> =
    Array.isArray(seedsRow?.value)
      ? ((seedsRow!.value as unknown[])
          .filter(
            (v): v is Record<string, unknown> => !!v && typeof v === 'object',
          )
          .map((v) => ({
            label: typeof v.label === 'string' ? v.label : undefined,
            postcode: typeof v.postcode === 'string' ? v.postcode : '',
            radiusMiles:
              typeof v.radiusMiles === 'number' ? v.radiusMiles : undefined,
          }))
          .filter((s) => s.postcode))
      : [];

  const migrated: Area[] = [];
  const seen = new Set<string>();

  for (const seed of seeds) {
    const resolved = resolveInput(seed.postcode);
    if (!resolved.ok) continue;
    const key = resolved.district;
    if (seen.has(key)) continue;
    seen.add(key);
    migrated.push({
      id: `area_${key}_${Date.now()}`,
      label: seed.label ?? resolved.label,
      seedPostcode: resolved.seedPostcode,
      district: resolved.district,
      radiusMiles: seed.radiusMiles ?? resolved.radiusMiles,
      lastProbe: null,
    });
  }

  for (const d of districts) {
    const resolved = resolveInput(d);
    if (!resolved.ok) continue;
    const key = resolved.district;
    if (seen.has(key)) continue;
    seen.add(key);
    migrated.push({
      id: `area_${key}_${Date.now()}`,
      label: resolved.label,
      seedPostcode: resolved.seedPostcode,
      district: resolved.district,
      radiusMiles: resolved.radiusMiles,
      lastProbe: null,
    });
  }

  if (migrated.length > 0) {
    await saveAreas(migrated, userId);
  }
  return migrated;
}

// ───────────────────────────────────────────────────────────────────────
// Public actions
// ───────────────────────────────────────────────────────────────────────

// ───────────────────────────────────────────────────────────────────────
// Typeahead — search via OS Places, dedupe by district
// ───────────────────────────────────────────────────────────────────────

export type Suggestion = {
  label: string;
  seedPostcode: string;
  district: string;
  source: 'os-places' | 'builtin';
};

export async function searchAreaSuggestions(
  query: string,
): Promise<Suggestion[]> {
  const { userId } = await auth();
  if (!userId || !query.trim() || query.trim().length < 2) return [];

  const trimmed = query.trim();
  const out: Suggestion[] = [];
  const seen = new Set<string>();

  // 1. Built-in town/district map first — instant, no network
  const lower = trimmed.toLowerCase();
  for (const [town, postcode] of Object.entries(TOWN_SAMPLES)) {
    if (town.startsWith(lower) && out.length < 5) {
      const district = districtFromPostcode(postcode);
      if (!seen.has(district)) {
        seen.add(district);
        out.push({
          label: titleCase(town),
          seedPostcode: postcode,
          district,
          source: 'builtin',
        });
      }
    }
  }
  const upper = trimmed.toUpperCase().replace(/\s/g, '');
  for (const [district, postcode] of Object.entries(DISTRICT_SAMPLES)) {
    if (district.startsWith(upper) && out.length < 8) {
      if (!seen.has(district)) {
        seen.add(district);
        out.push({
          label: district,
          seedPostcode: postcode,
          district,
          source: 'builtin',
        });
      }
    }
  }

  // 2. OS Places live search for anything else (towns we don't have,
  //    specific street names, full postcodes)
  if (out.length < 8) {
    try {
      const places = await findPlaces(trimmed, 8);
      for (const p of places) {
        if (out.length >= 8) break;
        if (!p.postcode) continue;
        const district = districtFromPostcode(p.postcode);
        if (seen.has(district)) continue;
        seen.add(district);
        // Use the OS address as the label, fall back to postcode + town
        const label = p.address
          ? p.address.split(',').slice(-3, -1).join(',').trim() ||
            p.postcode
          : p.postcode;
        out.push({
          label: label.length > 60 ? label.slice(0, 60) + '…' : label,
          seedPostcode: p.postcode,
          district,
          source: 'os-places',
        });
      }
    } catch {
      // Silent — built-in results are still useful
    }
  }

  return out;
}

export async function getAreas(): Promise<Area[]> {
  const { userId } = await auth();
  if (!userId) return [];
  return migrateLegacyIfNeeded(userId);
}

export async function addArea(
  input: string,
): Promise<{ ok: true; area: Area } | { ok: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Unauthorized' };

  const resolved = resolveInput(input);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  return addResolvedArea(userId, {
    label: resolved.label,
    seedPostcode: resolved.seedPostcode,
    district: resolved.district,
    radiusMiles: resolved.radiusMiles,
  });
}

/**
 * Add directly from a typeahead suggestion — skips the input parser since
 * we already have a resolved postcode + district.
 */
export async function addAreaFromSuggestion(suggestion: {
  label: string;
  seedPostcode: string;
  district: string;
}): Promise<{ ok: true; area: Area } | { ok: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Unauthorized' };

  return addResolvedArea(userId, {
    label: suggestion.label,
    seedPostcode: suggestion.seedPostcode,
    district: suggestion.district,
    radiusMiles: 1.5,
  });
}

async function addResolvedArea(
  userId: string,
  resolved: {
    label: string;
    seedPostcode: string;
    district: string;
    radiusMiles: number;
  },
): Promise<{ ok: true; area: Area } | { ok: false; error: string }> {
  const existing = await migrateLegacyIfNeeded(userId);
  if (existing.some((a) => a.district === resolved.district)) {
    return {
      ok: false,
      error: `${resolved.district} is already in your areas.`,
    };
  }

  const probe = await probeArea(resolved.seedPostcode, resolved.radiusMiles);

  const newArea: Area = {
    id: `area_${resolved.district}_${Date.now()}`,
    label: resolved.label,
    seedPostcode: resolved.seedPostcode,
    district: resolved.district,
    radiusMiles: resolved.radiusMiles,
    lastProbe: {
      listingCount: probe.listingCount,
      checkedAt: new Date().toISOString(),
      error: probe.error,
      sourcedBreakdown: probe.sourcedBreakdown,
      staleListingCount: probe.staleListingCount,
    },
    history: appendHistory([], probe.listingCount),
  };

  const updated = [...existing, newArea];
  await saveAreas(updated, userId);
  revalidatePath('/settings/scouting');
  return { ok: true, area: newArea };
}

export async function removeArea(id: string): Promise<{ ok: boolean }> {
  const { userId } = await auth();
  if (!userId) return { ok: false };
  const existing = await loadAreas();
  const updated = existing.filter((a) => a.id !== id);
  await saveAreas(updated, userId);
  revalidatePath('/settings/scouting');
  return { ok: true };
}

export async function widenArea(
  id: string,
): Promise<{ ok: true; area: Area } | { ok: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Unauthorized' };
  const existing = await loadAreas();
  const idx = existing.findIndex((a) => a.id === id);
  if (idx === -1) return { ok: false, error: 'Area not found' };

  const current = existing[idx]!;
  const newRadius = Math.min(20, current.radiusMiles + 1.5);
  const probe = await probeArea(current.seedPostcode, newRadius);

  const updated: Area = {
    ...current,
    radiusMiles: newRadius,
    lastProbe: {
      listingCount: probe.listingCount,
      checkedAt: new Date().toISOString(),
      error: probe.error,
      sourcedBreakdown: probe.sourcedBreakdown,
      staleListingCount: probe.staleListingCount,
    },
    history: appendHistory(current.history, probe.listingCount),
  };

  const next = [...existing];
  next[idx] = updated;
  await saveAreas(next, userId);
  revalidatePath('/settings/scouting');
  return { ok: true, area: updated };
}

export async function reProbeArea(
  id: string,
): Promise<{ ok: true; area: Area } | { ok: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Unauthorized' };
  const existing = await loadAreas();
  const idx = existing.findIndex((a) => a.id === id);
  if (idx === -1) return { ok: false, error: 'Area not found' };

  const current = existing[idx]!;
  const probe = await probeArea(current.seedPostcode, current.radiusMiles);
  const updated: Area = {
    ...current,
    lastProbe: {
      listingCount: probe.listingCount,
      checkedAt: new Date().toISOString(),
      error: probe.error,
      sourcedBreakdown: probe.sourcedBreakdown,
      staleListingCount: probe.staleListingCount,
    },
    history: appendHistory(current.history, probe.listingCount),
  };

  const next = [...existing];
  next[idx] = updated;
  await saveAreas(next, userId);
  revalidatePath('/settings/scouting');
  return { ok: true, area: updated };
}

// ───────────────────────────────────────────────────────────────────────
// Per-area lead breakdown — group ScoutLeads by district from postcode
// ───────────────────────────────────────────────────────────────────────

export type AreaLeadStats = {
  district: string;
  total7d: number;
  strong7d: number;
  byType: {
    probate: number;
    repossession: number;
    bmv: number;
    auction: number;
    stale: number;
    other: number;
  };
};

export async function getAreaLeadStats(): Promise<Record<string, AreaLeadStats>> {
  const { userId } = await auth();
  if (!userId) return {};
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const leads = await database.scoutLead.findMany({
    where: { createdAt: { gte: since } },
    select: { postcode: true, source: true, verdict: true },
  });
  const out: Record<string, AreaLeadStats> = {};
  for (const lead of leads) {
    const district = districtFromPostcode(lead.postcode);
    if (!out[district]) {
      out[district] = {
        district,
        total7d: 0,
        strong7d: 0,
        byType: {
          probate: 0,
          repossession: 0,
          bmv: 0,
          auction: 0,
          stale: 0,
          other: 0,
        },
      };
    }
    const row = out[district]!;
    row.total7d += 1;
    if (lead.verdict === 'STRONG') row.strong7d += 1;
    const src = (lead.source ?? '').toLowerCase();
    if (src.includes('probate')) row.byType.probate += 1;
    else if (src.includes('repos')) row.byType.repossession += 1;
    else if (src.includes('bmv')) row.byType.bmv += 1;
    else if (src.includes('auction')) row.byType.auction += 1;
    else if (src.includes('stale')) row.byType.stale += 1;
    else row.byType.other += 1;
  }
  return out;
}

export async function triggerScoutNow(): Promise<{
  ok: boolean;
  result?: Record<string, unknown>;
  error?: string;
}> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Unauthorized' };
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return { ok: false, error: 'CRON_SECRET not configured' };
  try {
    const res = await fetch('https://bellwood-api.vercel.app/cron/scouting', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: `Cron returned HTTP ${res.status}` };
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
