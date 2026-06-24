import { database } from '@repo/database';
import { log } from '@repo/observability/log';

/**
 * Cron heartbeat + watchdog support.
 *
 * Each cron records a successful run via `recordCronHeartbeat(name)`, which
 * upserts a `Setting` row keyed `cron:heartbeat:<name>`. The `/cron/watchdog`
 * route reads these back and raises a FounderAction when a cron has gone silent
 * past its expected window — so a failing or timing-out cron is no longer
 * invisible. (A scouting timeout once produced "zero leads for weeks" before
 * anyone noticed, precisely because nothing surfaced the silence.)
 */

export type CronName =
  | 'scouting'
  | 'pipeline-appraise'
  | 'pipeline-outreach'
  | 'pipeline-summary'
  | 'sla-alerts'
  | 'deep-appraisal';

// Max age (hours) between successful runs before the watchdog alerts. Tuned to
// the documented daily schedules with head-room for timezone/retry jitter.
export const CRON_MAX_STALENESS_HOURS: Record<CronName, number> = {
  scouting: 28,
  'pipeline-appraise': 28,
  'pipeline-outreach': 28,
  'pipeline-summary': 28,
  'sla-alerts': 28,
  'deep-appraisal': 28,
};

export type CronHeartbeat = {
  lastSuccessAt: string; // ISO timestamp
  lastRunId?: string;
  note?: string;
};

const settingKey = (name: string) => `cron:heartbeat:${name}`;

/**
 * Record a successful cron run. A heartbeat failure must NEVER break the cron
 * it reports on, so all errors are swallowed (logged at warn).
 */
export async function recordCronHeartbeat(
  name: CronName,
  meta?: { runId?: string; note?: string }
): Promise<void> {
  const value: CronHeartbeat = {
    lastSuccessAt: new Date().toISOString(),
    lastRunId: meta?.runId,
    note: meta?.note,
  };
  try {
    await database.setting.upsert({
      where: { key: settingKey(name) },
      create: { key: settingKey(name), value },
      update: { value },
    });
  } catch (err) {
    log.warn('recordCronHeartbeat failed', {
      name,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function readCronHeartbeat(
  name: CronName
): Promise<CronHeartbeat | null> {
  const row = await database.setting.findUnique({
    where: { key: settingKey(name) },
  });
  return (row?.value as CronHeartbeat | undefined) ?? null;
}
