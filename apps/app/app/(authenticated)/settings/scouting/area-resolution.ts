/**
 * Area input resolution — pure module, deliberately OUTSIDE the 'use server'
 * file so it can be unit-tested directly.
 *
 * History: this logic used to fabricate `"<DISTRICT> 1AA"` for any district
 * missing from DISTRICT_SAMPLES and hope PropertyData accepted it. SW3 1AA
 * does not exist; PropertyData answered HTTP 422; the founder was told
 * "added — try widening the radius". That fabrication branch is gone. The
 * rule now matches outwardCode's own doc-comment: resolve, or say plainly
 * that we could not — never guess.
 */

import {
  geocodePostcode,
  seedPostcodeForOutcode,
} from '@repo/property-data/src/postcodes-io';
import { outwardCode } from '@repo/scouting/src/track';

const FULL_POSTCODE_RE = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i;
const DISTRICT_RE = /^[A-Z]{1,2}\d{1,2}[A-Z]?$/i;

/**
 * Sample central postcode per district for the ~120 districts we expect
 * Kept to operate in. Manually curated from OS data. Extend by adding
 * rows — no schema changes needed. A district that isn't in here is
 * resolved dynamically via postcodes.io (see resolveArea); this table is a
 * fast path, not a gate, and its entries are validated before use so a bad
 * row falls through to dynamic resolution instead of poisoning an area.
 */
