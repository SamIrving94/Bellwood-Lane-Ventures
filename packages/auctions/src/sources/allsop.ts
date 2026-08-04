/**
 * Allsop adapter.
 *
 * Source: https://auctions.allsop.co.uk (residential catalogue)
 *
 * Allsop is one of the UK's largest property auctioneers — a single
 * residential catalogue carries ~300+ lots, and (verified Aug 2026) they
 * routinely include whole freehold blocks of flats and £1M+ prime-London
 * refurbishment candidates: exactly the prime/block track's stock. Sales run
 * fully online, with the catalogue published digitally in advance.
 *
 * Strategy mirrors the Auction House UK adapter:
 *   1. Fetch the public residential catalogue page
 *   2. Try JSON-LD extraction first (schema.org markup for SEO)
 *   3. Fall back to cheerio CSS-selector parsing of the lot grid
 *   4. Return [] on parse failure with a clear log line — NEVER fake data
 *
 * First production run will likely need selector tuning. Watch Vercel logs
 * for `[auctions/allsop]` lines to see what parses and what doesn't.
 */

import 'server-only';
import { load } from 'cheerio';
import type { AuctionLot, PropertyType } from '../types';

const CATALOGUE_URLS = [
  'https://auctions.allsop.co.uk/auctions/residential',
  'https://www.allsop.co.uk/auctions/residential/',
];
const USER_AGENT =
  'BellwoodAuctionScraper/1.0 (+https://wearekept.co.uk; respect robots.txt)';
const FETCH_TIMEOUT_MS = 15_000;
const POSTCODE_REGEX = /\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})\b/i;
// Same guide-price grammar as the AH-UK adapter: the k/m suffix must be
// captured per side, and `(?![a-zA-Z])` stops a following word donating a
// bogus multiplier ("£150,000 modernisation" is not £150bn).
const GUIDE_REGEX =
  /£\s*([\d,]+(?:\.\d+)?)\s*([kKmM])?(?![a-zA-Z])(?:\s*(?:to|[-–—]+)\s*£?\s*([\d,]+(?:\.\d+)?)\s*([kKmM])?(?![a-zA-Z]))?/;

const SUFFIX_MULTIPLIER: Record<string, number> = {
  k: 1_000,
  m: 1_000_000,
};

// ───────────────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────────────

export async function fetchAllsopUpcoming(): Promise<AuctionLot[]> {
  for (const url of CATALOGUE_URLS) {
    const html = await fetchHtml(url);
    if (!html) continue;

    const fromJsonLd = parseLotsFromJsonLd(html, url);
    if (fromJsonLd.length > 0) {
      console.info(
        `[auctions/allsop] parsed ${fromJsonLd.length} lots via JSON-LD (${url})`
      );
      return fromJsonLd;
    }

    const fromCss = parseLotsFromCss(html, url);
    if (fromCss.length > 0) {
      console.info(
        `[auctions/allsop] parsed ${fromCss.length} lots via CSS selectors (${url})`
      );
      return fromCss;
    }
  }

  console.warn(
    '[auctions/allsop] 0 lots parsed from any strategy — selectors may need tuning. See packages/auctions/src/sources/allsop.ts'
  );
  return [];
}

// ───────────────────────────────────────────────────────────────────────────
// JSON-LD strategy
// ───────────────────────────────────────────────────────────────────────────

function parseLotsFromJsonLd(html: string, baseUrl: string): AuctionLot[] {
  const $ = load(html);
  const lots: AuctionLot[] = [];

  $('script[type="application/ld+json"]').each((_i, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    for (const item of unwrapGraph(parsed)) {
      const itemList = item.itemListElement;
      const entries = Array.isArray(itemList)
        ? itemList
            .map((e) =>
              e && typeof e === 'object'
                ? ((e as Record<string, unknown>).item ?? e)
                : null
            )
            .filter((e): e is Record<string, unknown> => !!e)
        : [item];
      for (const entry of entries) {
        const lot = jsonLdItemToLot(entry, baseUrl);
        if (lot) lots.push(lot);
      }
    }
  });

  return dedupe(lots);
}

function unwrapGraph(parsed: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(parsed)) return parsed as Array<Record<string, unknown>>;
  if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj['@graph']))
      return obj['@graph'] as Array<Record<string, unknown>>;
    return [obj];
  }
  return [];
}

