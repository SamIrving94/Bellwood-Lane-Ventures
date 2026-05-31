/**
 * Local shape mirror of DeepAppraisal from @repo/valuation.
 *
 * We mirror it here (rather than importing the Zod type) so the UI doesn't
 * pull `ai` / `@ai-sdk/anthropic` into the client bundle. Stays in sync via
 * the cron's structured-output schema — when the producer schema changes,
 * update this too.
 */

export type Comparable = {
  address: string;
  saleDate: string;
  pricePence: number;
  floorAreaSqm: number | null;
  pricePerSqm: number | null;
  notes: string;
  cleanestMatch: boolean;
  excluded: boolean;
  exclusionReason: string | null;
};

export type EnvironmentalRisk = {
  risk: 'coal_mining' | 'radon' | 'flood' | 'knotweed' | 'noise' | 'construction';
  rating: 'high' | 'medium-high' | 'medium' | 'medium-low' | 'low';
  material: boolean;
  notes: string;
};

export type DiscountLine = {
  label: string;
  percent: number;
  reasoning: string;
};

export type PreAuctionAction = {
  action: string;
  blocking: boolean;
  deadline: string | null;
};

export type DeepAppraisalLite = {
  property: {
    address: string;
    postcode: string;
    propertyTypeDescribed: string;
    floorAreaSqm: number | null;
    epcRating: string | null;
    councilTaxBand: string | null;
    refurbishmentSignals: string[];
  };
  comparables: {
    selected: Comparable[];
    cleanestMatchAddress: string | null;
    postcodeAvgPence: number | null;
    methodology: string;
  };
  arv: {
    pointEstimatePence: number;
    ci50LowPence: number;
    ci50HighPence: number;
    ci80LowPence: number;
    ci80HighPence: number;
    reasoning: string;
  };
  condition: {
    greenFlags: string[];
    amberFlags: string[];
    unverified: string[];
  };
  environment: EnvironmentalRisk[];
  bidCap: {
    isAuction: boolean;
    discountStack: DiscountLine[];
    totalDeductionPercent: number;
    hardCapPence: number;
    softTargetPence: number;
    probabilityOfWinningPercent: number | null;
  } | null;
  recommendation: {
    verdict: 'bid' | 'walk' | 'bid_with_caveats' | 'further_investigation';
    headline: string;
    rationale: string;
  };
  preAuctionActions: PreAuctionAction[];
  confidence: {
    estimatedErrorPercent: number;
    level: 'high' | 'moderate' | 'low';
    drivers: string[];
  };
  escalations: string[];
};

export type AppraisalMetadata = {
  kind: 'lead' | 'auction';
  entityId: string;
  listingUrl: string | null;
  appraisal: DeepAppraisalLite;
  link: string;
};
