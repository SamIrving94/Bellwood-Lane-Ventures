/**
 * LLM lot extraction — a catalogue page → typed AuctionLot[] without a
 * CSS selector in sight.
 *
 * ## Why
 *
 * Savills and Clive Emson sat as stubs returning [] for months because
 * each needs its own selector map, and selector maps rot the day a site
 * redesigns. Auction catalogues are, to a person, trivially readable:
 * "Lot 12 · 4 Station Road, Margate CT9 1AB · Guide £120,000+". So we
 * read them the way a person would. The page is stripped to plain text
 * (links kept inline), handed to a cheap model with a strict schema, and
 * every returned row is re-validated by code.
 *
 * ## What the model does NOT decide
 *   - Money. It returns the guide text VERBATIM; `parseGuideText` (the
 *     tested grammar shared with the AH-UK adapter) turns it into pence.
 *     A model that "helpfully" reads £150k as 150 never reaches the DB.
 *   - Postcodes. Validated against the UK pattern; an invalid one is
 *     nulled, never guessed (CLAUDE.md: never fabricate identifiers). A
 *     lot with no usable postcode is dropped, same as the CSS path.
 *   - Whether lots exist. It is told to return [] for a page with none,
 *     and refs are checked so a lot without an address is discarded.
 *
 * Graceful: fetch failure / no key / model failure → [] with a log line,
 * the same contract the other adapters honour. Routable: feature
 * 'auction_lot_extract' on Settings → AI models.
 */

import 'server-only';

import { CLAUDE_HAIKU, callClaudeForObject } from '@repo/ai/claude';
import { load } from 'cheerio';
import { z } from 'zod';
import { parseGuideText } from './sources/auction-house';
import type { AuctionHouse, AuctionLot, PropertyType } from './types';

export const LOT_EXTRACT_FEATURE = 'auction_lot_extract';

const USER_AGENT =
  'BellwoodAuctionScraper/1.0 (+https://wearekept.co.uk; respect robots.txt)';
const FETCH_TIMEOUT_MS = 15_000;
/** Text handed to the model per page. Catalogues past this are paginated. */
const MAX_TEXT_CHARS = 60_000;
/** Catalogue links followed from a landing page. */
const MAX_DISCOVERED_LINKS = 3;
/** Politeness gap between requests to one host. */
const REQUEST_GAP_MS = 500;

const POSTCODE_REGEX = /\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})\b/i;
const CATALOGUE_LINK_REGEX =
  /catalogue|catalog|lots\b|current-auction|upcoming|next-auction|browse/;
const NOT_CATALOGUE_LINK_REGEX =
  /results|past|sold|archive|pdf$|login|register/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const PROPERTY_TYPES = [
  'terraced_house',
  'semi_detached',
  'detached',
  'flat',
  'commercial',
  'land',
  'other',
] as const;

interface ExtractedLot {
  lotNumber: string | null;
  address: string;
  postcode: string | null;
  /** Verbatim, e.g. "Guide Price £120,000+" — parsed by code. */
  guideText: string | null;
  /** YYYY-MM-DD or null. */
  auctionDate: string | null;
  lotUrl: string | null;
  propertyType: PropertyType;
  description: string;
}

interface ExtractedLots {
  lots: ExtractedLot[];
}

// Annotated rather than inferred: the inferred enum-in-array-in-object type
// sends TypeScript's instantiation depth over the limit inside the shared
// client's generic signature.
const LOTS_SCHEMA: z.ZodType<ExtractedLots> = z.object({
  lots: z.array(
    z.object({
      lotNumber: z.string().nullable(),
      address: z.string(),
      postcode: z.string().nullable(),
      guideText: z.string().nullable(),
      auctionDate: z.string().nullable(),
      lotUrl: z.string().nullable(),
      propertyType: z.enum(PROPERTY_TYPES),
      description: z.string(),
    })
  ),
});

