/**
 * Home-level evidence for the AVM's second-check flags (home-evidence.ts)
 *
 * The Clarendon Rise miss (Oct 2026): the AVM said £409k at 92% confidence
 * for a flat that had sold for £495k two years earlier, and nothing flagged
 * it. Its own evidence disagreed with itself, but no check looked. These
 * helpers fetch the facts the checks need about THIS home:
 *
 *   - its EPC dwelling type ("Ground-floor maisonette", "End-terrace house"),
 *     to catch a partner sheet that says terraced for a flat;
 *   - its own most recent Land Registry sale, to catch an estimate far from
 *     what the home itself last sold for;
 *   - the local UK HPI move since that sale, so the sale is compared at
 *     today's prices, not 2021's.
 *
 * STRICT MATCHING OR NOTHING. The home is found by UPRN, else by the strict
 * `sameHome` rules — never the EPC API's fuzzy address search, which can
 * return a neighbour (the M14 "doubled size" bug). An address with no house
 * number or flat is not looked up at all: there is no single home to find.
 *
 * NEVER LOAD-BEARING. Every helper returns null on any failure, and nothing
 * here feeds a valuation figure. These only raise flags for a person.
 */

import { searchDomesticEpc, getEpcCertificateByNumber } from './epc';
import { getPricePaidWithAddresses } from './hmlr';
import { addressKey, sameHome } from './uprn';

const REQUEST_TIMEOUT_MS = 8_000;

/** Does this address name ONE home (a number or house name, and a known flat)? */
export function namesOneHome(address: string | null | undefined): boolean {
  if (!address) return false;
  const key = addressKey(address);
  return Boolean(key.designator) && key.unit !== 'FLAT:?';
}

// ---------------------------------------------------------------------------
// EPC dwelling type
// ---------------------------------------------------------------------------

export interface HomeDwellingType {
  /** e.g. "Ground-floor maisonette", "End-terrace house". */
  dwellingType: string;
  certificateNumber: string;
  /** How the certificate was tied to the home. */
  matchedBy: 'uprn' | 'address';
}

/**
 * The dwelling type on this home's own newest EPC certificate. Null when the
 * home can't be pinned to a certificate, the certificate has no dwelling
 * type, or the register is unreachable.
 */
