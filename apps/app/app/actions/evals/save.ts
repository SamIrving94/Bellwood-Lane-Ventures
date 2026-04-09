'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';

type SaveEvalInput = {
  evalType: 'lead_scoring' | 'avm_confidence' | 'outreach_quality' | 'deal_quality';
  config: Record<string, unknown>;
  description?: string;
};

export async function saveEvalConfig(data: SaveEvalInput) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  // Get the current highest version for this eval type
  const latest = await database.evalConfig.findFirst({
    where: { evalType: data.evalType },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  const newVersion = (latest?.version ?? 0) + 1;

  const config = await database.evalConfig.create({
    data: {
      evalType: data.evalType,
      version: newVersion,
      config: data.config,
      description: data.description,
    },
  });

  revalidatePath('/settings/evals');
  return { configId: config.id, version: newVersion };
}

export async function activateEvalConfig(configId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const config = await database.evalConfig.findUnique({
    where: { id: configId },
  });
  if (!config) throw new Error('Config not found');

  // Deactivate all other versions of this eval type
  await database.evalConfig.updateMany({
    where: {
      evalType: config.evalType,
      activatedAt: { not: null },
    },
    data: { activatedAt: null, activatedBy: null },
  });

  // Activate this version
  await database.evalConfig.update({
    where: { id: configId },
    data: {
      activatedAt: new Date(),
      activatedBy: userId,
    },
  });

  revalidatePath('/settings/evals');
}

// Helper to get the active eval config at runtime
export async function getActiveEvalConfig(evalType: 'lead_scoring' | 'avm_confidence' | 'outreach_quality' | 'deal_quality') {
  const config = await database.evalConfig.findFirst({
    where: {
      evalType,
      activatedAt: { not: null },
    },
    orderBy: { activatedAt: 'desc' },
  });

  return config;
}