const SYSTEM_PROMPT = [
  'You extract auction lots from the plain text of a UK property auction',
  'catalogue page. Links appear inline as [text](url).',
  '',
  'Return JSON: { "lots": [{ lotNumber, address, postcode, guideText,',
  'auctionDate, lotUrl, propertyType, description }] }',
  '',
  'Rules:',
  '- ONLY lots actually listed on the page. If the page has no lots (a',
  '  landing page, a results page, a login wall), return { "lots": [] }.',
  '- Never invent an address, postcode, price or date. Unknown → null.',
  '- guideText: the guide / reserve price text EXACTLY as printed, e.g.',
  '  "Guide Price £120,000+" or "£95,000 - £110,000". Do not convert it.',
  '- postcode: the UK postcode as printed, or null if none is shown.',
  '- auctionDate: the sale date for this lot as YYYY-MM-DD if the page',
  '  states one (often in the catalogue header), else null.',
  '- lotUrl: the link to the lot detail page if one is inline, else null.',
  '- propertyType: one of terraced_house, semi_detached, detached, flat,',
  '  commercial, land, other. Use "other" when unsure.',
  '- description: the lot title/description as printed, up to 300 chars.',
].join('\n');

export interface ExtractLotsInput {
  html: string;
  pageUrl: string;
  sourceHouse: AuctionHouse;
  /** Log prefix, e.g. 'auctions/savills'. */
  tag: string;
}

// ───────────────────────────────────────────────────────────────────────────
// HTML → readable text
// ───────────────────────────────────────────────────────────────────────────

/**
 * Strip a page to the text a person would read, with links kept inline as
 * [text](absolute url) so lot detail pages survive. Exported for tests.
 */
export function htmlToReadableText(html: string, baseUrl: string): string {
  const $ = load(html);
  $('script, style, noscript, svg, iframe, nav, footer, header, form').remove();
  $('a[href]').each((_, el) => {
    const a = $(el);
    const text = a.text().replace(/\s+/g, ' ').trim();
    const href = a.attr('href');
    if (
      !(text && href) ||
      href.startsWith('#') ||
      href.startsWith('javascript:')
    ) {
      return;
    }
    a.replaceWith(`[${text}](${absoluteUrl(href, baseUrl)})`);
  });
  // Block elements → line breaks, so lots do not run into one another.
  $('br').replaceWith('\n');
  $('p, div, li, tr, h1, h2, h3, h4, h5, h6, section, article, dt, dd').each(
    (_, el) => {
      $(el).append('\n');
    }
  );
  const text = ($('body').text() || $.root().text())
    .replace(/[ \t ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.slice(0, MAX_TEXT_CHARS);
}

/**
 * Catalogue-shaped links on a landing page, in page order, de-duplicated.
 * Deterministic on purpose — discovery needs no model. Exported for tests.
 */
export function discoverCatalogueLinks(
  html: string,
  baseUrl: string
): string[] {
  const $ = load(html);
  const seen = new Set<string>();
  const out: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const text = $(el).text().replace(/\s+/g, ' ').trim().toLowerCase();
    const hay = `${href.toLowerCase()} ${text}`;
    if (!CATALOGUE_LINK_REGEX.test(hay)) {
      return;
    }
    if (NOT_CATALOGUE_LINK_REGEX.test(hay)) {
      return;
    }
    const abs = absoluteUrl(href, baseUrl);
    if (!abs.startsWith('http') || seen.has(abs)) {
      return;
    }
    seen.add(abs);
    out.push(abs);
  });
  return out.slice(0, MAX_DISCOVERED_LINKS);
}

function absoluteUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Extraction
// ───────────────────────────────────────────────────────────────────────────

/**
 * Read the lots off one page. Never throws; [] on any failure.
 */