export async function getHomeDwellingType(input: {
  postcode: string;
  address: string;
  uprn?: string | null;
}): Promise<HomeDwellingType | null> {
  try {
    const rows = await searchDomesticEpc(input.postcode);
    const byUprn = input.uprn ? rows.filter((r) => r.uprn === input.uprn) : [];
    const matchedBy: HomeDwellingType['matchedBy'] =
      byUprn.length > 0 ? 'uprn' : 'address';
    const candidates =
      byUprn.length > 0
        ? byUprn
        : namesOneHome(input.address)
          ? rows.filter((r) => sameHome(input.address, r.address))
          : [];
    // Several different UPRNs answering to one address means we can't tell
    // which home it is — say nothing rather than pick one.
    const uprns = new Set(candidates.map((r) => r.uprn).filter(Boolean));
    if (candidates.length === 0 || uprns.size > 1) return null;

    const newestFirst = [...candidates].sort((a, b) =>
      String(b.registrationDate ?? '').localeCompare(
        String(a.registrationDate ?? '')
      )
    );
    for (const row of newestFirst) {
      const cert = await getEpcCertificateByNumber(
        row.certificateNumber,
        input.postcode
      );
      if (cert?.dwellingType) {
        return {
          dwellingType: cert.dwellingType,
          certificateNumber: row.certificateNumber,
          matchedBy,
        };
      }
    }
    return null;
  } catch (err) {
    console.warn(
      `[property-data/home-evidence] dwelling type unavailable for ${input.postcode}`,
      err
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// The home's own last sale
// ---------------------------------------------------------------------------

export interface HomeSale {
  /** Pounds, as HMLR reports it. */
  price: number;
  /** ISO YYYY-MM-DD. */
  date: string;
  address: string;
}

/**
 * This home's most recent Land Registry sale before `before`, within
 * `maxYears`. Null when the address doesn't name one home, there is no such
 * sale, or the feed is down (the Price Paid client returns [] on failure, so
 * "down" and "no sale" look the same here — both mean no flag).
 */
export async function getHomeLastSale(input: {
  postcode: string;
  address: string;
  before: Date;
  maxYears: number;
}): Promise<HomeSale | null> {
  if (!namesOneHome(input.address)) return null;
  try {
    const earliest = new Date(input.before);
    earliest.setUTCFullYear(earliest.getUTCFullYear() - input.maxYears);
    const sales = (await getPricePaidWithAddresses(input.postcode, 200))
      .filter((s) => s.price > 0 && s.date && sameHome(input.address, s.address))
      .filter((s) => {
        const d = new Date(s.date);
        return d < input.before && d >= earliest;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
    const last = sales[0];
    return last ? { price: last.price, date: last.date, address: last.address } : null;
  } catch (err) {
    console.warn(
      `[property-data/home-evidence] own-sale lookup failed for ${input.postcode}`,
      err
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Local UK HPI move since a date
// ---------------------------------------------------------------------------

const UKHPI_BASE = 'https://landregistry.data.gov.uk/data/ukhpi/region';

/** UK HPI field suffix per AVM property type. */
const HPI_TYPE_FIELD: Record<string, string> = {
  flat: 'FlatMaisonette',
  terraced: 'Terraced',
  'semi-detached': 'SemiDetached',
  detached: 'Detached',
};

export interface LocalHpiMove {
  /** index(to) ÷ index(from). 1.05 = prices up 5%. */
  ratio: number;
  /** UK HPI region slug actually used, e.g. "lewisham" or "england". */
  region: string;
  fromMonth: string;
  toMonth: string;
  /** Whether the property-type series was used, or the all-types index. */
  series: 'type' | 'all';
}

async function getJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    return res.ok ? await res.json() : null;
  } finally {
    clearTimeout(timer);
  }
}

/** The council area's UK HPI slug, e.g. "lewisham". Null if unknown. */
async function localAuthoritySlug(postcode: string): Promise<string | null> {
  const body = (await getJson(
    `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.trim())}`
  )) as { result?: { admin_district?: string } } | null;
  const name = body?.result?.admin_district;
  if (!name) return null;
  return name
    .toLowerCase()
    .replace(/,/g, '')
    .replace(/&/g, 'and')
    .replace(/\s+/g, '-');
}

async function hpiMonth(
  region: string,
  month: string
): Promise<Record<string, unknown> | null> {
  const body = (await getJson(`${UKHPI_BASE}/${region}/month/${month}.json`)) as {
    result?: { primaryTopic?: Record<string, unknown> };
  } | null;
  const topic = body?.result?.primaryTopic;
  return topic && typeof topic.housePriceIndex === 'number' ? topic : null;
}

function monthsBack(from: string, n: number): string {
  const d = new Date(`${from}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 7);
}

/**
 * How far local prices for this property type have moved since `sinceDate`,
 * by UK HPI (council area, else England). The index lags about two months,
 * so the newest published month at or before `upTo` is used. Null when no
 * index can be read.
 */
export async function getLocalHpiMove(input: {
  postcode: string;
  propertyType: string;
  sinceDate: string;
  upTo: Date;
}): Promise<LocalHpiMove | null> {
  try {
    const fromMonth = input.sinceDate.slice(0, 7);
    const upToMonth = input.upTo.toISOString().slice(0, 7);
    const slug = await localAuthoritySlug(input.postcode);
    for (const region of [slug, 'england'].filter(Boolean) as string[]) {
      const from = await hpiMonth(region, fromMonth);
      if (!from) continue;
      for (let back = 0; back < 6; back++) {
        const toMonth = monthsBack(upToMonth, back);
        const to = await hpiMonth(region, toMonth);
        if (!to) continue;
        const field = `housePriceIndex${HPI_TYPE_FIELD[input.propertyType] ?? ''}`;
        const typed =
          typeof from[field] === 'number' && typeof to[field] === 'number';
        const fromIdx = (typed ? from[field] : from.housePriceIndex) as number;
        const toIdx = (typed ? to[field] : to.housePriceIndex) as number;
        if (!(fromIdx > 0 && toIdx > 0)) break;
        return {
          ratio: toIdx / fromIdx,
          region,
          fromMonth,
          toMonth,
          series: typed ? 'type' : 'all',
        };
      }
    }
    return null;
  } catch (err) {
    console.warn(
      `[property-data/home-evidence] HPI move unavailable for ${input.postcode}`,
      err
    );
    return null;
  }
}
