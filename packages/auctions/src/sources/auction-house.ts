/**
 * Auction House UK adapter.
 *
 * Source: https://www.auctionhouse.co.uk/nationalcatalogue
 *
 * Auction House UK is the largest regional auctioneer in the UK. Their
 * national catalogue is public and lists upcoming lots across all regional
 * branches (Manchester, Birmingham, Leeds, London, etc.).
 *
 * Strategy:
 *   1. Fetch the public catalogue page
 *   2. Try JSON-LD extraction first — auction sites typically embed
 *      schema.org Product / RealEstateListing markup for SEO
 *   3. Fall back to cheerio CSS-selector parsing for the lot grid
 *   4. Return [] on parse failure with a clear log line — NEVER fake data
 *
 * First production run will likely need selector tuning. Watch
 * Vercel logs for `[auctions/ah-uk]` lines to see what parses and what doesn't.
 */

import 'server-only';
import { load } from 'cheerio';
import type { AuctionLot, AuctionResult, PropertyType } from '../types';

const CATALOGUE_URL = 'https://www.auctionhouse.co.uk/nationalcatalogue';
const RESULTS_URL = 'https://www.auctionhouse.co.uk/results';
const USER_AGENT =
  'BellwoodAuctionScraper/1.0 (+https://bellwoodslane.co.uk; respect robots.txt)';
const FETCH_TIMEOUT_MS = 15_000;
const POSTCODE_REGEX = /\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})\b/i;
const GUIDE_REGEX = /£\s*([\d,]+(?:\.\d+)?)\s*(?:k|K)?(?:\s*[-–to]+\s*£?\s*([\d,]+(?:\.\d+)?))?/;

// ───────────────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────────────

export async function fetchAuctionHouseUKUpcoming(): Promise<AuctionLot[]> {
  const html = await fetchHtml(CATALOGUE_URL);
  if (!html) return [];

  const fromJsonLd = parseLotsFromJsonLd(html);
  if (fromJsonLd.length > 0) {
    console.info(`[auctions/ah-uk] parsed ${fromJsonLd.length} lots via JSON-LD`);
    return fromJsonLd;
  }

  const fromCss = parseLotsFromCss(html);
  if (fromCss.length > 0) {
    console.info(`[auctions/ah-uk] parsed ${fromCss.length} lots via CSS selectors`);
    return fromCss;
  }

  console.warn(
    '[auctions/ah-uk] 0 lots parsed from either strategy — selectors may have drifted. See packages/auctions/src/sources/auction-house.ts',
  );
  return [];
}

export async function fetchAuctionHouseUKResults(): Promise<AuctionResult[]> {
  const html = await fetchHtml(RESULTS_URL);
  if (!html) return [];

  // Results parsing is structurally different (hammer prices, sold flags).
  // For Phase 1 we only need upcoming lots; results parsing is best left
  // until back-testing is on the roadmap. Return [] honestly.
  console.info('[auctions/ah-uk] results scraper not yet implemented — returning []');
  return [];
}

// ───────────────────────────────────────────────────────────────────────────
// Fetcher
// ───────────────────────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[auctions/ah-uk] HTTP ${res.status} from ${url}`);
      return null;
    }

    return await res.text();
  } catch (err) {
    console.warn(`[auctions/ah-uk] fetch failed for ${url}`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Strategy 1 — JSON-LD (preferred)
//
// Most modern real estate / auction sites embed schema.org structured data
// in <script type="application/ld+json"> tags. We extract any Product,
// RealEstateListing, or Offer items and map to AuctionLot.
// ───────────────────────────────────────────────────────────────────────────

function parseLotsFromJsonLd(html: string): AuctionLot[] {
  const $ = load(html);
  const blocks = $('script[type="application/ld+json"]').toArray();
  const lots: AuctionLot[] = [];

  for (const block of blocks) {
    const raw = $(block).contents().text();
    if (!raw) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }

    // JSON-LD can be a single object, an array, or wrapped in @graph.
    const items = unwrapGraph(parsed);
    for (const item of items) {
      const lot = jsonLdItemToLot(item);
      if (lot) lots.push(lot);
    }
  }

  return lots;
}

function unwrapGraph(parsed: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(parsed)) return parsed as Array<Record<string, unknown>>;
  if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj['@graph'])) return obj['@graph'] as Array<Record<string, unknown>>;
    return [obj];
  }
  return [];
}

