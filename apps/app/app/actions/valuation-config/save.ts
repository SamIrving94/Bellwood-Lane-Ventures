'use server';

import { auth } from '@repo/auth/server';
import { type Prisma, database } from '@repo/database';
import { mergeValuationConfig } from '@repo/valuation';
import { revalidatePath } from 'next/cache';
import { VALUATION_CONFIG_KEY } from './constants';

/**
 * Save the valuation methodology levers (condition discounts, refurb £/m² +
 * defect costs, default floor area, target ROI). The incoming partial is run
 * through `mergeValuationConfig`, so malformed/out-of-range values fall back to
 * the defaults rather than persisting garbage. Stored as a single Setting row
 * the appraise action, the lead-appraise cron, and the deal panel all read.
 */
export async function saveValuationConfig(
  partial: unknown
): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Unauthorized' };

  const config = mergeValuationConfig(partial);

  try {
    await database.setting.upsert({
      where: { key: VALUATION_CONFIG_KEY },
      create: {
        key: VALUATION_CONFIG_KEY,
        value: config as unknown as Prisma.InputJsonValue,
      },
      update: { value: config as unknown as Prisma.InputJsonValue },
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to save',
    };
  }

  revalidatePath('/settings/valuation');
  revalidatePath('/leads', 'layout');
  return { ok: true };
}
