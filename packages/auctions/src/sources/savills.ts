/**
 * Savills Auctions adapter.
 *
 * Source: https://www.savills.co.uk/auctions
 *
 * Savills run national residential + commercial auctions roughly every
 * 6 weeks. Catalogues go live about 3 weeks before each sale date.
 *
 * SCRAPING STATUS: LLM extraction (see ../llm-lot-extract.ts). The
 * landing page is fetched, catalogue-shaped links are followed one level
 * down, and each page's text is read into typed lots by a cheap model
 * with the money parsed by code. No selector map to rot.
 *
 * The entry URLs below are the public catalogue paths recorded when this
 * adapter was a stub; they could not be re-verified from the build
 * sandbox (outbound to savills.co.uk is blocked there). Watch Vercel logs
 * for `[auctions/savills]` on the first Monday run: an HTTP 404 line means
 * the path moved and only this list needs updating.
 *
 * Results (hammer prices) are not scraped — returns [] honestly, same as
 * the AH-UK adapter.
 */

import 'server-only';
import { fetchCatalogueLots } from '../llm-lot-extract';
import type { AuctionLot, AuctionResult } from '../types';

const ENTRY_URLS = [
  'https://auctions.savills.co.uk/',
  'https://www.savills.co.uk/auctions',
];

export async function fetchSavillsUpcoming(): Promise<AuctionLot[]> {
  return await fetchCatalogueLots({
    sourceHouse: 'savills',
    entryUrls: ENTRY_URLS,
    tag: 'auctions/savills',
  });
}

export function fetchSavillsResults(): Promise<AuctionResult[]> {
  console.info(
    '[auctions/savills] results scraper not implemented — returning []'
  );
  return Promise.resolve([]);
}