export const DISTRICT_SAMPLES: Record<string, string> = {
  // ── London prime districts (packages/scouting/src/track.ts) ──
  // Every value below is a REAL postcode resolved from the outcode
  // centroid via postcodes.io, then checked to belong to its own
  // district. Before this, London fell through to the
  // `<DISTRICT> 1AA` best-guess, and PropertyData answered 422
  // because postcodes like SW3 1AA do not exist.
  // South-west
  SW3: 'SW3 3TH',
  SW4: 'SW4 7BB',
  SW6: 'SW6 4HL',
  SW7: 'SW7 5BD',
  SW11: 'SW11 2DR',
  SW12: 'SW12 9AW',
  SW16: 'SW16 3PX',
  SW17: 'SW17 7EW',
  SW18: 'SW18 4DJ',
  // South-east
  SE3: 'SE3 0AB',
  SE15: 'SE15 5HE',
  SE21: 'SE21 8AA',
  SE22: 'SE22 9EL',
  SE23: 'SE23 2DD',
  SE24: 'SE24 0HD',
  // North
  N4: 'N4 1BH',
  N7: 'N7 9RF',
  N8: 'N8 8NH',
  N10: 'N10 1QB',
  N16: 'N16 0ND',
  N19: 'N19 3EG',
  // West
  W3: 'W3 6SP',
  W4: 'W4 4LR',
  W5: 'W5 3SS',
  W8: 'W8 7RX',
  W11: 'W11 4AT',
  W12: 'W12 0PH',
  W13: 'W13 0NL',
  // North-west
  NW2: 'NW2 6SH',
  NW3: 'NW3 5NX',
  NW5: 'NW5 3EW',
  NW6: 'NW6 4NA',
  NW8: 'NW8 9JG',
  NW10: 'NW10 4EJ',
  // East
  E5: 'E5 9SQ',
  E8: 'E8 3DR',
  E9: 'E9 5BJ',
  E11: 'E11 3AD',
  E17: 'E17 4SA',
  // Manchester
  M1: 'M1 1AD',
  M2: 'M2 5DB',
  M3: 'M3 4FP',
  M4: 'M4 5DL',
  M5: 'M5 4WX',
  M8: 'M8 8DJ',
  M9: 'M9 4DG',
  M11: 'M11 3AD',
  M12: 'M12 4RY',
  M13: 'M13 9PL',
  M14: 'M14 5LL',
  M15: 'M15 5TR',
  M16: 'M16 7SE',
  M17: 'M17 8AS',
  M18: 'M18 8WJ',
  M19: 'M19 1XS',
  M20: 'M20 6AB',
  M21: 'M21 9LD',
  M22: 'M22 4HW',
  M23: 'M23 1DS',
  // Stockport / Cheshire
  SK1: 'SK1 3BW',
  SK2: 'SK2 6AJ',
  SK3: 'SK3 8AB',
  SK4: 'SK4 4QR',
  SK5: 'SK5 7EY',
  SK6: 'SK6 4DR',
  SK7: 'SK7 1AB',
  SK8: 'SK8 1JR',
  SK9: 'SK9 1AT',
  SK10: 'SK10 1AA',
  SK12: 'SK12 1AS',
  SK14: 'SK14 3GA',
  SK15: 'SK15 1AY',
  SK16: 'SK16 4DD',
  // Leeds
  LS1: 'LS1 4AP',
  LS2: 'LS2 9JT',
  LS6: 'LS6 3HN',
  LS7: 'LS7 3JB',
  LS8: 'LS8 1ED',
  LS11: 'LS11 5DJ',
  LS12: 'LS12 1AA',
  LS13: 'LS13 3AB',
  LS15: 'LS15 8GB',
  LS17: 'LS17 6BU',
  LS18: 'LS18 5BD',
  LS19: 'LS19 7BN',
  LS25: 'LS25 6AA',
  LS26: 'LS26 8WA',
  LS27: 'LS27 0HQ',
  LS28: 'LS28 5UJ',
  // Bradford
  BD1: 'BD1 3QR',
  BD2: 'BD2 4AZ',
  BD3: 'BD3 7DH',
  BD5: 'BD5 8LX',
  BD7: 'BD7 1DP',
  BD8: 'BD8 9NS',
  BD9: 'BD9 5DA',
  BD10: 'BD10 9DF',
  BD11: 'BD11 1HW',
  BD12: 'BD12 7DD',
  BD13: 'BD13 3SY',
  BD14: 'BD14 6LB',
  BD15: 'BD15 9BJ',
  BD16: 'BD16 4LL',
  BD17: 'BD17 5JD',
  BD18: 'BD18 4SF',
  // Sheffield
  S1: 'S1 4DT',
  S2: 'S2 4UB',
  S3: 'S3 7TR',
  S4: 'S4 7WW',
  S5: 'S5 7SU',
  S6: 'S6 2WB',
  S7: 'S7 1FH',
  S8: 'S8 7DH',
  S9: 'S9 1AA',
  S10: 'S10 5NA',
  S11: 'S11 8RJ',
  S12: 'S12 4LJ',
  S13: 'S13 7AA',
  // Liverpool
  L1: 'L1 8JQ',
  L3: 'L3 5UF',
  L4: 'L4 0UF',
  L5: 'L5 3LF',
  L6: 'L6 1HD',
  L7: 'L7 1RB',
  L8: 'L8 8HZ',
  L13: 'L13 6RB',
  L15: 'L15 2HG',
  L17: 'L17 7AN',
  L18: 'L18 1HG',
  L25: 'L25 5JF',
  // Birmingham
  B1: 'B1 2EP',
  B2: 'B2 2AB',
  B3: 'B3 1RB',
  B5: 'B5 7ER',
  B12: 'B12 8AS',
  B13: 'B13 9JG',
  B14: 'B14 6AA',
  B15: 'B15 3HE',
  B17: 'B17 9LJ',
  B18: 'B18 7AL',
  B19: 'B19 1HG',
  B20: 'B20 1AS',
  // Newcastle / Gateshead
  NE1: 'NE1 4LF',
  NE2: 'NE2 1RH',
  NE3: 'NE3 3HB',
  NE4: 'NE4 5PB',
  NE6: 'NE6 5BB',
  NE8: 'NE8 1RS',
  NE9: 'NE9 5HA',
};

/**
 * Map of common UK town/city names → seed postcode.
 * Lowercased keys. Extend freely.
 */
export const TOWN_SAMPLES: Record<string, string> = {
  manchester: 'M14 5LL',
  stockport: 'SK4 4QR',
  leeds: 'LS17 6BU',
  bradford: 'BD18 4SF',
  sheffield: 'S10 5NA',
  liverpool: 'L17 7AN',
  birmingham: 'B13 9JG',
  newcastle: 'NE2 1RH',
  gateshead: 'NE8 1RS',
  oldham: 'OL1 1QU',
  rochdale: 'OL11 1JN',
  bolton: 'BL1 3EG',
  bury: 'BL9 0DG',
  salford: 'M5 4WX',
  wigan: 'WN1 2LF',
  warrington: 'WA1 2DT',
  preston: 'PR1 2BG',
  blackburn: 'BB1 7JN',
  blackpool: 'FY1 4PJ',
  huddersfield: 'HD1 1AB',
  halifax: 'HX1 5ER',
  wakefield: 'WF1 1AA',
  doncaster: 'DN1 3LN',
  rotherham: 'S60 1DX',
  barnsley: 'S70 1AA',
  derby: 'DE1 1AA',
  nottingham: 'NG1 1AA',
  leicester: 'LE1 1AA',
  coventry: 'CV1 5RP',
  wolverhampton: 'WV1 1AA',
  dudley: 'DY1 1HP',
  walsall: 'WS1 1TP',
};

