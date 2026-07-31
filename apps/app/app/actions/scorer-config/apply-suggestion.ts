'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import {
  applySuggestionChange,
  mergeScorerConfig,
  type SuggestionChange,
} from '@repo/scouting';
import { revalidatePath } from 'next/cache';
import { saveAndActivateConfig } from './manage';

/**
 * One-click apply for a calibration suggestion: load the live scorer
 * config, apply the single proposed change, and save+activate it as a new
 * version (append-only, so reverting is one click on the version history).
 * The human clicked — the machine only prepared the evidence.
 */

const SCALAR_KEYS = new Set([
  'distressBonus',
  'solicitorBonus',
  'lettersOfAdminBonus',
  'marriageValueBase',
  'velocityMax',
]);

function isValidChange(change: SuggestionChange): boolean {
  switch (change.kind) {
    case 'scalar':
      return SCALAR_KEYS.has(change.key);
    case 'leadType':
    case 'condition':
      return typeof change.key === 'string' && change.key.length > 0;
    case 'domBand':
      return typeof change.label === 'string' && change.label.length > 0;
    default:
      return false;
  }
}

export async function applyScorerSuggestion(input: {
  change: SuggestionChange;
  value: number;
  title: string;
}) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  if (!isValidChange(input.change)) throw new Error('Invalid suggestion');
  if (!Number.isFinite(input.value) || input.value < 0 || input.value > 100) {
    throw new Error('Value out of range');
  }

  const active = await database.evalConfig.findFirst({
    where: { evalType: 'lead_scoring', activatedAt: { not: null } },
    orderBy: { version: 'desc' },
    select: { config: true },
  });

  const next = applySuggestionChange(
    mergeScorerConfig(active?.config ?? null),
    input.change,
    input.value,
  );

  const { version } = await saveAndActivateConfig(
    next,
    `Calibration: ${input.title}`.slice(0, 200),
  );

  revalidatePath('/leads/calibration');
  return { version };
}
