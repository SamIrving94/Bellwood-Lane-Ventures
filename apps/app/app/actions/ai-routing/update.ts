'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Prisma } from '@repo/database/generated/client';
import { revalidatePath } from 'next/cache';

/**
 * Per-feature model routing table, stored in the generic Setting table
 * under key `model_routing`. Shape: { [feature]: ModelRoute } — see
 * @repo/ai/routing. Both apps read it with a 60s cache, so edits apply
 * within a minute, no deploy.
 */

const SETTING_KEY = 'model_routing';

export interface RouteInput {
  model?: string;
  shadowModel?: string;
  shadowSampleRate?: number;
  /** PII-safe pinning: restricts OpenRouter to vetted US hosts + ZDR. */
  piiSafe?: boolean;
}

/** Vetted OpenRouter hosts for PII-bearing prompts (US-hosted, DPA-backed). */
const PII_PROVIDER_ALLOWLIST = ['deepinfra', 'fireworks', 'together'];

function normalise(input: RouteInput): Record<string, unknown> | null {
  const route: Record<string, unknown> = {};
  const model = input.model?.trim();
  const shadowModel = input.shadowModel?.trim();
  if (model) route.model = model;
  if (shadowModel) route.shadowModel = shadowModel;
  if (
    typeof input.shadowSampleRate === 'number' &&
    input.shadowSampleRate > 0 &&
    input.shadowSampleRate < 1
  ) {
    route.shadowSampleRate = input.shadowSampleRate;
  }
  if (input.piiSafe) {
    route.providerOnly = PII_PROVIDER_ALLOWLIST;
    route.zdr = true;
    route.denyDataCollection = true;
  }
  return Object.keys(route).length > 0 ? route : null;
}

export async function getRoutingTable(): Promise<Record<string, RouteInput>> {
  const row = await database.setting.findUnique({
    where: { key: SETTING_KEY },
  });
  return (row?.value as Record<string, RouteInput>) ?? {};
}

export async function saveRoute(feature: string, input: RouteInput) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  const key = feature.trim();
  if (!key) throw new Error('Feature name required');

  const row = await database.setting.findUnique({
    where: { key: SETTING_KEY },
  });
  const table = { ...((row?.value as Record<string, unknown>) ?? {}) };

  const route = normalise(input);
  if (route) {
    table[key] = route;
  } else {
    delete table[key];
  }

  await database.setting.upsert({
    where: { key: SETTING_KEY },
    create: {
      key: SETTING_KEY,
      value: table as Prisma.InputJsonValue,
      updatedBy: userId,
    },
    update: { value: table as Prisma.InputJsonValue, updatedBy: userId },
  });

  revalidatePath('/settings/ai');
  return { saved: !!route, removed: !route };
}
