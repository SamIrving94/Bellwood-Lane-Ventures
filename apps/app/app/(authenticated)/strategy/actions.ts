'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';
import {
  DEFAULT_DECISION_STACK,
  STRATEGY_SETTING_KEY,
} from '../../../lib/strategy/default-doc';

export type StrategyDoc = {
  markdown: string;
  updatedBy: string | null;
  updatedAt: string | null;
};

/** Load the live strategy doc, seeding from the default on first read. */
export async function getStrategyDoc(): Promise<StrategyDoc> {
  const row = await database.setting.findUnique({
    where: { key: STRATEGY_SETTING_KEY },
  });
  if (row && row.value && typeof row.value === 'object' && 'markdown' in row.value) {
    const v = row.value as { markdown?: unknown };
    return {
      markdown:
        typeof v.markdown === 'string' ? v.markdown : DEFAULT_DECISION_STACK,
      updatedBy: row.updatedBy ?? null,
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
    };
  }
  return { markdown: DEFAULT_DECISION_STACK, updatedBy: null, updatedAt: null };
}

export type SaveResult =
  | { ok: true; updatedAt: string }
  | { ok: false; error: string };

/** Save edits. Both founders share one live copy (last write wins). */
export async function saveStrategyDoc(markdown: string): Promise<SaveResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Unauthorized' };
  if (typeof markdown !== 'string' || markdown.trim().length === 0) {
    return { ok: false, error: 'Document cannot be empty.' };
  }
  if (markdown.length > 200_000) {
    return { ok: false, error: 'Document is too large.' };
  }

  const saved = await database.setting.upsert({
    where: { key: STRATEGY_SETTING_KEY },
    create: { key: STRATEGY_SETTING_KEY, value: { markdown }, updatedBy: userId },
    update: { value: { markdown }, updatedBy: userId },
  });

  revalidatePath('/strategy');
  return { ok: true, updatedAt: saved.updatedAt.toISOString() };
}
