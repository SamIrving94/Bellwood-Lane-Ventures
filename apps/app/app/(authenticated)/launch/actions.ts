'use server';

import { getFounderSession } from '@repo/auth/server';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';
import {
  LAUNCH_CHECKLIST_SETTING_KEY,
  LAUNCH_TASKS,
} from '../../../lib/launch-checklist';

/**
 * Ticked state for the launch checklist. Task DEFINITIONS ship in code
 * (lib/launch-checklist.ts); this stores only { [taskId]: { doneAt, by } }
 * in the shared Setting row, so both founders see one live board.
 */

export type LaunchTaskState = Record<string, { doneAt: string; by: string }>;

const VALID_IDS = new Set(LAUNCH_TASKS.map((t) => t.id));

export async function getLaunchState(): Promise<LaunchTaskState> {
  const row = await database.setting.findUnique({
    where: { key: LAUNCH_CHECKLIST_SETTING_KEY },
  });
  if (!row?.value || typeof row.value !== 'object') return {};
  const out: LaunchTaskState = {};
  for (const [id, v] of Object.entries(row.value as Record<string, unknown>)) {
    if (
      VALID_IDS.has(id) &&
      v &&
      typeof v === 'object' &&
      typeof (v as { doneAt?: unknown }).doneAt === 'string'
    ) {
      out[id] = {
        doneAt: (v as { doneAt: string }).doneAt,
        by: String((v as { by?: unknown }).by ?? ''),
      };
    }
  }
  return out;
}

export type ToggleResult = { ok: true } | { ok: false; error: string };

/** Tick or untick one task. Last write wins — it is a two-person board. */
export async function toggleLaunchTask(
  taskId: string,
  done: boolean
): Promise<ToggleResult> {
  const session = await getFounderSession();
  if (!session?.userId) return { ok: false, error: 'Unauthorized' };
  if (!VALID_IDS.has(taskId)) return { ok: false, error: 'Unknown task' };

  const current = await getLaunchState();
  const next: LaunchTaskState = { ...current };
  if (done) {
    next[taskId] = { doneAt: new Date().toISOString(), by: session.userId };
  } else {
    delete next[taskId];
  }

  await database.setting.upsert({
    where: { key: LAUNCH_CHECKLIST_SETTING_KEY },
    create: {
      key: LAUNCH_CHECKLIST_SETTING_KEY,
      value: next as never,
      updatedBy: session.userId,
    },
    update: { value: next as never, updatedBy: session.userId },
  });

  revalidatePath('/launch');
  return { ok: true };
}
