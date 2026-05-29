'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { mergeScorerConfig } from '@repo/scouting/src/scorer-config';
import { revalidatePath } from 'next/cache';

/**
 * Append-and-activate a new lead-scoring config version.
 *
 * Configs are append-only: every save creates a NEW version (max + 1) and
 * activates it. The cron + calibration page both read the highest active
 * version, so the newest activated version always wins. "Rolling back" is
 * therefore just re-saving an older config as a new version — the full audit
 * trail is preserved and a bad config is one click away from being reverted.
 *
 * The incoming partial is passed through `mergeScorerConfig`, so it is
 * validated and normalised against the defaults before storage. A malformed
 * field silently falls back to the default rather than persisting garbage.
 */
export async function saveAndActivateConfig(
  partial: unknown,
  description: string,
) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const config = mergeScorerConfig(partial);

  const latest = await database.evalConfig.findFirst({
    where: { evalType: 'lead_scoring' },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const created = await database.evalConfig.create({
    data: {
      evalType: 'lead_scoring',
      version: nextVersion,
      config: config as object,
      description: description.trim().slice(0, 200) || `Tuned config v${nextVersion}`,
      activatedAt: new Date(),
      activatedBy: userId,
    },
    select: { version: true },
  });

  revalidatePath('/leads/scorer-config');
  revalidatePath('/leads/calibration');

  return { version: created.version };
}

/**
 * Restore a historical version by cloning its config into a fresh, activated
 * version. Keeps the append-only model intact (no in-place reactivation).
 */
export async function restoreVersion(sourceVersion: number) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const source = await database.evalConfig.findFirst({
    where: { evalType: 'lead_scoring', version: sourceVersion },
    select: { config: true, version: true },
  });
  if (!source) throw new Error('Version not found');

  const latest = await database.evalConfig.findFirst({
    where: { evalType: 'lead_scoring' },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const created = await database.evalConfig.create({
    data: {
      evalType: 'lead_scoring',
      version: nextVersion,
      config: mergeScorerConfig(source.config) as object,
      description: `Restored from v${source.version}`,
      activatedAt: new Date(),
      activatedBy: userId,
    },
    select: { version: true },
  });

  revalidatePath('/leads/scorer-config');
  revalidatePath('/leads/calibration');

  return { version: created.version };
}
