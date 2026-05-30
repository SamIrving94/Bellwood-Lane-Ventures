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
 * Plain-English condition tier inferred from photos.
 * Used downstream by the risk-scoring / AVM flow to adjust comps & yield.
 */
export type VisualCondition =
  | 'pristine'
  | 'fair'
  | 'tired'
  | 'distressed'
  | 'derelict';

/**
 * Discrete flags Claude can attach to a lot based on photo evidence.
 * De-duplicated by the screener before returning.
 */
export type VisualFlag =
  | 'boarded_windows'
  | 'broken_windows'
  | 'roof_damage'
  | 'damp_visible'
  | 'fire_damage'
  | 'no_kitchen'
  | 'no_bathroom'
  | 'overgrown_garden'
  | 'squatting_signs'
  | 'structural_concern'
  | 'recent_refurb';

/**
 * Structured condition assessment produced by `screenAuctionLot`.
 * Attached to AuctionLot.visualAssessment so downstream consumers (the
 * appraiser flow) can downgrade visibly-distressed lots automatically.
 */
export interface VisualAssessment {
  /** 0-10 (10 = pristine showroom condition) */
  conditionScore: number;
  /** Discrete tier — derived from conditionScore + flags */
  condition: VisualCondition;
  /** De-duplicated list of evidence flags */
  flags: VisualFlag[];
  /** Plain English rationale, ≤ 200 chars */
  rationale: string;
  /** Number of photos actually sent to the model */
  photoCount: number;
  /** 0-1 — low when photos were missing, blurry, or only of the exterior */
  confidence: number;
  /** Model identifier, e.g. 'claude-sonnet-4-5' */
  modelUsed: string;
}

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
  /**
   * Photo URLs scraped from the lot's public listing page (typically 5-15).
   * Optional — older scrape paths may not populate this.
   */
  photoUrls?: string[];
  /**
   * Claude-vision condition assessment. Attached by `screenAuctionLot`
   * during the Monday auction-scan cron. Optional — `null`/absent means
   * either no photos were available or vision screening was skipped.
   */
  visualAssessment?: VisualAssessment | null;
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
