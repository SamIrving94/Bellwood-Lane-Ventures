import { z } from 'zod';
import { getHousepriceIndex } from '@repo/property-data';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const inputSchema = {
  postcode: z
    .string()
    .min(2)
    .describe('UK postcode or outward code — region is derived automatically.'),
};

export function registerLookupHpi(server: McpServer): void {
  server.tool(
    'lookup_hpi',
    "Returns HM Land Registry House Price Index for the region containing a UK postcode. Includes monthly + annual change rates and a coarse trend label (rising / stable / declining). Use this to time-adjust historical comparables and project forward.",
    inputSchema,
    async ({ postcode }) => {
      const result = await getHousepriceIndex(postcode);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
