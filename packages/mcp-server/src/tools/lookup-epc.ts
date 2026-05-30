import { z } from 'zod';
import { getEpcData } from '@repo/property-data';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const inputSchema = {
  postcode: z.string().min(2).describe('UK postcode (e.g. "M14 5AB")'),
  address: z
    .string()
    .optional()
    .describe(
      'Optional address line — when present, narrows EPC match to the specific property',
    ),
};

export function registerLookupEpc(server: McpServer): void {
  server.tool(
    'lookup_epc',
    'Returns EPC (Energy Performance Certificate) data for a UK property. Includes EPC rating (A-G), floor area, build era, total bedrooms, and address fields. Sourced from the EPC Register. Returns null fields when the property has no EPC on record.',
    inputSchema,
    async ({ postcode, address }) => {
      const result = await getEpcData(postcode, address);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
