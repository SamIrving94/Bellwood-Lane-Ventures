'use server';

import { getFounderSession } from '@repo/auth/server';
import { database } from '@repo/database';
import { findPlaces } from '@repo/property-data/src/os-places';
import {
  SOURCED_LIST_TYPES,
  getSourcedPropertiesRaw,
} from '@repo/property-data/src/propertydata';
import { outwardCode } from '@repo/scouting/src/track';
import { revalidatePath } from 'next/cache';
import {
  DISTRICT_SAMPLES,
  TOWN_SAMPLES,
  resolveArea,
  titleCase,
} from './area-resolution';

const AREAS_KEY = 'scouting.areas';
const LEGACY_DISTRICTS_KEY = 'scouting.targetPostcodes';
const LEGACY_SEEDS_KEY = 'scouting.scanSeeds';

export type AreaTrack = 'volume' | 'prime';

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
  } | null;
  /** Rolling 30-day listing-count history for the sparkline. */
  history?: Array<{ date: string; count: number }>;
  /**
   * `volume` (default) areas share the daily 6-area rotation. `prime` areas
   * are scanned on EVERY run regardless of rotation — prime stock (£700k+,
   * see packages/scouting/src/track.ts) is scarce and worth a founder glance
   * whenever it appears, so a once-every-few-days rotation slot isn't a real
   * "focus". Missing on older rows — treat as 'volume'.
   */
  track?: AreaTrack;
};

