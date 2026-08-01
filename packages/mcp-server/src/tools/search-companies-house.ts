import { z } from 'zod';
import {
  searchCompany,
  searchDissolvedPropertyCompanies,
  filterCompaniesByDistrict,
  isSyntheticCompaniesHouse,
} from '@repo/property-data';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const searchInputSchema = {
  name: z
    .string()
    .min(2)
    .describe('Company name to search for (case-insensitive, partial OK)'),
};

const dissolvedInputSchema = {
  districts: z
    .array(z.string().min(1))
    .optional()
    .describe(
      'Optional postcode district filter (e.g. ["M14", "SK4"]). When omitted, returns dissolved property companies across the UK.',
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .optional()
    .describe('Max companies to return. Default 50.'),
};

export function registerSearchCompaniesHouse(server: McpServer): void {
  server.tool(
    'search_companies_house',
    'Search UK Companies House by company name. Returns the top match with company number, status (active / dissolved), incorporation date, registered address, and SIC codes. Use this to verify a vendor company exists, check whether it has been dissolved, or to feed director lookups.',
    searchInputSchema,
    async ({ name }) => {
      const result = await searchCompany(name);

      if (!result) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  query: name,
                  verified: false,
                  found: false,
                  note: 'No Companies House record matched this name (or the lookup was unavailable). This is NOT evidence the company does not exist — report it as "not found", never as "dissolved" or "unverified vendor".',
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      if (isSyntheticCompaniesHouse(result)) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  query: name,
                  verified: false,
                  found: false,
                  note: 'COMPANIES_HOUSE_API_KEY is not configured, so no real lookup happened. Do NOT report any company number, status, or address for this name.',
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { query: name, verified: true, found: true, company: result },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    'search_dissolved_property_companies',
    'Search Companies House for recently-dissolved companies in UK property-related SIC codes (real estate, property development, letting, etc). Optionally filter by postcode district. These are leads — dissolved property companies often own properties that need to be sold off by an administrator.',
    dissolvedInputSchema,
    async ({ districts, limit }) => {
      const all = await searchDissolvedPropertyCompanies({ limit: limit ?? 50 });
      const filtered =
        districts && districts.length > 0
          ? filterCompaniesByDistrict(all, districts)
          : all;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                total: all.length,
                inFilteredDistricts: filtered.length,
                results: filtered,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
