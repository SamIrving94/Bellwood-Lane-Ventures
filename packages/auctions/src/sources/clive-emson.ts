/**
 * Clive Emson adapter.
 *
 * Source: https://www.cliveemson.co.uk
 *
 * Clive Emson are the largest independent regional land & property
 * auctioneer, covering the south of England. They run 8 sales a year.
 *
 * SCRAPING STATUS: not implemented. Returns empty arrays — NEVER fake
 * data in production.
 *
 * TODO (real scraper):
 *   1. GET https://www.cliveemson.co.uk/ — find the "Current Catalogue" CTA
 *   2. Follow to /catalogue
 *   3. Each .lot-card has:
 *        - .lot-number
 *        - .lot-address
 *        - .guide-price (format "*Guide: £X" or "£X - £Y")
 *        - .lot-description → use for property type classification
 *   4. Clive Emson publishes lot-by-lot PDFs — skip those, HTML is richer.
 *   5. Each sale has a single date — fetch from the catalogue header.
 *
 * Recommended starting point: copy the JSON-LD strategy from
 * packages/auctions/src/sources/auction-house.ts and run it against
 * the cliveemson.co.uk catalogue. Most modern auction sites embed
 * schema.org Product / RealEstateListing markup.
 */

import 'server-only';
import type { AuctionLot, AuctionResult } from '../types';

export async function fetchCliveEmsonUpcoming(): Promise<AuctionLot[]> {
  console.info('[auctions/clive-emson] scraper not yet implemented — returning []');
  return [];
}

export async function fetchCliveEmsonResults(): Promise<AuctionResult[]> {
  console.info('[auctions/clive-emson] results scraper not yet implemented — returning []');
  return [];
}
