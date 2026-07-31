/**
 * Companies House API client
 *
 * Used for probate lead enrichment: identifies whether the estate is held by
 * a company (e.g. executor-controlled property company, LPA receiver) and
 * returns basic officer/director data to support outreach.
 *
 * Free API — register at: https://developer.company-information.service.gov.uk/
 *
 * Required env var (see keys.ts):
 *   COMPANIES_HOUSE_API_KEY  — API key (used as Basic auth username; password blank)
 *
 * Falls back to synthetic data when credentials are absent or the call fails.
 */

import { z } from 'zod';

const CH_BASE = 'https://api.company-information.service.gov.uk';

const REQUEST_TIMEOUT_MS = 8_000;

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const CompanySchema = z.object({
  companyName: z.string(),
  companyNumber: z.string(),
  companyType: z.string().nullable(),
  companyStatus: z.string().nullable(),
  incorporatedOn: z.string().nullable(),
  registeredAddress: z.string().nullable(),
  sicCodes: z.array(z.string()),
  source: z.string(),
});

export const OfficerSchema = z.object({
  name: z.string(),
  officerRole: z.string().nullable(),
  appointedOn: z.string().nullable(),
  address: z.string().nullable(),
  nationality: z.string().nullable(),
  source: z.string(),
});

export const EstateOwnershipSchema = z.object({
  solicitorCompany: CompanySchema.nullable(),
  contactOfficer: OfficerSchema.nullable(),
  estateHeldByCompany: z.boolean(),
});

export type Company = z.infer<typeof CompanySchema>;
export type Officer = z.infer<typeof OfficerSchema>;
export type EstateOwnership = z.infer<typeof EstateOwnershipSchema>;

// ---------------------------------------------------------------------------
// Synthetic fallback
// ---------------------------------------------------------------------------

const COMPANY_TYPES = [
  'private-unlimited',
  'ltd',
  'private-limited-guarant-nsc-limited-exemption',
];
const COMPANY_STATUSES = ['active', 'active', 'active', 'dissolved', 'liquidation'];