function jsonLdItemToLot(item: Record<string, unknown>): AuctionLot | null {
  const typeField = item['@type'];
  const types = Array.isArray(typeField) ? typeField.map(String) : [String(typeField ?? '')];
  const isLot = types.some((t) =>
    ['Product', 'RealEstateListing', 'House', 'Residence', 'Place', 'Offer'].includes(t),
  );
  if (!isLot) return null;

  const name = typeof item.name === 'string' ? item.name : null;
  const url = typeof item.url === 'string' ? item.url : null;
  const address = extractAddress(item);
  if (!address) return null;

  const postcode = extractPostcode(item) ?? extractPostcode({ address } as Record<string, unknown>);
  if (!postcode) return null;

  const guide = extractGuidePrice(item);
  const auctionDate = extractAuctionDate(item);

  return {
    sourceHouse: 'auction_house_uk',
    sourceLotRef: extractLotRef(name, url) ?? `AHN-${postcode.replace(/\s+/g, '')}`,
    auctionDate: auctionDate ?? defaultAuctionDate(),
    address,
    postcode: normalisePostcode(postcode),
    propertyType: classifyType(name, item),
    guidePriceMinPence: guide.minPence,
    guidePriceMaxPence: guide.maxPence,
    lotUrl: url,
    photoUrls: extractImagesFromJsonLd(item),
  };
}

/**
 * Extract image URLs from a JSON-LD item. schema.org `image` is either a
 * single URL string or an array of URLs. Returns up to 10 URLs to keep
 * downstream cost predictable.
 */
function extractImagesFromJsonLd(item: Record<string, unknown>): string[] {
  const raw = item.image;
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const urls: string[] = [];
  for (const entry of list) {
    if (typeof entry === 'string') urls.push(entry);
    else if (entry && typeof entry === 'object' && typeof (entry as Record<string, unknown>).url === 'string') {
      urls.push((entry as Record<string, unknown>).url as string);
    }
    if (urls.length >= 10) break;
  }
  return urls;
}

// ───────────────────────────────────────────────────────────────────────────
// Strategy 2 — CSS selector fallback
//
// If no JSON-LD lots are found, walk the lot grid with a permissive set of
// selectors. Auction House UK historically uses `data-lot-number` and a
// `.lot-card` / `.lot-row` container — these are the best-bet starting
// points and the first thing to tune if the site redesigns.
// ───────────────────────────────────────────────────────────────────────────

function parseLotsFromCss(html: string): AuctionLot[] {
  const $ = load(html);
  const lots: AuctionLot[] = [];

  // Try the most specific selectors first, then fall back to broader ones.
  const cardSelector = [
    '[data-lot-number]',
    '.lot-card',
    '.lot-row',
    '.property-card',
    'article.lot',
  ].join(', ');

  $(cardSelector).each((_i, el) => {
    const $card = $(el);

    const lotRef =
      $card.attr('data-lot-number') ||
      $card.find('.lot-number, .lot-ref').first().text().trim() ||
      null;

    const address =
      $card.find('.lot-address, .property-address, h3, h2').first().text().trim() ||
      null;
    if (!address) return;

    const postcodeMatch = address.match(POSTCODE_REGEX);
    if (!postcodeMatch) return;
    const postcode = `${postcodeMatch[1]} ${postcodeMatch[2]}`.toUpperCase();

    const guideText =
      $card.find('.guide-price, .price, .guide').first().text() ||
      $card.text(); // fallback to whole card text
    const guide = parseGuideText(guideText);

    const dateText =
      $card.find('.auction-date, .sale-date, time').first().text() ||
      $card.find('time').first().attr('datetime') ||
      '';
    const auctionDate = parseDateLoose(dateText) ?? defaultAuctionDate();

    const href = $card.find('a[href]').first().attr('href') || null;
    const lotUrl = href
      ? href.startsWith('http')
        ? href
        : `https://www.auctionhouse.co.uk${href.startsWith('/') ? '' : '/'}${href}`
      : null;

    // Photo URLs — prefer data-src (lazy-loaded) over src, slice to first 10.
    const photoUrls: string[] = [];
    $card.find('img').each((_j, img) => {
      const src = $(img).attr('data-src') || $(img).attr('src') || '';
      if (!src) return;
      const absolute = src.startsWith('http')
        ? src
        : `https://www.auctionhouse.co.uk${src.startsWith('/') ? '' : '/'}${src}`;
      if (photoUrls.length < 10) photoUrls.push(absolute);
    });

    lots.push({
      sourceHouse: 'auction_house_uk',
      sourceLotRef: lotRef ?? `AHN-${postcode.replace(/\s+/g, '')}`,
      auctionDate,
      address: address.replace(/\s+/g, ' ').trim(),
      postcode,
      propertyType: classifyType(address, null),
      guidePriceMinPence: guide.minPence,
      guidePriceMaxPence: guide.maxPence,
      lotUrl,
      photoUrls,
    });
  });

  return lots;
}

// ───────────────────────────────────────────────────────────────────────────
// Extractors
// ───────────────────────────────────────────────────────────────────────────

