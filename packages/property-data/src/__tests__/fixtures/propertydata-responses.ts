/**
 * Real PropertyData response bodies, captured 2026-09-13 with
 * `scripts/propertydata-probe.mts --postcode "DL2 3JP"` and trimmed.
 *
 * Structure and value TYPES are exactly as the API sent them (string
 * percentages, comma-grouped pound strings, stringly-typed radii, tuple rows
 * on /growth, per-portal maps on /agents). Only two things changed:
 *   - long arrays are cut to the first few rows;
 *   - street names and house numbers are replaced with placeholders. Postcodes,
 *     towns and every numeric value are the originals.
 *
 * Rule (docs/LEARNINGS.md, 2026-09-12): a PropertyData schema is written from
 * a saved real response and ships with a fixture test of that response. If an
 * endpoint's shape changes, re-run the probe and replace the fixture here —
 * do not edit a fixture by hand to make a test pass.
 */

export const DEMAND_BODY = {
  status: 'success',
  postcode: 'DL2 3JP',
  postcode_type: 'full',
  radius: 1.2,
  total_for_sale: 19,
  average_sales_per_month: 2,
  turnover_per_month: '11%',
  months_of_inventory: '9.1',
  days_on_market: 277,
  demand_rating: 'Balanced market',
  process_time: '0.42',
};

export const FLOOD_RISK_BODY = {
  status: 'success',
  postcode: 'DL2 3JP',
  postcode_type: 'full',
  flood_risk: 'Very Low',
  process_time: '0.04',
};

export const AGENTS_BODY = {
  status: 'success',
  postcode: 'DL2 3JP',
  postcode_type: 'full',
  radius: '3.33',
  data: {
    'zoopla.co.uk': {
      sale: [
        {
          rank: 1,
          agent: 'Hunters',
          branches: ['Bishop Auckland'],
          units_offered: 6,
          total_value: 982500,
          average_value: 123125,
          recent_instructions: [
            {
              address: 'Redacted Street, Cockfield DL13',
              lat: 54.6138,
              lng: -1.801552,
              price: 125000,
              link: 'https://propertydata.co.uk/outbound/zoopla/732748',
            },
          ],
        },
        {
          rank: 2,
          agent: 'Bridgfords',
          branches: ['Darlington'],
          units_offered: 4,
          total_value: 640000,
          average_value: 160000,
          recent_instructions: [],
        },
      ],
      rent: [
        {
          rank: 1,
          agent: 'Bridgfords',
          branches: ['Darlington'],
          units_offered: 2,
          total_value: 335,
          average_value: 168,
          unit: 'gbp_per_week',
          recent_instructions: [
            {
              address: 'Redacted Wynd, Darlington DL2',
              lat: 54.580561,
              lng: -1.807845,
              price: 179,
              link: 'https://propertydata.co.uk/outbound/zoopla/739297',
            },
          ],
        },
      ],
    },
    'onthemarket.com': {
      sale: [
        {
          rank: 1,
          agent: 'Hunters',
          branches: ['Darlington'],
          units_offered: 3,
          total_value: 400000,
          average_value: 133333,
          recent_instructions: [],
        },
      ],
      rent: [],
    },
  },
  process_time: '8.05',
};