function appendHistory(
  current: Area['history'] | undefined,
  count: number
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

// ───────────────────────────────────────────────────────────────────────
// Probe — hit PropertyData once on the seed and count listings
// ───────────────────────────────────────────────────────────────────────

/**
 * Probe an area — fast, single-call, and CLASSIFIED.
 *
 * Uses the first of the seven list types the daily cron actually queries
 * (the old probe used `auction-properties`, which the cron never touches, so
 * a passing probe proved nothing about the runs that followed). Built on the
 * raw helper because the wrapped client discards the response body — and the
 * body is where PropertyData explains WHY it rejected an area. Losing that
 * text is how "SW3 1AA" surfaced as an unexplained HTTP 422 days later.
 *
 * `invalid`  — PropertyData rejected the request itself (4xx). The cron
 *              would fail on this area forever; the add must not proceed.
 * `transient` — the network, the rate limit, or PropertyData's servers.
 *              The area is fine; saving it with a visible error is correct.
 */
type ProbeResult =
  | { kind: 'ok'; listingCount: number }
  | { kind: 'invalid'; message: string }
  | { kind: 'transient'; message: string };

async function probeArea(
  seedPostcode: string,
  radiusMiles: number
): Promise<ProbeResult> {
  const raw = await getSourcedPropertiesRaw(seedPostcode, {
    radiusMiles,
    list: SOURCED_LIST_TYPES[0],
  });
  if (raw.ok) {
    const props = (raw.body as { properties?: unknown[] } | null)?.properties;
    return {
      kind: 'ok',
      listingCount: Array.isArray(props) ? props.length : 0,
    };
  }
  // Parity with the wrapped client: a 404 from /sourced-properties means
  // "no data for this area", not "bad area".
  if (raw.status === 404) {
    return { kind: 'ok', listingCount: 0 };
  }
  const upstream = (raw.body as { message?: string } | null)?.message;
  const detail =
    upstream ?? raw.error ?? `HTTP ${raw.status ?? 'error'} from PropertyData`;
  if (
    typeof raw.status === 'number' &&
    raw.status >= 400 &&
    raw.status < 500 &&
    raw.status !== 429
  ) {
    return {
      kind: 'invalid',
      message: `PropertyData rejected this area (HTTP ${raw.status}): ${detail}`,
    };
  }
  return { kind: 'transient', message: detail };
}

/** Flatten a probe into the lastProbe shape stored on an Area. */
function probeToLastProbe(probe: ProbeResult): {
  listingCount: number;
  checkedAt: string;
  error: string | null;
} {
  return {
    listingCount: probe.kind === 'ok' ? probe.listingCount : 0,
    checkedAt: new Date().toISOString(),
    error: probe.kind === 'ok' ? null : probe.message,
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
        track: a.track === 'prime' ? 'prime' : 'volume',
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
        (v): v is string => typeof v === 'string'
      )
    : [];

  const seeds: Array<{
    label?: string;
    postcode: string;
    radiusMiles?: number;
  }> = Array.isArray(seedsRow?.value)
    ? (seedsRow!.value as unknown[])
        .filter(
          (v): v is Record<string, unknown> => !!v && typeof v === 'object'
        )
        .map((v) => ({
          label: typeof v.label === 'string' ? v.label : undefined,
          postcode: typeof v.postcode === 'string' ? v.postcode : '',
          radiusMiles:
            typeof v.radiusMiles === 'number' ? v.radiusMiles : undefined,
        }))
        .filter((s) => s.postcode)
    : [];

  const migrated: Area[] = [];
  const seen = new Set<string>();

  for (const seed of seeds) {
    const resolved = await resolveArea(seed.postcode);
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
    const resolved = await resolveArea(d);
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
  query: string
): Promise<Suggestion[]> {
  const userId = (await getFounderSession())?.userId;
  if (!userId || !query.trim() || query.trim().length < 2) return [];

  const trimmed = query.trim();
  const out: Suggestion[] = [];
  const seen = new Set<string>();

  // 1. Built-in town/district map first — instant, no network
  const lower = trimmed.toLowerCase();
  for (const [town, postcode] of Object.entries(TOWN_SAMPLES)) {
    if (town.startsWith(lower) && out.length < 5) {
      const district = outwardCode(postcode);
      if (district && !seen.has(district)) {
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
    if (district.startsWith(upper) && out.length < 8 && !seen.has(district)) {
      seen.add(district);
      out.push({
        label: district,
        seedPostcode: postcode,
        district,
        source: 'builtin',
      });
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
        const district = outwardCode(p.postcode);
        if (!district || seen.has(district)) continue;
        seen.add(district);
        // Use the OS address as the label, fall back to postcode + town
        const label = p.address
          ? p.address.split(',').slice(-3, -1).join(',').trim() || p.postcode
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
  const userId = (await getFounderSession())?.userId;
  if (!userId) return [];
  return migrateLegacyIfNeeded(userId);
}

export async function addArea(
  input: string,
  track: AreaTrack = 'volume'
): Promise<{ ok: true; area: Area } | { ok: false; error: string }> {
  const userId = (await getFounderSession())?.userId;
  if (!userId) return { ok: false, error: 'Unauthorized' };

  const resolved = await resolveArea(input);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  return addResolvedArea(userId, {
    label: resolved.label,
    seedPostcode: resolved.seedPostcode,
    district: resolved.district,
    radiusMiles: resolved.radiusMiles,
    track,
  });
}

/**
 * Add directly from a typeahead suggestion — skips the input parser since
 * we already have a resolved postcode + district.
 */
export async function addAreaFromSuggestion(
  suggestion: {
    label: string;
    seedPostcode: string;
    district: string;
  },
  track: AreaTrack = 'volume'
): Promise<{ ok: true; area: Area } | { ok: false; error: string }> {
  const userId = (await getFounderSession())?.userId;
  if (!userId) return { ok: false, error: 'Unauthorized' };

  return addResolvedArea(userId, {
    label: suggestion.label,
    seedPostcode: suggestion.seedPostcode,
    district: suggestion.district,
    radiusMiles: 1.5,
    track,
  });
}

async function addResolvedArea(
  userId: string,
  resolved: {
    label: string;
    seedPostcode: string;
    district: string;
    radiusMiles: number;
    track?: AreaTrack;
  }
): Promise<{ ok: true; area: Area } | { ok: false; error: string }> {
  const existing = await migrateLegacyIfNeeded(userId);
  if (existing.some((a) => a.district === resolved.district)) {
    return {
      ok: false,
      error: `${resolved.district} is already in your areas.`,
    };
  }

  const probe = await probeArea(resolved.seedPostcode, resolved.radiusMiles);

  // A 4xx means the cron would fail on this area on every run until someone
  // noticed. Refuse the add and say why, in PropertyData's own words —
  // exactly the message the old flow buried in a truncated row error.
  if (probe.kind === 'invalid') {
    return { ok: false, error: probe.message };
  }

  const lastProbe = probeToLastProbe(probe);
  const newArea: Area = {
    id: `area_${resolved.district}_${Date.now()}`,
    label: resolved.label,
    seedPostcode: resolved.seedPostcode,
    district: resolved.district,
    radiusMiles: resolved.radiusMiles,
    lastProbe,
    history: appendHistory([], lastProbe.listingCount),
    track: resolved.track ?? 'volume',
  };

  const updated = [...existing, newArea];
  await saveAreas(updated, userId);
  revalidatePath('/settings/scouting');
  return { ok: true, area: newArea };
}

/** Toggle an existing area between the rotating volume pool and the
 * always-scanned prime focus. */
export async function setAreaTrack(
  id: string,
  track: AreaTrack
): Promise<{ ok: true; area: Area } | { ok: false; error: string }> {
  const userId = (await getFounderSession())?.userId;
  if (!userId) return { ok: false, error: 'Unauthorized' };
  const existing = await loadAreas();
  const idx = existing.findIndex((a) => a.id === id);
  if (idx === -1) return { ok: false, error: 'Area not found' };

  const updated: Area = { ...existing[idx]!, track };
  const next = [...existing];
  next[idx] = updated;
  await saveAreas(next, userId);
  revalidatePath('/settings/scouting');
  return { ok: true, area: updated };
}

export async function removeArea(id: string): Promise<{ ok: boolean }> {
  const userId = (await getFounderSession())?.userId;
  if (!userId) return { ok: false };
  const existing = await loadAreas();
  const updated = existing.filter((a) => a.id !== id);
  await saveAreas(updated, userId);
  revalidatePath('/settings/scouting');
  return { ok: true };
}

export async function widenArea(
  id: string
): Promise<{ ok: true; area: Area } | { ok: false; error: string }> {
  const userId = (await getFounderSession())?.userId;
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
    lastProbe: probeToLastProbe(probe),
    history: appendHistory(
      current.history,
      probe.kind === 'ok' ? probe.listingCount : 0
    ),
  };

  const next = [...existing];
  next[idx] = updated;
  await saveAreas(next, userId);
  revalidatePath('/settings/scouting');
  return { ok: true, area: updated };
}

export async function reProbeArea(
  id: string
): Promise<{ ok: true; area: Area } | { ok: false; error: string }> {
  const userId = (await getFounderSession())?.userId;
  if (!userId) return { ok: false, error: 'Unauthorized' };
  const existing = await loadAreas();
  const idx = existing.findIndex((a) => a.id === id);
  if (idx === -1) return { ok: false, error: 'Area not found' };

  const current = existing[idx]!;
  const probe = await probeArea(current.seedPostcode, current.radiusMiles);
  const updated: Area = {
    ...current,
    lastProbe: probeToLastProbe(probe),
    history: appendHistory(
      current.history,
      probe.kind === 'ok' ? probe.listingCount : 0
    ),
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

export async function getAreaLeadStats(): Promise<
  Record<string, AreaLeadStats>
> {
  const userId = (await getFounderSession())?.userId;
  if (!userId) return {};
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const leads = await database.scoutLead.findMany({
    where: { createdAt: { gte: since } },
    select: { postcode: true, source: true, verdict: true },
  });
  const out: Record<string, AreaLeadStats> = {};
  for (const lead of leads) {
    const district = outwardCode(lead.postcode);
    if (!district) continue;
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

/**
 * Wipe all ScoutLead rows + their feedback. Used when the schema upgrades
 * and the existing leads are missing the new rich fields — a clean slate
 * before re-running scout is more useful than leftover sparse leads.
 */
export async function clearAllLeads(): Promise<{
  ok: boolean;
  deletedLeads: number;
  deletedFeedback: number;
  error?: string;
}> {
  const userId = (await getFounderSession())?.userId;
  if (!userId) {
    return {
      ok: false,
      deletedLeads: 0,
      deletedFeedback: 0,
      error: 'Unauthorized',
    };
  }
  try {
    const fb = await database.founderFeedback.deleteMany({
      where: { targetType: 'scout_lead' },
    });
    const ld = await database.scoutLead.deleteMany({});
    revalidatePath('/leads');
    revalidatePath('/today');
    revalidatePath('/settings/scouting');
    return {
      ok: true,
      deletedLeads: ld.count,
      deletedFeedback: fb.count,
    };
  } catch (err) {
    return {
      ok: false,
      deletedLeads: 0,
      deletedFeedback: 0,
      error: (err as Error).message,
    };
  }
}

export async function triggerScoutNow(): Promise<{
  ok: boolean;
  result?: Record<string, unknown>;
  error?: string;
}> {
  const userId = (await getFounderSession())?.userId;
  if (!userId) return { ok: false, error: 'Unauthorized' };
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return { ok: false, error: 'CRON_SECRET not configured' };
  try {
    const res = await fetch('https://bellwood-api.vercel.app/cron/scouting', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok)
      return { ok: false, error: `Cron returned HTTP ${res.status}` };
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