function extractAddress(item: Record<string, unknown>): string | null {
  const a = item.address;
  if (typeof a === 'string') return a;
  if (typeof a === 'object' && a !== null) {
    const parts: string[] = [];
    const addr = a as Record<string, unknown>;
    if (typeof addr.streetAddress === 'string') parts.push(addr.streetAddress);
    if (typeof addr.addressLocality === 'string') parts.push(addr.addressLocality);
    if (typeof addr.addressRegion === 'string') parts.push(addr.addressRegion);
    if (typeof addr.postalCode === 'string') parts.push(addr.postalCode);
    if (parts.length > 0) return parts.join(', ');
  }
  return typeof item.name === 'string' ? item.name : null;
}

function extractPostcode(item: Record<string, unknown>): string | null {
  const a = item.address;
  if (typeof a === 'object' && a !== null) {
    const addr = a as Record<string, unknown>;
    if (typeof addr.postalCode === 'string') return addr.postalCode;
  }
  const candidate = JSON.stringify(item);
  const m = candidate.match(POSTCODE_REGEX);
  return m ? `${m[1]} ${m[2]}` : null;
}

function extractGuidePrice(item: Record<string, unknown>): {
  minPence: number | null;
  maxPence: number | null;
} {
  // schema.org offers: { price, priceCurrency } or { lowPrice, highPrice }
  const offers = item.offers;
  if (typeof offers === 'object' && offers !== null) {
    const o = offers as Record<string, unknown>;
    const low = numericGuide(o.lowPrice ?? o.price);
    const high = numericGuide(o.highPrice ?? o.price);
    if (low !== null) return { minPence: low * 100, maxPence: (high ?? low) * 100 };
  }

  // Fall back to scanning name / description for "£X" or "£X - £Y"
  const text = `${item.name ?? ''} ${item.description ?? ''}`;
  return parseGuideText(text);
}

function parseGuideText(text: string): {
  minPence: number | null;
  maxPence: number | null;
} {
  const m = text.match(GUIDE_REGEX);
  if (!m) return { minPence: null, maxPence: null };
  const low = numericGuide(m[1]);
  const high = numericGuide(m[2]) ?? low;
  if (low === null) return { minPence: null, maxPence: null };
  return { minPence: low * 100, maxPence: (high ?? low) * 100 };
}

function numericGuide(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.round(raw);
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[£,\s]/g, '');
  const isK = /k$/i.test(cleaned);
  const num = parseFloat(cleaned.replace(/k$/i, ''));
  if (!Number.isFinite(num)) return null;
  return Math.round(isK ? num * 1000 : num);
}

function extractAuctionDate(item: Record<string, unknown>): Date | null {
  const candidates = [
    item.eventStartDate,
    item.startDate,
    item.datePublished,
    item.availabilityStarts,
  ];
  for (const c of candidates) {
    if (typeof c === 'string') {
      const d = new Date(c);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function parseDateLoose(text: string): Date | null {
  if (!text) return null;
  const d = new Date(text);
  if (!Number.isNaN(d.getTime())) return d;
  // Try "DD Month YYYY" / "DD/MM/YYYY"
  const m = text.match(/(\d{1,2})[\s/-]+(\w+|\d{1,2})[\s/-]+(\d{2,4})/);
  if (!m) return null;
  const guess = new Date(m.slice(1).join(' '));
  return Number.isNaN(guess.getTime()) ? null : guess;
}

function extractLotRef(name: string | null, url: string | null): string | null {
  const sources = [name, url].filter((s): s is string => !!s);
  for (const s of sources) {
    const m = s.match(/LOT\s*([A-Z0-9-]+)/i) || s.match(/(AHN[-\w]+)/i);
    if (m) return (m[1] ?? m[0]).toUpperCase().replace(/^LOT/, 'LOT ');
  }
  return null;
}

function defaultAuctionDate(): Date {
  // Auction House UK runs monthly nationals — 21 days out is a safe default
  return new Date(Date.now() + 21 * 24 * 3600 * 1000);
}

function normalisePostcode(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/\s+/g, '');
  if (cleaned.length < 5) return cleaned;
  return `${cleaned.slice(0, -3)} ${cleaned.slice(-3)}`;
}

function classifyType(
  text: string | null,
  item: Record<string, unknown> | null,
): PropertyType {
  const haystack = [
    text,
    item ? String(item.name ?? '') : '',
    item ? String(item.description ?? '') : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/\bcommercial\b|\bretail\b|\bshop\b|\boffice\b/.test(haystack)) return 'commercial';
  if (/\bland\b|\bplot\b|\bsite\b|\bfield\b/.test(haystack)) return 'land';
  if (/\bflat\b|\bapartment\b|\bmaisonette\b/.test(haystack)) return 'flat';
  if (/\bdetached\b/.test(haystack) && !/semi/.test(haystack)) return 'detached';
  if (/\bsemi[-\s]?detached\b|\bsemi\b/.test(haystack)) return 'semi_detached';
  if (/\bterraced\b|\bterrace\b|\bend[-\s]?of[-\s]?terrace\b/.test(haystack))
    return 'terraced_house';
  return 'other';
}