export const SOLD_PRICES_BODY = {
  status: 'success',
  postcode: 'DL2 3JP',
  postcode_type: 'full',
  url: 'https://propertydata.co.uk/draw?input=DL2+3JP',
  max_age: 18,
  data: {
    points_analysed: 20,
    radius: '0.45',
    date_earliest: '2025-03-31',
    date_latest: '2026-06-05',
    average: 197150,
    '70pc_range': [130000, 280000],
    '80pc_range': [130000, 320000],
    '90pc_range': [105000, 400000],
    '100pc_range': [56000, 850000],
    raw_data: [
      {
        date: '2025-06-27',
        address: '48, Redacted Green, Staindrop, DL2 3LD',
        price: 240000,
        lat: 54.5795656,
        lng: -1.8089884,
        bedrooms: 3,
        type: 'terraced_house',
        tenure: 'freehold',
        class: 'old_stock',
        distance: '0.03',
        url: 'https://propertydata.co.uk/transaction/REDACTED-1',
      },
      {
        date: '2025-11-14',
        address: 'Redacted Cottage, Front Street, Staindrop, DL2 3NH',
        price: 130000,
        lat: 54.5811,
        lng: -1.8104,
        bedrooms: null,
        type: 'flat',
        tenure: 'freehold',
        class: 'old_stock',
        distance: '0.12',
        url: 'https://propertydata.co.uk/transaction/REDACTED-2',
      },
      {
        date: '2026-02-03',
        address: '7, Redacted Terrace, Staindrop, DL2 3LB',
        price: 850000,
        lat: 54.5789,
        lng: -1.8097,
        bedrooms: 5,
        type: 'detached_house',
        tenure: 'freehold',
        class: 'old_stock',
        distance: '0.05',
        url: 'https://propertydata.co.uk/transaction/REDACTED-3',
      },
    ],
  },
  process_time: '0.85',
};

export const YIELDS_BODY = {
  status: 'success',
  postcode: 'DL2 3JP',
  postcode_type: 'full',
  url: 'https://propertydata.co.uk/draw?input=DL2+3JP',
  data: {
    long_let: { points_analysed: 40, radius: '5.06', gross_yield: '2.8%' },
  },
  process_time: '9.02',
};

export const GROWTH_BODY = {
  status: 'success',
  postcode: 'DL2 3JP',
  postcode_type: 'full',
  url: 'https://propertydata.co.uk/draw?input=DL2+3JP',
  data: [
    ['Sep 2020', 214373, null],
    ['Sep 2021', 231365, '7.9%'],
    ['Sep 2022', 250666, '8.3%'],
    ['Sep 2023', 251656, '0.4%'],
    ['Sep 2024', 240096, '-4.6%'],
    ['Sep 2025', 249680, '4.0%'],
    ['Sep 2026', 240040, '-3.9%'],
  ],
  process_time: '0.09',
};

export const COUNCIL_TAX_BODY = {
  status: 'success',
  postcode: 'DL2 3JP',
  postcode_type: 'full',
  council: 'Durham',
  council_rating: 'Very high tax',
  year: '2026/27',
  council_tax: {
    band_a: '1,748.10',
    band_b: '2,039.45',
    band_c: '2,330.80',
    band_d: '2,622.15',
    band_e: '3,204.85',
    band_f: '3,787.55',
    band_g: '4,370.25',
    band_h: '5,244.30',
  },
  note: 'These figures are the average council tax payable annually by band for a dwelling occupied by 2 adults.',
  properties: [
    { address: 'REDACTED 38, NORTH GREEN, STAINDROP, DARLINGTON', band: 'B' },
    { address: '40, NORTH GREEN, STAINDROP, DARLINGTON', band: 'C' },
  ],
  process_time: '0.03',
};

export const FLOOR_AREAS_BODY = {
  status: 'success',
  postcode: 'DL2 3JP',
  postcode_type: 'full',
  known_floor_areas: [
    {
      inspection_date: '2025-04-09T23:00:00.000000Z',
      address: '34a Redacted Green, Staindrop',
      square_feet: 1206,
      habitable_rooms: 6,
    },
    {
      inspection_date: '2019-08-20T23:00:00.000000Z',
      address: '36 Redacted Green, Staindrop',
      square_feet: 861,
      habitable_rooms: 4,
    },
  ],
  process_time: '0.05',
};

