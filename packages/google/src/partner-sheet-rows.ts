export type PartnerSheetDeal = {
  postcode: string;
  propertyType: string;
  bedrooms: number | null;
  status: string;
  stageEnteredAt: Date;
};

const STAGE_LABEL: Record<string, string> = {
  new_lead: 'New',
  contacted: 'Contacted',
  valuation: 'Valuation',
  offer_made: 'Offer made',
  under_offer: 'Under offer',
  exchanged: 'Exchanged',
  completed: 'Completed',
};

const cell = (value: string | number): string => {
  const text = String(value);
  // A leading = + - @ would run as a formula when the CSV becomes a Sheet.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

// Outward code only. Postcodes are stored with and without the space, so
// this parses rather than splits; anything unrecognised prints blank
// instead of risking a full postcode in a shared sheet.
const outward = (postcode: string): string => {
  const compact = postcode.toUpperCase().replace(/\s+/g, '');
  if (/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(compact)) {
    return compact.slice(0, -3);
  }
  return /^[A-Z]{1,2}\d[A-Z\d]?$/.test(compact) ? compact : '';
};

/**
 * The partner view of the pipeline, as CSV.
 *
 * The input type is the privacy rule: this function cannot print an
 * address, a seller, a price or a full postcode because it is never
 * handed one. Area is the outward code only (SE15, not SE15 4QW).
 */
export const buildPartnerSheetCsv = (
  deals: PartnerSheetDeal[],
  now: Date
): string => {
  const header = [
    'Stage',
    'Area',
    'Property type',
    'Bedrooms',
    'Days in stage',
  ];
  const rows = deals
    .filter((deal) => deal.status in STAGE_LABEL)
    .map((deal) => [
      STAGE_LABEL[deal.status],
      outward(deal.postcode),
      deal.propertyType.replace(/_/g, ' '),
      deal.bedrooms ?? '',
      Math.max(
        0,
        Math.floor((now.getTime() - deal.stageEnteredAt.getTime()) / 86_400_000)
      ),
    ]);
  return [header, ...rows].map((row) => row.map(cell).join(',')).join('\n');
};
