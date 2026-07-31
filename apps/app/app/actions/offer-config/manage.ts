'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { mergeOfferConfig } from '@repo/valuation';
import { revalidatePath } from 'next/cache';

/**
 * Append-and-activate a new offer-policy config version (evalType =
 * "avm_confidence"). Mirrors the lead-scoring config flow: append-only, every
 * save creates a NEW version (max + 1) and activates it. The deal-offer action
 * + appraise cron read the highest active version, so the newest activated
 * version always wins, and rollback is just re-saving an older config forward.
 *
 * The incoming partial passes through `mergeOfferConfig`, so it is validated
 * and normalised against the defaults before storage — a malformed field
 * silently degrades to the default rather than persisting garbage.
 */
export async function saveAndActivateOfferConfig(
  partial: unknown,
  description: string,
) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const config = mergeOfferConfig(partial);

  const latest = await database.evalConfig.findFirst({
    where: { evalType: 'avm_confidence' },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const created = await database.evalConfig.create({
    data: {
      evalType: 'avm_confidence',
      version: nextVersion,
      config: config as object,
      description:
        description.trim().slice(0, 200) || `Tuned offer policy v${nextVersion}`,
      activatedAt: new Date(),
      activatedBy: userId,
    },
    select: { version: true },
  });

  revalidatePath('/deals/offer-config');

  return { version: created.version };
}

/**
 * Restore a historical version by cloning its config into a fresh, activated
 * version. Keeps the append-only model intact (no in-place reactivation).
 */
export async function restoreOfferVersion(sourceVersion: number) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const source = await database.evalConfig.findFirst({
    where: { evalType: 'avm_confidence', version: sourceVersion },
    select: { config: true, version: true },
  });
  if (!source) throw new Error('Version not found');

  const latest = await database.evalConfig.findFirst({
    where: { evalType: 'avm_confidence' },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const created = await database.evalConfig.create({
    data: {
      evalType: 'avm_confidence',
      version: nextVersion,
      config: mergeOfferConfig(source.config) as object,
      description: `Restored from v${source.version}`,
      activatedAt: new Date(),
      activatedBy: userId,
    },
    select: { version: true },
  });

  revalidatePath('/deals/offer-config');

  return { version: created.version };
}
