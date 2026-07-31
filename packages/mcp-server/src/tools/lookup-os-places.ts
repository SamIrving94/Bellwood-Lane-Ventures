import { z } from 'zod';
import { findPlaces, lookupByPostcode } from '@repo/property-data';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const inputSchema = {
  query: z
    .string()
    .min(2)
    .describe(
      'Either a UK postcode (e.g. "M14 5AB") or a free-text address. When a postcode is passed, returns all properties in that postcode with UPRNs.',
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .optional()
    .describe('Max results when doing a free-text search. Ignored for postcodes.'),
};

const POSTCODE_REGEX = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d?[A-Z]{0,2}$/i;

export function registerLookupOsPlaces(server: McpServer): void {
  server.tool(
    'lookup_os_places',
    'Resolve a UK address or postcode via Ordnance Survey Places. Returns one or more `{ address, postcode, uprn, easting, northing }` records. UPRN is the canonical UK property identifier — use it to link records across sources.',
    inputSchema,
    async ({ query, limit }) => {
      const isPostcode = POSTCODE_REGEX.test(query.trim());
      const results = isPostcode
        ? await lookupByPostcode(query)
        : await findPlaces(query, limit ?? 20);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                queryInterpreted: isPostcode ? 'postcode' : 'address',
                count: results.length,
                results,
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
