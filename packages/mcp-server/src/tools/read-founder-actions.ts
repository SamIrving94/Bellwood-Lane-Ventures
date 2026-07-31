import { z } from 'zod';
import { database } from '@repo/database';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const inputSchema = {
  status: z
    .enum(['pending', 'in_progress', 'completed', 'dismissed'])
    .optional()
    .describe('Filter by action status. Default: pending + in_progress.'),
  type: z
    .string()
    .optional()
    .describe(
      'Filter by action type (e.g. "ceo_escalation", "approve_outreach_draft", "approve_blog_draft", "review_leads", "sla_breach", "general").',
    ),
  priority: z
    .enum(['critical', 'high', 'medium', 'low'])
    .optional()
    .describe('Filter by priority level.'),
  agent: z
    .string()
    .optional()
    .describe('Filter by the agent that created the action (e.g. "scout", "marketer", "appraiser").'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .optional()
    .describe('Max actions to return. Default 20.'),
};

export function registerReadFounderActions(server: McpServer): void {
  server.tool(
    'read_founder_actions',
    'Read the Founder Action Centre. Returns held-for-review items: SLA escalations, draft outreach awaiting approval, draft blog posts, lead-review prompts. This is the queue Sam triages every morning — querying it lets you answer "what needs my eyes today" without opening the dashboard.',
    inputSchema,
    async ({ status, type, priority, agent, limit }) => {
      const where: Record<string, unknown> = {};
      where.status = status
        ? status
        : { in: ['pending', 'in_progress'] };
      if (type) where.type = type;
      if (priority) where.priority = priority;
      if (agent) where.agent = agent;

      const actions = await database.founderAction.findMany({
        where,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        take: limit ?? 20,
        select: {
          id: true,
          createdAt: true,
          status: true,
          type: true,
          priority: true,
          agent: true,
          title: true,
          description: true,
          expiresAt: true,
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                count: actions.length,
                filterApplied: { status, type, priority, agent, limit },
                actions,
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
