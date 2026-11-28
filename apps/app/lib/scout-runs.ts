import type { Prisma } from '@repo/database';

/**
 * The scout's own run record, and nothing else.
 *
 * `leads_created` is not unique to the scout. The Companies House stream
 * drain (every 30 minutes) writes the same event type, so reading it
 * unfiltered made "Last scout run" show the drain's time and summary: a
 * scout that had not run for days looked as if it ran half an hour ago.
 *
 * The scouting cron tags its event `payload.source = 'cron_scouting'`
 * (apps/api/app/cron/scouting/route.ts). Only that event counts as a run.
 * Both pages that show the last run read through this one filter, so they
 * cannot drift apart.
 */
export const SCOUT_RUN_WHERE = {
  eventType: 'leads_created',
  payload: { path: ['source'], equals: 'cron_scouting' },
} satisfies Prisma.AgentEventWhereInput;