export async function extractLotsFromHtml(
  input: ExtractLotsInput
): Promise<AuctionLot[]> {
  const text = htmlToReadableText(input.html, input.pageUrl);
  if (text.length < 200) {
    return [];
  }

  const result = await callClaudeForObject<ExtractedLots>({
    system: SYSTEM_PROMPT,
    user: `Page: ${input.pageUrl}\n\n${text}`,
    schema: LOTS_SCHEMA,
    maxTokens: 6000,
    temperature: 0,
    model: CLAUDE_HAIKU,
    feature: LOT_EXTRACT_FEATURE,
    attemptTimeoutMs: 90_000,
  });
  if (!result) {
    console.warn(
      `[${input.tag}] lot extraction returned nothing for ${input.pageUrl}`
    );
    return [];
  }

  const lots: AuctionLot[] = [];
  const seenRefs = new Set<string>();
  for (const row of result.lots) {
    const address = row.address.replace(/\s+/g, ' ').trim();
    if (address.length < 6) {
      continue;
    }
    // Postcode: what the model returned if it is a real UK postcode, else
    // one found in the address text, else nothing — never a guess.
    const postcode =
      validPostcode(row.postcode) ?? validPostcode(address) ?? null;
    if (!postcode) {
      continue;
    }
    const guide = row.guideText
      ? parseGuideText(row.guideText)
      : { minPence: null, maxPence: null };
    const auctionDate = parseIsoDate(row.auctionDate) ?? defaultAuctionDate();
    const ref =
      row.lotNumber?.trim() ||
      `${input.sourceHouse.toUpperCase()}-${postcode.replace(/\s+/g, '')}`;
    if (seenRefs.has(ref)) {
      continue;
    }
    seenRefs.add(ref);

    lots.push({
      sourceHouse: input.sourceHouse,
      sourceLotRef: ref,
      auctionDate,
      address,
      postcode,
      propertyType: row.propertyType,
      guidePriceMinPence: guide.minPence,
      guidePriceMaxPence: guide.maxPence,
      lotUrl: row.lotUrl ? absoluteUrl(row.lotUrl, input.pageUrl) : null,
      summary: row.description.slice(0, 1000) || null,
    });
  }
  return lots;
}

/**
 * Fetch a house's entry pages, follow catalogue-shaped links one level
 * down, and extract lots from every page that has them. This is what the
 * Savills and Clive Emson adapters call. Never throws.
 */
export async function fetchCatalogueLots(opts: {
  sourceHouse: AuctionHouse;
  entryUrls: string[];
  tag: string;
}): Promise<AuctionLot[]> {
  const visited = new Set<string>();
  const queue = [...opts.entryUrls];
  const lots: AuctionLot[] = [];

  while (queue.length > 0) {
    const url = queue.shift() as string;
    if (visited.has(url)) {
      continue;
    }
    visited.add(url);
    const html = await fetchHtml(url, opts.tag);
    if (!html) {
      continue;
    }
    const found = await extractLotsFromHtml({
      html,
      pageUrl: url,
      sourceHouse: opts.sourceHouse,
      tag: opts.tag,
    });
    if (found.length > 0) {
      console.info(`[${opts.tag}] extracted ${found.length} lots from ${url}`);
      lots.push(...found);
      continue;
    }
    // A landing page: follow the catalogue links it points at, once.
    if (opts.entryUrls.includes(url)) {
      for (const link of discoverCatalogueLinks(html, url)) {
        if (!visited.has(link)) {
          queue.push(link);
        }
      }
    }
    await sleep(REQUEST_GAP_MS);
  }

  if (lots.length === 0) {
    console.info(
      `[${opts.tag}] 0 lots extracted across ${visited.size} page(s)`
    );
  }
  return dedupeByRef(lots);
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

async function fetchHtml(url: string, tag: string): Promise<string | null> {
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
      console.warn(`[${tag}] HTTP ${res.status} from ${url}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`[${tag}] fetch failed for ${url}`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** A real UK postcode inside `raw`, normalised "OUTWARD INWARD", else null. */
export function validPostcode(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  const m = raw.toUpperCase().match(POSTCODE_REGEX);
  if (!m) {
    return null;
  }
  return `${m[1]} ${m[2]}`;
}

function parseIsoDate(raw: string | null): Date | null {
  if (!(raw && ISO_DATE_REGEX.test(raw))) {
    return null;
  }
  const d = new Date(`${raw}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function defaultAuctionDate(): Date {
  // Same convention as the AH-UK adapter: 21 days out when the page does
  // not state the sale date.
  return new Date(Date.now() + 21 * 24 * 3600 * 1000);
}

function dedupeByRef(lots: AuctionLot[]): AuctionLot[] {
  const seen = new Set<string>();
  return lots.filter((l) => {
    const key = `${l.sourceHouse}:${l.sourceLotRef}:${l.postcode}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
