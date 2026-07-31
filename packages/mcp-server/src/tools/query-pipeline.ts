import { z } from 'zod';
import { database } from '@repo/database';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const inputSchema = {
  status: z
    .enum([
      'new_lead',
      'contacted',
      'valuation',
      'offer_made',
      'under_offer',
      'exchanged',
      'completed',
      'rejected',
      'withdrawn',
    ])
    .optional()
    .describe('Pipeline stage to filter by.'),
  since: z
    .string()
    .datetime()
    .optional()
    .describe('ISO datetime — only deals updated at or after this moment.'),
  postcodeArea: z
    .string()
    .optional()
    .describe('Postcode outward code (e.g. "M14") — startsWith match.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .optional()
    .describe('Max deals to return. Default 20.'),
};

export function registerQueryPipeline(server: McpServer): void {
  server.tool(
    'query_pipeline',
    'Query the deal pipeline. Returns deals with stage, address, postcode, expected offer figure, latest activity, and timestamps. Use to answer "what deals are at offer_made stage this week" or "show me everything in M14 that has stalled before exchange".',
    inputSchema,
    async ({ status, since, postcodeArea, limit }) => {
      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (postcodeArea) where.postcode = { startsWith: postcodeArea.toUpperCase() };
      if (since) where.updatedAt = { gte: new Date(since) };

      const deals = await database.deal.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit ?? 20,
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          address: true,
          postcode: true,
          status: true,
          source: true,
          sellerType: true,
          notes: true,
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                count: deals.length,
                filterApplied: { status, since, postcodeArea, limit },
                deals,
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