export const PRICES_PER_SQF_BODY = {
  status: 'success',
  postcode: 'DL2 3JP',
  postcode_type: 'full',
  url: 'https://propertydata.co.uk/draw?input=DL2+3JP',
  data: {
    points_analysed: 20,
    radius: '2.28',
    average: 210,
    '70pc_range': [122, 268],
    '80pc_range': [119, 285],
    '90pc_range': [108, 320],
    '100pc_range': [91, 400],
    raw_data: [
      {
        address: 'Redacted Terrace, Staindrop, DL2 3LB',
        price: 299995,
        lat: '54.57928800',
        lng: '-1.80973800',
        bedrooms: 3,
        type: 'detached_house',
        sqf: 1462,
        price_per_sqf: 205,
        distance: '0.05',
        days_on_market: 522,
        sstc: 0,
        portal: 'rightmove.co.uk',
        url: 'https://propertydata.co.uk/outbound/rightmove/REDACTED',
      },
    ],
  },
  process_time: '4.68',
};

export const FREEHOLDS_BODY = {
  status: 'success',
  postcode: 'DL2 3JP',
  postcode_type: 'full',
  url: 'https://propertydata.co.uk/plot-map?input=DL2+3JP',
  result_count: 10,
  api_calls_cost: 1,
  data: [
    {
      title_number: 'DU221229',
      class: 'Absolute freehold title',
      num_polygons: 1,
      polygons: [
        {
          id: 9594671,
          lat: 54.580011441809,
          lng: -1.8092848843038,
          distance: '0.00',
          num_points: 18,
          leaseholds: 0,
        },
      ],
    },
    {
      title_number: 'DU118004',
      class: 'Possessory freehold title',
      num_polygons: 2,
      polygons: [
        {
          id: 9594702,
          lat: 54.5801,
          lng: -1.8091,
          distance: '0.02',
          num_points: 9,
          leaseholds: 3,
        },
        {
          id: 9594703,
          lat: 54.5802,
          lng: -1.809,
          distance: '0.03',
          num_points: 12,
          leaseholds: 0,
        },
      ],
    },
  ],
  process_time: '0.47',
};

export const ENERGY_EFFICIENCY_BODY = {
  status: 'success',
  postcode: 'DL2 3JP',
  postcode_type: 'full',
  energy_efficiency: [
    {
      inspection_date: '2025-04-09T23:00:00.000000Z',
      address: '34a Redacted Green, Staindrop',
      score: 70,
      rating: 'C',
    },
    {
      inspection_date: '2019-08-20T23:00:00.000000Z',
      address: '36 Redacted Green, Staindrop',
      score: 55,
      rating: 'D',
    },
  ],
  process_time: '0.03',
};

/**
 * The shape the code EXPECTED before 2026-09-13 — every field under a
 * `result` object the API never sends. Kept as the drift-guard fixture: a
 * body like this must still be reported as schema drift and never cached.
 */
export const LEGACY_RESULT_SHAPE_BODY = {
  status: 'ok',
  result: { sales_demand_score: 72, days_on_market_average: 45 },
};

/** Routes a stubbed fetch to the fixture for the endpoint in the URL. */
export function fixtureFor(url: string): unknown {
  if (url.includes('/demand')) return DEMAND_BODY;
  if (url.includes('/flood-risk')) return FLOOD_RISK_BODY;
  if (url.includes('/agents')) return AGENTS_BODY;
  if (url.includes('/sold-prices')) return SOLD_PRICES_BODY;
  if (url.includes('/yields')) return YIELDS_BODY;
  if (url.includes('/growth')) return GROWTH_BODY;
  if (url.includes('/council-tax')) return COUNCIL_TAX_BODY;
  if (url.includes('/floor-areas')) return FLOOR_AREAS_BODY;
  if (url.includes('/prices-per-sqf')) return PRICES_PER_SQF_BODY;
  if (url.includes('/freeholds')) return FREEHOLDS_BODY;
  if (url.includes('/energy-efficiency')) return ENERGY_EFFICIENCY_BODY;
  throw new Error(`no fixture for ${url}`);
}