function normaliseInput(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, ' ');
}

export function titleCase(raw: string): string {
  return raw
    .toLowerCase()
    .split(/[\s-]/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ');
}

export type Resolved =
  | {
      ok: true;
      label: string;
      seedPostcode: string;
      district: string;
      radiusMiles: number;
    }
  | { ok: false; error: string };

/**
 * Resolve founder input (full postcode, district code, or town name) to a
 * verified seed postcode. Async because unknown or unverified inputs go to
 * postcodes.io; known-good answers are served from its 30-day cache.
 */
export async function resolveArea(raw: string): Promise<Resolved> {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: 'Please type something.' };
  }

  const norm = normaliseInput(trimmed);
  const compact = norm.replace(/\s/g, '');

  // 1. Full postcode (M14 5LL) — verified against postcodes.io, because a
  //    well-formed fake ("SW3 1AA") is exactly what caused the 422 incident.
  if (FULL_POSTCODE_RE.test(compact)) {
    const seed = `${compact.slice(0, -3)} ${compact.slice(-3)}`;
    const district = outwardCode(seed);
    if (!district) {
      return {
        ok: false,
        error: `"${seed}" does not look like a UK postcode.`,
      };
    }
    const coords = await geocodePostcode(seed);
    if (!coords) {
      return {
        ok: false,
        error: `"${seed}" is not a live UK postcode. Check for a typo, or add the district ("${district}") instead.`,
      };
    }
    return {
      ok: true,
      label: seed,
      seedPostcode: seed,
      district,
      radiusMiles: 1,
    };
  }

  // 2. District code (M14). Table hit is a fast path but is validated the
  //    same way — several legacy entries were themselves unverified guesses.
  if (DISTRICT_RE.test(compact)) {
    const district = compact;
    const tableSeed = DISTRICT_SAMPLES[district];
    if (tableSeed && (await geocodePostcode(tableSeed))) {
      return {
        ok: true,
        label: district,
        seedPostcode: tableSeed,
        district,
        radiusMiles: 1.5,
      };
    }
    // Dynamic: outcode centroid -> nearest real postcode in that district.
    const dyn = await seedPostcodeForOutcode(district);
    if (dyn.outcome === 'found') {
      return {
        ok: true,
        label: district,
        seedPostcode: dyn.postcode,
        district,
        radiusMiles: 1.5,
      };
    }
    if (dyn.outcome === 'not-found') {
      return {
        ok: false,
        error: `"${district}" is not a UK postcode district we can find. Check the code, or try a full postcode inside it.`,
      };
    }
    return {
      ok: false,
      error: `Couldn't verify "${district}" right now (postcode lookup unavailable). Try again in a minute — we never save a guessed postcode.`,
    };
  }

  // 3. Town/city name. Same validation rule as districts: a stale table row
  //    falls through to dynamic resolution on its own district.
  const townKey = trimmed.toLowerCase().replace(/\s+/g, ' ').trim();
  const townSeed = TOWN_SAMPLES[townKey];
  if (townSeed) {
    const district = outwardCode(townSeed);
    if (district) {
      if (await geocodePostcode(townSeed)) {
        return {
          ok: true,
          label: titleCase(trimmed),
          seedPostcode: townSeed,
          district,
          radiusMiles: 2,
        };
      }
      const dyn = await seedPostcodeForOutcode(district);
      if (dyn.outcome === 'found') {
        return {
          ok: true,
          label: titleCase(trimmed),
          seedPostcode: dyn.postcode,
          district,
          radiusMiles: 2,
        };
      }
      if (dyn.outcome === 'unavailable') {
        return {
          ok: false,
          error: `Couldn't verify "${titleCase(trimmed)}" right now (postcode lookup unavailable). Try again in a minute.`,
        };
      }
    }
    // fall through to the generic message: the table row is unusable
  }

  return {
    ok: false,
    error: `"${trimmed}" — we couldn't resolve that. Try a full postcode (e.g. "M14 5LL"), a district code (e.g. "M14"), or a UK city name.`,
  };
}
