import { z } from 'zod';
import { database } from '@repo/database';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const inputSchema = {
  minScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe('Minimum lead score to include (0-100).'),
  verdict: z
    .enum(['STRONG', 'VIABLE', 'THIN', 'PASS', 'INSUFFICIENT_DATA'])
    .optional()
    .describe('Filter to a specific verdict bucket.'),
  postcodeArea: z
    .string()
    .optional()
    .describe('Postcode outward code (e.g. "M14") — matches against the start of the lead postcode.'),
  leadType: z
    .string()
    .optional()
    .describe('Lead type filter (e.g. "probate", "auction", "distressed-listing").'),
  since: z
    .string()
    .datetime()
    .optional()
    .describe('ISO datetime — only leads created at or after this moment.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .optional()
    .describe('Max leads to return. Default 20, max 100.'),
};

export function registerQueryScoutDb(server: McpServer): void {
  server.tool(
    'query_scout_db',
    'Query the scout lead database. Returns matching leads with score, verdict, address, postcode, lead type, and creation timestamp. Use for natural-language exploration like "show me STRONG probate leads in M14 from this week". All filters are AND-combined.',
    inputSchema,
    async ({ minScore, verdict, postcodeArea, leadType, since, limit }) => {
      const where: Record<string, unknown> = {};
      if (typeof minScore === 'number') where.leadScore = { gte: minScore };
      if (verdict) where.verdict = verdict;
      if (postcodeArea) where.postcode = { startsWith: postcodeArea.toUpperCase() };
      if (leadType) where.leadType = leadType;
      if (since) where.createdAt = { gte: new Date(since) };

      const leads = await database.scoutLead.findMany({
        where,
        orderBy: [{ leadScore: 'desc' }, { createdAt: 'desc' }],
        take: limit ?? 20,
        select: {
          id: true,
          createdAt: true,
          address: true,
          postcode: true,
          leadType: true,
          leadScore: true,
          verdict: true,
          marketTrend: true,
          estimatedEquityPence: true,
          source: true,
          contactName: true,
          contactPhone: true,
          contactEmail: true,
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                count: leads.length,
                filterApplied: { minScore, verdict, postcodeArea, leadType, since, limit },
                leads,
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