function jsonLdItemToLot(
  item: Record<string, unknown>,
  baseUrl: string
): AuctionLot | null {
  const typeField = item['@type'];
  const types = Array.isArray(typeField)
    ? typeField.map(String)
    : [String(typeField ?? '')];
  const isLot = types.some((t) =>
    [
      'Product',
      'RealEstateListing',
      'House',
      'Residence',
      'Place',
      'Offer',
      'ListItem',
    ].includes(t)
  );
  if (!isLot) return null;

  const name = typeof item.name === 'string' ? item.name : null;
  const url = typeof item.url === 'string' ? absolute(item.url, baseUrl) : null;
  const address = extractAddress(item) ?? name;
  if (!address) return null;

  const postcodeMatch =
    POSTCODE_REGEX.exec(String(item.postalCode ?? '')) ??
    POSTCODE_REGEX.exec(address);
  if (!postcodeMatch) return null;
  const postcode = `${postcodeMatch[1]} ${postcodeMatch[2]}`.toUpperCase();

  const description =
    typeof item.description === 'string' ? item.description : null;
  const guideSource = [name, description, JSON.stringify(item.offers ?? '')]
    .filter(Boolean)
    .join(' ');
  const guide = parseGuideText(guideSource);

  return {
    sourceHouse: 'allsop',
    sourceLotRef:
      extractLotRef(name, url) ?? `ALS-${postcode.replace(/\s+/g, '')}`,
    auctionDate: defaultAuctionDate(),
    address: address.replace(/\s+/g, ' ').trim(),
    postcode,
    propertyType: classifyType(`${name ?? ''} ${description ?? ''}`),
    guidePriceMinPence: guide.minPence,
    guidePriceMaxPence: guide.maxPence,
    lotUrl: url,
    summary:
      [name, description].filter(Boolean).join(' — ').slice(0, 1000) || null,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// CSS fallback strategy
// ───────────────────────────────────────────────────────────────────────────

function parseLotsFromCss(html: string, baseUrl: string): AuctionLot[] {
  const $ = load(html);
  const lots: AuctionLot[] = [];

  $(
    '[class*="lot-card"], [class*="lotCard"], [class*="property-card"], article[class*="lot"], li[class*="lot"]'
  ).each((_i, card) => {
    const $card = $(card);
    const text = $card.text().replace(/\s+/g, ' ').trim();
    if (!text) return;

    const postcodeMatch = POSTCODE_REGEX.exec(text);
    if (!postcodeMatch) return;
    const postcode = `${postcodeMatch[1]} ${postcodeMatch[2]}`.toUpperCase();

    const title = $card
      .find('h1, h2, h3, h4, [class*="title"], [class*="address"]')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim();
    const address = title || text.slice(0, 120);

    const guide = parseGuideText(text);

    const href = $card.find('a[href]').first().attr('href') || null;
    const lotUrl = href ? absolute(href, baseUrl) : null;

    const lotRef = extractLotRef(text, lotUrl);

    lots.push({
      sourceHouse: 'allsop',
      sourceLotRef: lotRef ?? `ALS-${postcode.replace(/\s+/g, '')}`,
      auctionDate: defaultAuctionDate(),
      address,
      postcode,
      propertyType: classifyType(text),
      guidePriceMinPence: guide.minPence,
      guidePriceMaxPence: guide.maxPence,
      lotUrl,
      summary: text.slice(0, 1000) || null,
    });
  });

  return dedupe(lots);
}

// ───────────────────────────────────────────────────────────────────────────
// Extractors
// ───────────────────────────────────────────────────────────────────────────

function extractAddress(item: Record<string, unknown>): string | null {
  const a = item.address;
  if (typeof a === 'string') return a;
  if (typeof a === 'object' && a !== null) {
    const addr = a as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof addr.streetAddress === 'string') parts.push(addr.streetAddress);
    if (typeof addr.addressLocality === 'string')
      parts.push(addr.addressLocality);
    if (typeof addr.postalCode === 'string') parts.push(addr.postalCode);
    if (parts.length > 0) return parts.join(', ');
  }
  return null;
}

function parseGuideText(text: string): {
  minPence: number | null;
  maxPence: number | null;
} {
  const m = GUIDE_REGEX.exec(text);
  if (!m) return { minPence: null, maxPence: null };
  const toPence = (num: string, suffix: string | undefined): number => {
    const base = Number.parseFloat(num.replace(/,/g, ''));
    const mult = suffix ? (SUFFIX_MULTIPLIER[suffix.toLowerCase()] ?? 1) : 1;
    return Math.round(base * mult * 100);
  };
  const min = toPence(m[1], m[2]);
  const max = m[3] ? toPence(m[3], m[4]) : null;
  if (!Number.isFinite(min) || min <= 0)
    return { minPence: null, maxPence: null };
  return { minPence: min, maxPence: max };
}

function extractLotRef(
  text: string | null,
  url: string | null
): string | null {
  const fromText = text ? /\blot\s*#?\s*(\d{1,4})\b/i.exec(text) : null;
  if (fromText) return `ALS-LOT-${fromText[1]}`;
  const fromUrl = url ? /\/lot[s]?\/([\w-]+)/i.exec(url) : null;
  if (fromUrl) return `ALS-${fromUrl[1]}`;
  return null;
}

function classifyType(text: string): PropertyType {
  const t = text.toLowerCase();
  if (/\bland\b|\bplot\b|\bsite\b/.test(t)) return 'land';
  if (/\bcommercial\b|\boffice\b|\bshop\b|\bretail\b/.test(t))
    return 'commercial';
  if (/\bterrace/.test(t)) return 'terraced_house';
  if (/\bsemi[- ]detached\b/.test(t)) return 'semi_detached';
  if (/\bdetached\b/.test(t)) return 'detached';
  if (/\bflat\b|\bapartment\b|\bmaisonette\b/.test(t)) return 'flat';
  return 'other';
}

/** Allsop runs ~7 residential sales/year; assume the next is within a month. */
function defaultAuctionDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 28);
  return d;
}

function absolute(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function dedupe(lots: AuctionLot[]): AuctionLot[] {
  const seen = new Set<string>();
  return lots.filter((l) => {
    const key = `${l.sourceLotRef}:${l.postcode}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`[auctions/allsop] ${url} returned ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(
      `[auctions/allsop] fetch failed for ${url}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
