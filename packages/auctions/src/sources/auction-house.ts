/**
 * Auction House UK adapter.
 *
 * Source: https://www.auctionhouse.co.uk/nationalcatalogue
 *
 * Auction House UK is the largest regional auctioneer in the UK. Their
 * national catalogue is public and lists upcoming lots across all regional
 * branches (Manchester, Birmingham, Leeds, London, etc.).
 *
 * SCRAPING STATUS: stubbed. Returns realistic synthetic data until the
 * real scraper is implemented.
 */

import 'server-only';
import type { AuctionLot, AuctionResult } from '../types';

const CATALOGUE_URL = 'https://www.auctionhouse.co.uk/nationalcatalogue';

/**
 * Fetch upcoming lots from Auction House UK's national catalogue.
 *
 * TODO (real scraper):
 *   1. GET ${CATALOGUE_URL}
 *   2. Parse the lot grid — each lot is a card with:
 *        - lot number (data-lot-number)
 *        - address (h3.lot-address)
 *        - guide price (span.guide-price, format "*Guide Price £X+" or "£X - £Y")
 *        - auction date (div.auction-date)
 *        - "View Lot" link → lotUrl
 *   3. Map property type from description text (regex: /terraced|semi|detached|flat/i)
 *   4. Normalise postcode (uppercase, insert space before last 3 chars)
 *   5. Handle pagination (?page=2...) — national catalogue usually ~30 pages
 */
export async function fetchAuctionHouseUKUpcoming(): Promise<AuctionLot[]> {
  // TODO: replace with real fetch + HTML parse
  return synthesize();
}

/**
 * Fetch past results from Auction House UK.
 *
 * TODO (real scraper):
 *   1. GET https://www.auctionhouse.co.uk/results (per region)
 *   2. Each row has: lot ref, address, guide, hammer, sold/unsold badge
 *   3. Map to AuctionResult, setting sold=true + soldPricePence where applicable
 */
export async function fetchAuctionHouseUKResults(): Promise<AuctionResult[]> {
  // TODO: replace with real scraper
  return synthesize().map((lot, i) => ({
    ...lot,
    auctionDate: new Date(Date.now() - (14 + i) * 24 * 3600 * 1000),
    sold: i % 3 !== 0,
    soldPricePence:
      i % 3 !== 0
        ? Math.round((lot.guidePriceMinPence ?? 10_000_000) * 1.12)
        : null,
  }));
}

function synthesize(): AuctionLot[] {
  const in21Days = new Date(Date.now() + 21 * 24 * 3600 * 1000);
  const in28Days = new Date(Date.now() + 28 * 24 * 3600 * 1000);

  return [
    {
      sourceHouse: 'auction_house_uk',
      sourceLotRef: 'AHN-2604-012',
      auctionDate: in21Days,
      address: '14 Alder Road, Moston, Manchester',
      postcode: 'M40 9QR',
      propertyType: 'terraced_house',
      guidePriceMinPence: 85_000_00,
      guidePriceMaxPence: 95_000_00,
      lotUrl: `${CATALOGUE_URL}/lot/AHN-2604-012`,
    },
    {
      sourceHouse: 'auction_house_uk',
      sourceLotRef: 'AHN-2604-018',
      auctionDate: in21Days,
      address: '42 Coventry Road, Small Heath, Birmingham',
      postcode: 'B10 0HA',
      propertyType: 'semi_detached',
      guidePriceMinPence: 115_000_00,
      guidePriceMaxPence: 125_000_00,
      lotUrl: `${CATALOGUE_URL}/lot/AHN-2604-018`,
    },
    {
      sourceHouse: 'auction_house_uk',
      sourceLotRef: 'AHN-2604-033',
      auctionDate: in21Days,
      address: '7 Beeston Road, Holbeck, Leeds',
      postcode: 'LS11 8ND',
      propertyType: 'terraced_house',
      guidePriceMinPence: 72_000_00,
      guidePriceMaxPence: 80_000_00,
      lotUrl: `${CATALOGUE_URL}/lot/AHN-2604-033`,
    },
    {
      sourceHouse: 'auction_house_uk',
      sourceLotRef: 'AHN-2605-004',
      auctionDate: in28Days,
      address: 'Flat 3, 112 Stapleton Road, Easton, Bristol',
      postcode: 'BS5 0ES',
      propertyType: 'flat',
      guidePriceMinPence: 135_000_00,
      guidePriceMaxPence: 145_000_00,
      lotUrl: `${CATALOGUE_URL}/lot/AHN-2605-004`,
    },
    {
      sourceHouse: 'auction_house_uk',
      sourceLotRef: 'AHN-2605-019',
      auctionDate: in28Days,
      address: '88 Washwood Heath Road, Saltley, Birmingham',
      postcode: 'B8 1RD',
      propertyType: 'terraced_house',
      guidePriceMinPence: 95_000_00,
      guidePriceMaxPence: 105_000_00,
      lotUrl: `${CATALOGUE_URL}/lot/AHN-2605-019`,
    },
  ];
}
