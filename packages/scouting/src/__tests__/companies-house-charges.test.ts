/**
 * Companies House distress source — parsing/mapping + failure contract.
 *
 * All network-free: parsers run against fixture JSON captured from the
 * Companies House Public Data API shapes (chargeList / filingHistoryList /
 * advanced-search resources), and the end-to-end tests stub global fetch.
 *
 * Locks the visibility contract: a missing COMPANIES_HOUSE_API_KEY or a
 * dead candidate search THROWS (the pipeline records sourceErrors.chDistress)
 * — the source must never silently return zero leads.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCompaniesHouseDistressLeads,
  mapChargeToLead,
  mapInsolvencyToLead,
  parseAdvancedSearchCandidates,
  parseRecentCharges,
  parseRecentInsolvencyFilings,
  type ChCandidateCompany,
} from '../companies-house-charges';
import fixtures from './fixtures/companies-house-charges.json';

// "Now" for every test: 19 Jul 2026 → 48h window starts 17 Jul 2026 12:00.
const ASOF = new Date('2026-07-19T12:00:00Z');
const CUTOFF_MS = ASOF.getTime() - 48 * 3_600_000;

const COMPANY: ChCandidateCompany = {
  companyNumber: '12345678',
  companyName: 'MOSSLANE PROPERTIES LTD',
  registeredAddress: '14 Wilmslow Road, Manchester, M14 5LL',
  registeredPostcode: 'M14 5LL',
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('parseAdvancedSearchCandidates', () => {
  it('keeps only companies registered in the target districts', () => {
    const out = parseAdvancedSearchCandidates(fixtures.advancedSearch, [
      'M14',
      'SK4',
    ]);
    expect(out.map((c) => c.companyNumber)).toEqual(['12345678', '87654321']);
    expect(out[0]!.registeredAddress).toBe(
      '14 Wilmslow Road, Manchester, M14 5LL',
    );
    expect(out[1]!.registeredPostcode).toBe('SK4 4NX');
  });

  it('drops address-less companies when filtering and honours the cap', () => {
    const all = parseAdvancedSearchCandidates(fixtures.advancedSearch, []);
    // No district filter: everything with a company number, including the
    // address-less one (mapping drops it later if it has no address).
    expect(all).toHaveLength(4);

    const capped = parseAdvancedSearchCandidates(fixtures.advancedSearch, [], 2);
    expect(capped).toHaveLength(2);
  });
});

describe('parseRecentCharges', () => {
  it('keeps only live charges delivered inside the window', () => {
    const charges = parseRecentCharges(fixtures.charges, CUTOFF_MS);
    // Charge 2 is old (2024); charge 3 is fully-satisfied — both dropped.
    expect(charges).toHaveLength(1);
    const c = charges[0]!;
    expect(c.chargeRef).toBe('123456780001');
    expect(c.deliveredOn).toBe('2026-07-18');
    expect(c.lender).toBe('SWIFTBRIDGE CAPITAL FINANCE LIMITED');
    expect(c.particulars).toContain('42 Ladybarn Lane');
    expect(c.containsFixedCharge).toBe(true);
    expect(c.classification).toBe('A registered charge');
  });

  it('returns [] for null / malformed payloads', () => {
    expect(parseRecentCharges(null, CUTOFF_MS)).toEqual([]);
    expect(parseRecentCharges({ items: 'nope' }, CUTOFF_MS)).toEqual([]);
  });
});

describe('parseRecentInsolvencyFilings', () => {
  it('keeps only fresh insolvency-category filings', () => {
    const filings = parseRecentInsolvencyFilings(
      fixtures.filingHistory,
      CUTOFF_MS,
    );
    // The 2025 liquidation filing is stale; the accounts filing is the
    // wrong category — only the fresh administrator appointment survives.
    expect(filings).toHaveLength(1);
    expect(filings[0]!.transactionId).toBe('MzAxNTY3ODkw');
    expect(filings[0]!.filingType).toBe('AM01');
    expect(filings[0]!.description).toBe('appoint-administrator-company');
  });
});

describe('mapChargeToLead', () => {
  it('prefers the charged property address from the particulars', () => {
    const [charge] = parseRecentCharges(fixtures.charges, CUTOFF_MS);
    const lead = mapChargeToLead(COMPANY, charge!, ASOF);

    expect(lead).not.toBeNull();
    expect(lead!.source).toBe('companies_house_charge');
    expect(lead!.leadTypeHint).toBe('mortgage_default');
    // Postcode extracted from the particulars text — the actual charged
    // asset — NOT the registered office.
    expect(lead!.postcode).toBe('M14 6WP');
    expect(lead!.address).toContain('42 Ladybarn Lane');
    expect(lead!.grantDate).toBe('2026-07-18');
    expect(lead!.daysSinceGrant).toBe(1);
    expect(lead!.probateRef).toBe('chc-12345678-123456780001');
    expect(lead!.chargeSignal?.lender).toBe(
      'SWIFTBRIDGE CAPITAL FINANCE LIMITED',
    );
  });

  it('falls back to the registered office when the particulars carry no postcode', () => {
    const [charge] = parseRecentCharges(
      fixtures.chargesNoPostcodeParticulars,
      CUTOFF_MS,
    );
    const lead = mapChargeToLead(COMPANY, charge!, ASOF);
    expect(lead!.address).toBe('14 Wilmslow Road, Manchester, M14 5LL');
    expect(lead!.postcode).toBe('M14 5LL');
  });

  it('returns null rather than guessing when no address is derivable', () => {
    const [charge] = parseRecentCharges(
      fixtures.chargesNoPostcodeParticulars,
      CUTOFF_MS,
    );
    const bare: ChCandidateCompany = {
      ...COMPANY,
      registeredAddress: null,
      registeredPostcode: null,
    };
    expect(mapChargeToLead(bare, charge!, ASOF)).toBeNull();
  });
});

describe('mapInsolvencyToLead', () => {
  it('shapes a fresh insolvency filing into a distressed-sale lead', () => {
    const [filing] = parseRecentInsolvencyFilings(
      fixtures.filingHistory,
      CUTOFF_MS,
    );
    const lead = mapInsolvencyToLead(COMPANY, filing!, ASOF);

    expect(lead).not.toBeNull();
    expect(lead!.source).toBe('companies_house_insolvency');
    expect(lead!.leadTypeHint).toBe('distressed_sale');
    expect(lead!.postcode).toBe('M14 5LL');
    expect(lead!.grantDate).toBe('2026-07-18');
    expect(lead!.probateRef).toBe('chi-12345678-MzAxNTY3ODkw');
    expect(lead!.insolvencySignal?.filingType).toBe('AM01');
    expect(lead!.solicitorFirm).toBe('MOSSLANE PROPERTIES LTD');
  });
});

describe('fetchCompaniesHouseDistressLeads — visibility contract', () => {
  it('THROWS when COMPANIES_HOUSE_API_KEY is missing (never a silent skip)', async () => {
    vi.stubEnv('COMPANIES_HOUSE_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchCompaniesHouseDistressLeads({ districts: ['M14'], asOf: ASOF }),
    ).rejects.toThrow(/COMPANIES_HOUSE_API_KEY not configured/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('polls charges + filing history per candidate and emits both lead kinds', async () => {
    vi.stubEnv('COMPANIES_HOUSE_API_KEY', 'test-key');
    const fetchMock = vi.fn(async (url: string) => {
      const body = url.includes('/advanced-search/companies')
        ? fixtures.advancedSearch
        : url.includes('/charges')
          ? fixtures.charges
          : fixtures.filingHistory;
      return {
        ok: true,
        status: 200,
        json: async () => body,
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCompaniesHouseDistressLeads({
      districts: ['M14'],
      asOf: ASOF,
    });

    // One in-district candidate → 1 search + 2 per-company calls.
    expect(result.scanned).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.error).toBeUndefined();
    expect(result.leads.map((l) => l.source).sort()).toEqual([
      'companies_house_charge',
      'companies_house_insolvency',
    ]);
    // Auth header carried on every call (Basic, key as username).
    const firstCall = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const headers = firstCall[1].headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^Basic /);
  });

  it('tolerates a per-company failure with partial results + surfaced error', async () => {
    vi.stubEnv('COMPANIES_HOUSE_API_KEY', 'test-key');
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/advanced-search/companies')) {
        return {
          ok: true,
          status: 200,
          json: async () => fixtures.advancedSearch,
        } as unknown as Response;
      }
      // First candidate (12345678) hard-fails; second (87654321) succeeds.
      if (url.includes('/company/12345678/')) {
        return { ok: false, status: 500 } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () =>
          url.includes('/charges') ? fixtures.charges : fixtures.filingHistory,
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCompaniesHouseDistressLeads({
      districts: ['M14', 'SK4'],
      asOf: ASOF,
    });

    expect(result.scanned).toBe(2);
    expect(result.error).toContain('12345678');
    // The healthy candidate still produced its leads.
    expect(result.leads.length).toBeGreaterThan(0);
    expect(
      result.leads.every((l) => l.probateRef.includes('87654321')),
    ).toBe(true);
  });

  it('THROWS on a failed candidate search (pipeline records sourceErrors)', async () => {
    vi.stubEnv('COMPANIES_HOUSE_API_KEY', 'test-key');
    const fetchMock = vi.fn(
      async () => ({ ok: false, status: 502 }) as unknown as Response,
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchCompaniesHouseDistressLeads({ districts: ['M14'], asOf: ASOF }),
    ).rejects.toThrow(/502/);
  });
});

/**
 * Candidate discovery — location-scoped search with a nationwide fallback.
 *
 * The original implementation asked for 200 active property companies from
 * anywhere in the UK and then kept the ones registered in the ~6 districts we
 * were scanning. Against ~1.7m active companies that is a lottery, and it lost
 * it: production logged `candidates=0 scanned=0 leads=0` for weeks with a
 * perfectly valid API key — no error, no alert, no leads.
 *
 * The fix asks Companies House to filter by registered-office location. That
 * parameter could not be verified against the live API (no egress), so these
 * tests pin the safety property rather than the happy path: the new query can
 * never leave the source worse off than the nationwide sweep it replaces.
 */
