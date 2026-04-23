/**
 * Shared types for the @repo/auctions package.
 *
 * Auction data is scraped from free public sources (Auction House UK,
 * Savills, Clive Emson). EIG (the paid industry standard) is deliberately
 * skipped — we prefer free sources and accept lower coverage.
 */

export type AuctionHouse =
  | 'auction_house_uk'
  | 'savills'
  | 'clive_emson';

export type PropertyType =
  | 'terraced_house'
  | 'semi_detached'
  | 'detached'
  | 'flat'
  | 'commercial'
  | 'land'
  | 'other';

/**
 * A single auction lot — as scraped from a public catalogue.
 * Prices are in pence (matches the rest of the Bellwood schema).
 */
export interface AuctionLot {
  /** Source auction house identifier */
  sourceHouse: AuctionHouse;
  /** The house's own lot reference number (e.g. "LOT 42") */
  sourceLotRef: string;
  /** When the auction is scheduled */
  auctionDate: Date;
  /** Full address as advertised */
  address: string;
  /** UK postcode (uppercase, with space) */
  postcode: string;
  propertyType: PropertyType;
  /** Guide-price lower bound, in pence */
  guidePriceMinPence: number | null;
  /** Guide-price upper bound, in pence */
  guidePriceMaxPence: number | null;
  /** Public URL to the lot listing */
  lotUrl: string | null;
}

/**
 * A past auction result — whether the lot sold, and if so, at what price.
 */
export interface AuctionResult extends AuctionLot {
  sold: boolean;
  soldPricePence: number | null;
}

export interface AuctionFilters {
  /** ISO date strings bounding the auction date */
  fromDate?: string;
  toDate?: string;
  /** Postcode prefix(es) — e.g. ['M', 'B', 'LS', 'BS'] */
  postcodeAreas?: string[];
  propertyTypes?: PropertyType[];
  maxGuidePricePence?: number;
  minGuidePricePence?: number;
  /** Restrict to a specific source house */
  sourceHouses?: AuctionHouse[];
}
