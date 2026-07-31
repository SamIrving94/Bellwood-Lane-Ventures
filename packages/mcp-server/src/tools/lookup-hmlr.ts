import { z } from 'zod';
import { getPricePaid } from '@repo/property-data';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const inputSchema = {
  postcode: z
    .string()
    .min(2)
    .describe('UK postcode or outward code (e.g. "M14 5AB" or "M14")'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe('Max number of transactions to return. Default 20.')
    .optional(),
};

export function registerLookupHmlr(server: McpServer): void {
  server.tool(
    'lookup_hmlr_pricepaid',
    'Returns recent HM Land Registry Price Paid Data for a UK postcode area. Each transaction includes sale price, date, address, and property type. Use this to find local comparables for valuation work, time-adjusted via HPI separately.',
    inputSchema,
    async ({ postcode, limit }) => {
      const result = await getPricePaid(postcode, limit ?? 20);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                postcode: result.postcode,
                avgPrice: result.avgPrice,
                source: result.source,
                transactionCount: result.transactions.length,
                transactions: result.transactions.slice(0, 20),
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