function syntheticCompany(name?: string): Company {
  const num = `${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
  const surnames = ['Smith', 'Jones', 'Patel'];
  return {
    companyName:
      name ??
      `${surnames[Math.floor(Math.random() * surnames.length)]} Estate Management Ltd`,
    companyNumber: num,
    companyType:
      COMPANY_TYPES[Math.floor(Math.random() * COMPANY_TYPES.length)] ?? null,
    companyStatus:
      COMPANY_STATUSES[Math.floor(Math.random() * COMPANY_STATUSES.length)] ??
      null,
    incorporatedOn: new Date(
      Date.now() - Math.floor(Math.random() * 20 * 365 * 86_400_000)
    )
      .toISOString()
      .slice(0, 10),
    registeredAddress: '123 High Street, London, EC1A 1BB',
    sicCodes: ['68100', '68209'],
    source: 'synthetic',
  };
}

function syntheticOfficer(name?: string): Officer {
  return {
    name: name ?? 'J. PATEL',
    officerRole: 'director',
    appointedOn: new Date(
      Date.now() - Math.floor(Math.random() * 10 * 365 * 86_400_000)
    )
      .toISOString()
      .slice(0, 10),
    address: '123 High Street, London, EC1A 1BB',
    nationality: 'British',
    source: 'synthetic',
  };
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function chGet(
  path: string,
  queryParams: Record<string, string | number> = {}
): Promise<unknown> {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY ?? '';
  const url = new URL(`${CH_BASE}${path}`);
  for (const [k, v] of Object.entries(queryParams)) {
    url.searchParams.set(k, String(v));
  }

  const creds = Buffer.from(`${apiKey}:`).toString('base64');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${creds}`,
      },
      signal: controller.signal,
    });
    if (res.status === 401)
      throw new Error('Companies House: invalid API key');
    if (res.status === 404) return null;
    if (!res.ok)
      throw new Error(`Companies House ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Live fetch helpers
// ---------------------------------------------------------------------------

async function searchCompanyLive(name: string): Promise<Company | null> {
  const data = (await chGet('/search/companies', {
    q: name,
    items_per_page: 3,
  })) as Record<string, unknown> | null;

  if (!data?.items) return null;
  const items = data.items as Record<string, unknown>[];
  if (!items.length) return null;

  const item = items[0]!;
  const addr = item.address as Record<string, string> | undefined;

  return {
    companyName: String(item.title ?? ''),
    companyNumber: String(item.company_number ?? ''),
    companyType: (item.company_type as string | undefined) ?? null,
    companyStatus: (item.company_status as string | undefined) ?? null,
    incorporatedOn: (item.date_of_creation as string | undefined) ?? null,
    registeredAddress: addr
      ? `${addr.address_line_1 ?? ''} ${addr.locality ?? ''} ${addr.postal_code ?? ''}`.trim()
      : null,
    sicCodes: (item.sic_codes as string[] | undefined) ?? [],
    source: 'companies_house',
  };
}

async function searchOfficerLive(name: string): Promise<Officer | null> {
  const data = (await chGet('/search/officers', {
    q: name,
    items_per_page: 3,
  })) as Record<string, unknown> | null;

  if (!data?.items) return null;
  const items = data.items as Record<string, unknown>[];
  if (!items.length) return null;

  const item = items[0]!;
  const addr = item.address as Record<string, string> | undefined;

  return {
    name: String((item.title as string | undefined) ?? (item.name as string | undefined) ?? ''),
    officerRole: (item.officer_role as string | undefined) ?? null,
    appointedOn:
      (item.appointment_date as string | undefined) ??
      (item.date_of_birth as string | undefined) ??
      null,
    address: addr
      ? `${addr.address_line_1 ?? ''} ${addr.locality ?? ''} ${addr.postal_code ?? ''}`.trim()
      : null,
    nationality: (item.nationality as string | undefined) ?? null,
    source: 'companies_house',
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up a company by name — useful for executor-held estates.
 */
export async function searchCompany(name: string): Promise<Company | null> {
  if (!name) return null;
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY ?? '';
  if (apiKey) {
    try {
      const result = await searchCompanyLive(name);
      if (result) return result;
    } catch (err) {
      console.warn(
        `[property-data/companies-house] company search failed (${(err as Error).message}), using synthetic`
      );
    }
  }
  return syntheticCompany(name);
}

/**
 * Look up a person as a Companies House officer — useful for probate contacts.
 */
export async function searchOfficer(name: string): Promise<Officer | null> {
  if (!name) return null;
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY ?? '';
  if (apiKey) {
    try {
      const result = await searchOfficerLive(name);
      if (result) return result;
    } catch (err) {
      console.warn(
        `[property-data/companies-house] officer search failed (${(err as Error).message}), using synthetic`
      );
    }
  }
  return syntheticOfficer(name);
}

// ---------------------------------------------------------------------------
// Dissolved property companies — distress-signal source for scouting
// ---------------------------------------------------------------------------

/**
 * SIC codes for residential property holding. Directors of companies
 * dissolved with these codes are frequently motivated sellers of the
 * underlying property assets.
 *  68100 — Buying and selling of own real estate
 *  68201 — Renting and operating of Housing Association real estate
 *  68209 — Other letting and operating of own or leased real estate
 *  68310 — Real estate agencies
 *  68320 — Management of real estate
 */
export const PROPERTY_SIC_CODES = [
  '68100',
  '68201',
  '68209',
  '68310',
  '68320',
] as const;

export type DissolvedPropertyCompany = {
  companyNumber: string;
  companyName: string;
  dissolvedAt: string | null;
  incorporatedAt: string | null;
  sicCodes: string[];
  registeredAddress: string | null;
  registeredPostcode: string | null;
};

/**
 * Search dissolved property companies via Companies House advanced search.
 * Returns [] silently if COMPANIES_HOUSE_API_KEY is missing — keeps the
 * scouting pipeline alive without this enrichment.
 */
export async function searchDissolvedPropertyCompanies(opts?: {
  sinceDate?: string;
  sicCodes?: readonly string[];
  limit?: number;
}): Promise<DissolvedPropertyCompany[]> {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY ?? '';
  if (!apiKey) {
    console.info(
      '[companies-house] no API key — skipping dissolved-company scan',
    );
    return [];
  }
  const sinceDate =
    opts?.sinceDate ??
    new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
  const sicCodes = opts?.sicCodes ?? PROPERTY_SIC_CODES;
  const limit = opts?.limit ?? 50;

  const out: DissolvedPropertyCompany[] = [];
  const seen = new Set<string>();

  // Companies House advanced-search filters one SIC per call. Iterate
  // sequentially — well under the 600/5min rate limit.
  for (const sic of sicCodes) {
    if (out.length >= limit) break;
    try {
      const data = (await chGet('/advanced-search/companies', {
        company_status: 'dissolved',
        sic_codes: sic,
        dissolved_from: sinceDate,
        size: 50,
      })) as Record<string, unknown> | null;
      const items = (data?.items as Record<string, unknown>[] | undefined) ?? [];
      for (const item of items) {
        if (out.length >= limit) break;
        const number =
          typeof item.company_number === 'string'
            ? item.company_number
            : null;
        if (!number || seen.has(number)) continue;
        seen.add(number);

        const addr = item.registered_office_address as
          | Record<string, string | undefined>
          | undefined;
        const parts = addr
          ? [
              addr.address_line_1,
              addr.address_line_2,
              addr.locality,
              addr.postal_code,
            ].filter(Boolean)
          : [];

        out.push({
          companyNumber: number,
          companyName:
            typeof item.company_name === 'string'
              ? item.company_name
              : '(unknown)',
          dissolvedAt:
            typeof item.date_of_cessation === 'string'
              ? item.date_of_cessation
              : null,
          incorporatedAt:
            typeof item.date_of_creation === 'string'
              ? item.date_of_creation
              : null,
          sicCodes:
            (item.sic_codes as string[] | undefined) ?? [],
          registeredAddress: parts.length > 0 ? parts.join(', ') : null,
          registeredPostcode: addr?.postal_code ?? null,
        });
      }
    } catch (err) {
      console.warn(
        `[companies-house] dissolved search SIC ${sic} failed`,
        err,
      );
    }
  }
  return out;
}

/**
 * Filter dissolved companies by postcode-district prefix.
 * E.g. ['M14', 'SK4'] keeps only companies registered in those districts.
 */
export function filterCompaniesByDistrict(
  companies: DissolvedPropertyCompany[],
  districts: readonly string[],
): DissolvedPropertyCompany[] {
  if (districts.length === 0) return companies;
  const upper = districts.map((d) => d.toUpperCase().replace(/\s+/g, ''));
  return companies.filter((c) => {
    if (!c.registeredPostcode) return false;
    const pc = c.registeredPostcode.toUpperCase().replace(/\s+/g, '');
    return upper.some((d) => pc.startsWith(d));
  });
}

/**
 * Enrich a probate lead with Companies House data.
 * Searches for the solicitor firm and checks if the contact is a director/officer.
 */
export async function enrichEstateCompany(lead: {
  solicitorFirm?: string;
  contactName?: string;
}): Promise<EstateOwnership> {
  const [company, officer] = await Promise.all([
    lead.solicitorFirm
      ? searchCompany(lead.solicitorFirm)
      : Promise.resolve(null),
    lead.contactName
      ? searchOfficer(lead.contactName)
      : Promise.resolve(null),
  ]);

  return {
    solicitorCompany: company,
    contactOfficer: officer,
    estateHeldByCompany: company?.companyStatus === 'active',
  };
}
