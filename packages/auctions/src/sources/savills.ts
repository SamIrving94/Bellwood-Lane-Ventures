/**
 * Savills Auctions adapter.
 *
 * Source: https://www.savills.co.uk/auctions
 *
 * Savills run national residential + commercial auctions roughly every
 * 6 weeks. Catalogues go live about 3 weeks before each sale date.
 *
 * SCRAPING STATUS: not implemented. Returns empty arrays — NEVER fake
 * data in production. The real scraper is straightforward but Savills
 * use a SPA-style catalogue that may need Puppeteer or a JSON API
 * discovery first.
 *
 * TODO (real scraper):
 *   1. GET https://www.savills.co.uk/auctions — find active catalogue link
 *      (selector: a[href*="/auction-catalogue/"] — usually top of page)
 *   2. Follow to /auction-catalogue/{id}
 *   3. Each lot row:
 *        - .lot-number → sourceLotRef
 *        - .property-address → address
 *        - .guide-price → guide range (strip "£", "Guide Price", "+" suffix)
 *        - "View Details" link → lotUrl
 *   4. Savills publishes a PDF catalogue too (linked at top) —
 *      could fall back to PDF scrape if HTML structure changes.
 *   5. Respect robots.txt; add 500ms delay between requests.
 */

import 'server-only';
import type { AuctionLot, AuctionResult } from '../types';

export async function fetchSavillsUpcoming(): Promise<AuctionLot[]> {
  console.info('[auctions/savills] scraper not yet implemented — returning []');
  return [];
}

export async function fetchSavillsResults(): Promise<AuctionResult[]> {
  console.info('[auctions/savills] results scraper not yet implemented — returning []');
  return [];
}