describe('fetchCompaniesHouseDistressLeads — candidate discovery', () => {
  const okJson = (body: unknown) =>
    ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

  it('scopes the search by registered-office location when districts are given', async () => {
    vi.stubEnv('COMPANIES_HOUSE_API_KEY', 'test-key');
    const fetchMock = vi.fn(async (url: string) =>
      okJson(
        url.includes('/advanced-search/companies')
          ? fixtures.advancedSearch
          : url.includes('/charges')
            ? fixtures.charges
            : fixtures.filingHistory
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await fetchCompaniesHouseDistressLeads({
      districts: ['M14', 'SK4'],
      asOf: ASOF,
    });

    const searchUrl = (fetchMock.mock.calls[0] as unknown as [string])[0];
    expect(searchUrl).toContain('/advanced-search/companies');
    // URLSearchParams form-encodes the separator, so the space is a '+'.
    expect(searchUrl).toContain('location=M14+SK4');
  });

  it('falls back to the nationwide sweep when the scoped search returns nothing', async () => {
    // The failure mode that matters: `location` is unverified, so it may
    // simply match nothing. An empty result must NOT be accepted as "no
    // distress today" — it must retry the query we know behaves.
    vi.stubEnv('COMPANIES_HOUSE_API_KEY', 'test-key');
    let searchCalls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/advanced-search/companies')) {
        searchCalls++;
        // First (scoped) call: no items. Second (nationwide): the fixture.
        return okJson(searchCalls === 1 ? { items: [] } : fixtures.advancedSearch);
      }
      return okJson(
        url.includes('/charges') ? fixtures.charges : fixtures.filingHistory
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCompaniesHouseDistressLeads({
      districts: ['M14'],
      asOf: ASOF,
    });

    expect(searchCalls).toBe(2);
    expect(result.scanned).toBe(1);
    expect(result.leads.length).toBeGreaterThan(0);
  });

  it('falls back to the nationwide sweep when the scoped search errors', async () => {
    // An unverified parameter can also be rejected outright (this is exactly
    // how `noticetype` took The Gazette down). A 400 must not kill the source.
    vi.stubEnv('COMPANIES_HOUSE_API_KEY', 'test-key');
    let searchCalls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/advanced-search/companies')) {
        searchCalls++;
        if (searchCalls === 1) {
          return { ok: false, status: 400 } as unknown as Response;
        }
        return okJson(fixtures.advancedSearch);
      }
      return okJson(
        url.includes('/charges') ? fixtures.charges : fixtures.filingHistory
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCompaniesHouseDistressLeads({
      districts: ['M14'],
      asOf: ASOF,
    });

    expect(searchCalls).toBe(2);
    expect(result.leads.length).toBeGreaterThan(0);
  });

  it('still THROWS when both the scoped and nationwide searches fail', async () => {
    // The visibility contract is load-bearing and unchanged: a genuinely dead
    // search must reach sourceErrors.chDistress, never a silent zero.
    vi.stubEnv('COMPANIES_HOUSE_API_KEY', 'test-key');
    const fetchMock = vi.fn(
      async () => ({ ok: false, status: 503 }) as unknown as Response
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchCompaniesHouseDistressLeads({ districts: ['M14'], asOf: ASOF })
    ).rejects.toThrow(/503/);
  });

  it('skips the scoped search entirely when no districts are configured', async () => {
    // Nothing to scope by — going straight to the nationwide query avoids
    // spending a request on a query that cannot narrow anything.
    vi.stubEnv('COMPANIES_HOUSE_API_KEY', 'test-key');
    const fetchMock = vi.fn(async (url: string) =>
      okJson(
        url.includes('/advanced-search/companies')
          ? fixtures.advancedSearch
          : url.includes('/charges')
            ? fixtures.charges
            : fixtures.filingHistory
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await fetchCompaniesHouseDistressLeads({ districts: [], asOf: ASOF });

    const searchUrl = (fetchMock.mock.calls[0] as unknown as [string])[0];
    expect(searchUrl).not.toContain('location=');
  });
});
