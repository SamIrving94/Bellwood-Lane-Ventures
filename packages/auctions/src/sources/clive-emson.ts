/**
 * Clive Emson adapter.
 *
 * Source: https://www.cliveemson.co.uk
 *
 * Clive Emson are the largest independent regional land & property
 * auctioneer, covering the south of England. They run 8 sales a year.
 *
 * SCRAPING STATUS: LLM extraction (see ../llm-lot-extract.ts). The
 * landing page is fetched, the "current catalogue" link is followed, and
 * each page's text is read into typed lots by a cheap model with the money
 * parsed by code.
 *
 * The entry URLs below are the paths recorded when this adapter was a
 * stub; they could not be re-verified from the build sandbox (outbound to
 * cliveemson.co.uk is blocked there). Watch Vercel logs for
 * `[auctions/clive-emson]` on the first Monday run.
 *
 * Results are not scraped — returns [] honestly.
 */

import 'server-only';
import { fetchCatalogueLots } from '../llm-lot-extract';
import type { AuctionLot, AuctionResult } from '../types';

const ENTRY_URLS = [
  'https://www.cliveemson.co.uk/catalogue',
  'https://www.cliveemson.co.uk/',
];

export async function fetchCliveEmsonUpcoming(): Promise<AuctionLot[]> {
  return await fetchCatalogueLots({
    sourceHouse: 'clive_emson',
    entryUrls: ENTRY_URLS,
    tag: 'auctions/clive-emson',
  });
}

export function fetchCliveEmsonResults(): Promise<AuctionResult[]> {
  console.info(
    '[auctions/clive-emson] results scraper not implemented — returning []'
  );
  return Promise.resolve([]);
}
