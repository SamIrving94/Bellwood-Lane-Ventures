/**
 * Savills Auctions adapter.
 *
 * Source: https://www.savills.co.uk/auctions
 *
 * Savills run national residential + commercial auctions roughly every
 * 6 weeks. Catalogues go live about 3 weeks before each sale date.
 *
 * SCRAPING STATUS: stubbed. Returns realistic synthetic data until the
 * real scraper is implemented.
 */

import 'server-only';
import type { AuctionLot, AuctionResult } from '../types';

const CATALOGUE_URL = 'https://www.savills.co.uk/auctions';

/**
 * Fetch upcoming lots from the current Savills auction catalogue.
 *
 * TODO (real scraper):
 *   1. GET ${CATALOGUE_URL} — find the active catalogue link
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
export async function fetchSavillsUpcoming(): Promise<AuctionLot[]> {
  // TODO: replace with real fetch + HTML parse
  return synthesize();
}

/**
 * Fetch Savills past auction results.
 *
 * TODO (real scraper):
 *   1. GET https://www.savills.co.uk/auctions/auction-results
 *   2. Results are grouped by sale date; each row has hammer price or "unsold"
 */
export async function fetchSavillsResults(): Promise<AuctionResult[]> {
  // TODO: replace with real scraper
  return synthesize().map((lot, i) => ({
    ...lot,
    auctionDate: new Date(Date.now() - (30 + i * 2) * 24 * 3600 * 1000),
    sold: i !== 1,
    soldPricePence:
      i !== 1
        ? Math.round((lot.guidePriceMinPence ?? 20_000_000) * 1.08)
        : null,
  }));
}

function synthesize(): AuctionLot[] {
  const in18Days = new Date(Date.now() + 18 * 24 * 3600 * 1000);

  return [
    {
      sourceHouse: 'savills',
      sourceLotRef: 'LOT 47',
      auctionDate: in18Days,
      address: '23 Palatine Road, West Didsbury, Manchester',
      postcode: 'M20 3LJ',
      propertyType: 'semi_detached',
      guidePriceMinPence: 285_000_00,
      guidePriceMaxPence: 315_000_00,
      lotUrl: `${CATALOGUE_URL}/lot-47`,
    },
    {
      sourceHouse: 'savills',
      sourceLotRef: 'LOT 58',
      auctionDate: in18Days,
      address: '9 Whiteladies Road, Clifton, Bristol',
      postcode: 'BS8 2LX',
      propertyType: 'flat',
      guidePriceMinPence: 225_000_00,
      guidePriceMaxPence: 250_000_00,
      lotUrl: `${CATALOGUE_URL}/lot-58`,
    },
    {
      sourceHouse: 'savills',
      sourceLotRef: 'LOT 63',
      auctionDate: in18Days,
      address: '104 Roundhay Road, Harehills, Leeds',
      postcode: 'LS8 5PL',
      propertyType: 'terraced_house',
      guidePriceMinPence: 95_000_00,
      guidePriceMaxPence: 110_000_00,
      lotUrl: `${CATALOGUE_URL}/lot-63`,
    },
    {
      sourceHouse: 'savills',
      sourceLotRef: 'LOT 71',
      auctionDate: in18Days,
      address: '5 Augusta Road, Moseley, Birmingham',
      postcode: 'B13 8JJ',
      propertyType: 'detached',
      guidePriceMinPence: 475_000_00,
      guidePriceMaxPence: 525_000_00,
      lotUrl: `${CATALOGUE_URL}/lot-71`,
    },
  ];
}
