import { z } from 'zod';
import { getPricePaid, isSyntheticPricePaid } from '@repo/property-data';
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

      // getPricePaid falls back to invented placeholder sales when HMLR is
      // unreachable. Comparables are the whole point of this tool, so refuse
      // them outright rather than hand a caller fake sales it cannot tell
      // apart from real ones.
      if (isSyntheticPricePaid(result)) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  postcode,
                  available: false,
                  reason:
                    'HM Land Registry Price Paid Data is currently unreachable. No real transactions could be retrieved for this postcode — do NOT substitute estimates. Retry later or source comparables another way.',
                  transactions: [],
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
              {
                postcode: result.postcode,
                available: true,
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
