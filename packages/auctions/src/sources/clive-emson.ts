/**
 * Clive Emson adapter.
 *
 * Source: https://www.cliveemson.co.uk
 *
 * Clive Emson are the largest independent regional land & property
 * auctioneer, covering the south of England. They run 8 sales a year.
 *
 * SCRAPING STATUS: stubbed. Returns realistic synthetic data until the
 * real scraper is implemented.
 */

import 'server-only';
import type { AuctionLot, AuctionResult } from '../types';

const CATALOGUE_URL = 'https://www.cliveemson.co.uk/catalogue';

/**
 * Fetch upcoming Clive Emson lots.
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
 */
export async function fetchCliveEmsonUpcoming(): Promise<AuctionLot[]> {
  // TODO: replace with real fetch + HTML parse
  return synthesize();
}

/**
 * Fetch Clive Emson past results.
 *
 * TODO (real scraper):
 *   1. GET /catalogue/results — rows show hammer prices next to each lot
 *   2. If hammer cell is empty/"Unsold", sold=false
 */
export async function fetchCliveEmsonResults(): Promise<AuctionResult[]> {
  // TODO: replace with real scraper
  return synthesize().map((lot, i) => ({
    ...lot,
    auctionDate: new Date(Date.now() - (21 + i) * 24 * 3600 * 1000),
    sold: true,
    soldPricePence: Math.round(
      (lot.guidePriceMinPence ?? 15_000_000) * (1 + i * 0.05)
    ),
  }));
}

function synthesize(): AuctionLot[] {
  const in35Days = new Date(Date.now() + 35 * 24 * 3600 * 1000);

  return [
    {
      sourceHouse: 'clive_emson',
      sourceLotRef: 'LOT 12',
      auctionDate: in35Days,
      address: '61 Hartopp Road, Four Oaks, Birmingham',
      postcode: 'B74 2QQ',
      propertyType: 'detached',
      guidePriceMinPence: 395_000_00,
      guidePriceMaxPence: 425_000_00,
      lotUrl: `${CATALOGUE_URL}/lot-12`,
    },
    {
      sourceHouse: 'clive_emson',
      sourceLotRef: 'LOT 28',
      auctionDate: in35Days,
      address: '3 Baines Street, Beeston, Leeds',
      postcode: 'LS11 8JB',
      propertyType: 'terraced_house',
      guidePriceMinPence: 68_000_00,
      guidePriceMaxPence: 75_000_00,
      lotUrl: `${CATALOGUE_URL}/lot-28`,
    },
    {
      sourceHouse: 'clive_emson',
      sourceLotRef: 'LOT 39',
      auctionDate: in35Days,
      address: '19 Cheltenham Road, Montpelier, Bristol',
      postcode: 'BS6 5QX',
      propertyType: 'flat',
      guidePriceMinPence: 195_000_00,
      guidePriceMaxPence: 215_000_00,
      lotUrl: `${CATALOGUE_URL}/lot-39`,
    },
    {
      sourceHouse: 'clive_emson',
      sourceLotRef: 'LOT 44',
      auctionDate: in35Days,
      address: '8 Egerton Road, Fallowfield, Manchester',
      postcode: 'M14 6XT',
      propertyType: 'semi_detached',
      guidePriceMinPence: 175_000_00,
      guidePriceMaxPence: 195_000_00,
      lotUrl: `${CATALOGUE_URL}/lot-44`,
    },
    {
      sourceHouse: 'clive_emson',
      sourceLotRef: 'LOT 51',
      auctionDate: in35Days,
      address: '27 Slade Road, Erdington, Birmingham',
      postcode: 'B23 7JQ',
      propertyType: 'terraced_house',
      guidePriceMinPence: 89_000_00,
      guidePriceMaxPence: 99_000_00,
      lotUrl: `${CATALOGUE_URL}/lot-51`,
    },
  ];
}
