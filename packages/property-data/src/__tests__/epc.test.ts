/**
 * EPC client tests — Energy Performance of Buildings Data API (2026 service).
 *
 * Fixture shapes mirror the official docs / warehouse repo samples:
 *  - search: https://get-energy-performance-data.communities.gov.uk/api-technical-documentation/search-certificates/domestic
 *  - certificate: https://github.com/communitiesuk/epb-data-warehouse/blob/main/spec/fixtures/json_export/rdsap.json
 *
 * No live network: fetch is stubbed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getEpcData,
  parseCertificateResponse,
  pickLatestCertificateNumber,
} from '../epc';

// ---------------------------------------------------------------------------
// Fixtures (new-service response shapes)
// ---------------------------------------------------------------------------

/** GET /api/domestic/search response (camelCase, data + pagination). */
const searchFixture = {
  data: [
    {
      addressLine1: '1 Some Street',
      addressLine2: null,
      addressLine3: null,
      addressLine4: null,
      uprn: 100121241798,
      certificateNumber: '0000-1111-2222-3333-4444',
      constituency: 'Chelsea and Fulham',
      council: 'Hammersmith and Fulham',
      currentEnergyEfficiencyBand: 'B',
      postTown: 'Whitbury',
      postcode: 'SW10 0AA',
      registrationDate: '2018-03-01',
      schemaType: 'RdSAP-Schema-20.0.0',
    },
    {
      addressLine1: '1 Some Street',
      uprn: 100121241798,
      certificateNumber: '9999-8888-7777-6666-5555',
      currentEnergyEfficiencyBand: 'E',
      postcode: 'SW10 0AA',
      registrationDate: '2020-05-04',
      schemaType: 'RdSAP-Schema-20.0.0',
    },
  ],
  pagination: {
    totalRecords: 2,
    currentPage: 1,
    totalPages: 1,
    nextPage: null,
    prevPage: null,
    pageSize: 5000,
  },
};

/**
 * GET /api/certificate response: `{ data: <snake_case EPC document> }`.
 * Field names per the RdSAP JSON export sample in
 * communitiesuk/epb-data-warehouse (spec/fixtures/json_export/rdsap.json).
 */
const certificateFixture = {
  data: {
    address: {
      address_id: 'UPRN-000000000000',
      address_line1: '1 Some Street',
      address_line2: '',
      postcode: 'SW10 0AA',
      town: 'Whitbury',
    },
    assessment_id: '9999-8888-7777-6666-5555',
    current_energy_efficiency_band: 'e', // lowercase in export samples
    current_energy_efficiency_rating: 50,
    date_of_assessment: '2020-05-04',
    date_of_registration: '2020-05-04',
    dwelling_type: 'Mid-terrace house',
    property_type: { description: 'House', value: '0' },
    construction_age_band: {
      description: 'England and Wales: 2007-2011',
      value: 'K',
    },
    habitable_room_count: 5,
    main_heating_descriptions: [
      'Boiler and radiators, anthracite',
      'Boiler and radiators, mains gas',
    ],
    total_floor_area: 55.0,
    type_of_assessment: 'RdSAP',
  },
};

// ---------------------------------------------------------------------------
// Pure parsing (no network)
// ---------------------------------------------------------------------------

describe('pickLatestCertificateNumber', () => {
  it('picks the most recently registered certificate', () => {
    expect(pickLatestCertificateNumber(searchFixture)).toBe(
      '9999-8888-7777-6666-5555'
    );
  });

  it('returns null for empty or malformed bodies', () => {
    expect(pickLatestCertificateNumber({ data: [] })).toBeNull();
    expect(pickLatestCertificateNumber({})).toBeNull();
    expect(pickLatestCertificateNumber(null)).toBeNull();
    expect(pickLatestCertificateNumber('<html>')).toBeNull();
  });
});

describe('parseCertificateResponse', () => {
  it('maps the new snake_case document to the stable Epc shape', () => {
    const epc = parseCertificateResponse(certificateFixture, 'SW10 0AA');
    expect(epc).toEqual({
      postcode: 'SW10 0AA',
      epcRating: 'E', // uppercased from "e"
      epcScore: 50,
      propertyType: 'House',
      floorAreaSqm: 55,
      constructionAgeBand: 'England and Wales: 2007-2011',
      heatingType: 'Boiler and radiators, anthracite',
      totalBedrooms: null, // new API has no bedroom count field
      inspectionDate: '2020-05-04',
      source: 'epc_register',
    });
  });

  it('degrades unknown/missing fields to null, never throws', () => {
    const epc = parseCertificateResponse({ data: {} }, 'FL23 4JA');
    expect(epc.postcode).toBe('FL23 4JA');
    expect(epc.epcRating).toBeNull();
    expect(epc.epcScore).toBeNull();
    expect(epc.propertyType).toBeNull();
    expect(epc.floorAreaSqm).toBeNull();
    expect(epc.constructionAgeBand).toBeNull();
    expect(epc.heatingType).toBeNull();
    expect(epc.inspectionDate).toBeNull();
    expect(epc.source).toBe('epc_register');
  });

  it('falls back to dwelling_type when property_type is absent', () => {
    const epc = parseCertificateResponse(
      { data: { dwelling_type: 'Mid-terrace house' } },
      'SW10 0AA'
    );
    expect(epc.propertyType).toBe('Mid-terrace house');
  });
});

// ---------------------------------------------------------------------------
// getEpcData (stubbed fetch)
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('getEpcData', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('EPC_API_TOKEN', 'test-bearer-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    fetchMock.mockReset();
  });

  it('returns unavailable (all nulls) when EPC_API_TOKEN is unset', async () => {
    vi.stubEnv('EPC_API_TOKEN', '');
    const epc = await getEpcData('SW10 0AA');
    expect(epc.source).toBe('unavailable');
    expect(epc.epcRating).toBeNull();
    expect(epc.floorAreaSqm).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('searches then fetches the certificate with bearer auth', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(searchFixture))
      .mockResolvedValueOnce(jsonResponse(certificateFixture));

    const epc = await getEpcData('sw10 0aa', '1 Some Street');

    expect(epc.epcRating).toBe('E');
    expect(epc.floorAreaSqm).toBe(55);
    expect(epc.constructionAgeBand).toBe('England and Wales: 2007-2011');
    expect(epc.source).toBe('epc_register');

    // Call 1: domestic search on the new API host
    const [searchUrl, searchInit] = fetchMock.mock.calls[0]!;
    expect(String(searchUrl)).toContain(
      'https://api.get-energy-performance-data.communities.gov.uk/api/domestic/search'
    );
    expect(String(searchUrl)).toContain('postcode=SW10+0AA');
    expect(searchInit.headers.Authorization).toBe('Bearer test-bearer-token');

    // Call 2: certificate fetch keyed by the newest certificateNumber
    const [certUrl] = fetchMock.mock.calls[1]!;
    expect(String(certUrl)).toContain(
      '/api/certificate?certificate_number=9999-8888-7777-6666-5555'
    );
  });

  it('returns unavailable on 404 (no certificates for query)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: 'No certificates could be found for that query' }, 404)
    );
    const epc = await getEpcData('ZZ99 9ZZ');
    expect(epc.source).toBe('unavailable');
    expect(epc.postcode).toBe('ZZ99 9ZZ');
  });

  it('returns unavailable on 401 invalid token', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'nope' }, 401));
    const epc = await getEpcData('SW10 0AA');
    expect(epc.source).toBe('unavailable');
  });
});
