'use server';

import { auth } from '@repo/auth/server';
import { database, Prisma } from '@repo/database';
import { revalidatePath } from 'next/cache';

type SubmitFeedbackInput = {
  targetType: 'scout_lead' | 'avm_result' | 'outreach_template' | 'outreach_campaign' | 'legal_step' | 'deal' | 'founder_action' | 'campaign';
  targetId: string;
  rating: number;
  overrides?: Record<string, unknown>;
  /**
   * Snapshot of the scoring inputs at the moment of feedback.
   * Stored alongside overrides under the _context key so the
   * calibration page can analyse which factors are mis-weighted.
   */
  context?: Record<string, unknown>;
  notes?: string;
  markedAsTemplate?: boolean;
};

export async function submitFeedback(data: SubmitFeedbackInput) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  if (data.rating < 1 || data.rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  // Merge context (snapshot of scoring inputs) into overrides JSON under
  // _context. The applyOverrides path ignores keys starting with _ so this
  // is a transparent passthrough — the calibration query reads it directly.
  const mergedOverrides = {
    ...(data.overrides ?? {}),
    ...(data.context && Object.keys(data.context).length > 0
      ? { _context: data.context }
      : {}),
  };

  // Create feedback record
  const feedback = await database.founderFeedback.create({
    data: {
      targetType: data.targetType,
      targetId: data.targetId,
      founderId: userId,
      rating: data.rating,
      overrides:
        Object.keys(mergedOverrides).length > 0
          ? (mergedOverrides as Prisma.InputJsonValue)
          : undefined,
      notes: data.notes ?? undefined,
      markedAsTemplate: data.markedAsTemplate ?? false,
    },
  });

  // Apply overrides to the target entity (excluding internal _context).
  if (data.overrides && Object.keys(data.overrides).length > 0) {
    const applyable = Object.fromEntries(
      Object.entries(data.overrides).filter(([k]) => !k.startsWith('_')),
    );
    if (Object.keys(applyable).length > 0) {
      await applyOverrides(data.targetType, data.targetId, applyable, userId);
    }
  }

  // Revalidate relevant pages
  revalidatePath('/actions');
  revalidatePath('/leads');
  revalidatePath('/');

  return { feedbackId: feedback.id };
}

async function applyOverrides(
  targetType: string,
  targetId: string,
  overrides: Record<string, unknown>,
  userId: string
) {
  switch (targetType) {
    case 'scout_lead': {
      const updateData: Record<string, unknown> = {};
      if ('leadScore' in overrides && typeof overrides.leadScore === 'number') {
        updateData.leadScore = overrides.leadScore;
      }
      if ('verdict' in overrides && typeof overrides.verdict === 'string') {
        updateData.verdict = overrides.verdict;
      }
      if ('status' in overrides && typeof overrides.status === 'string') {
        updateData.status = overrides.status;
      }
      if (Object.keys(updateData).length > 0) {
        await database.scoutLead.update({
          where: { id: targetId },
          data: updateData,
        });
      }
      break;
    }

    case 'avm_result': {
      const avm = await database.avmResult.findUnique({
        where: { id: targetId },
        select: { dealId: true },
      });

      // If there's a linked deal, update it with the overridden values
      if (avm?.dealId) {
        const dealUpdate: Record<string, unknown> = {};
        if ('estimatedMarketValuePence' in overrides && typeof overrides.estimatedMarketValuePence === 'number') {
          dealUpdate.estimatedMarketValuePence = overrides.estimatedMarketValuePence;
        }
        if ('ourOfferPence' in overrides && typeof overrides.ourOfferPence === 'number') {
          dealUpdate.ourOfferPence = overrides.ourOfferPence;
        }
        if ('verdict' in overrides && typeof overrides.verdict === 'string') {
          dealUpdate.verdict = overrides.verdict;
        }
        if ('marginPercent' in overrides && typeof overrides.marginPercent === 'number') {
          dealUpdate.marginPercent = overrides.marginPercent;
        }
        if (Object.keys(dealUpdate).length > 0) {
          await database.deal.update({
            where: { id: avm.dealId },
            data: dealUpdate,
          });
        }

        // Log activity
        await database.dealActivity.create({
          data: {
            dealId: avm.dealId,
            action: 'founder_override',
            detail: `Founder overrode AVM values: ${Object.entries(overrides).map(([k, v]) => `${k}=${v}`).join(', ')}`,
            userId,
          },
        });

        revalidatePath(`/deals/${avm.dealId}`);
      }
      break;
    }

    case 'deal': {
      const dealUpdate: Record<string, unknown> = {};
      if ('ourOfferPence' in overrides && typeof overrides.ourOfferPence === 'number') {
        dealUpdate.ourOfferPence = overrides.ourOfferPence;
      }
      if ('verdict' in overrides && typeof overrides.verdict === 'string') {
        dealUpdate.verdict = overrides.verdict;
      }
      if ('marginPercent' in overrides && typeof overrides.marginPercent === 'number') {
        dealUpdate.marginPercent = overrides.marginPercent;
      }
      if (Object.keys(dealUpdate).length > 0) {
        await database.deal.update({
          where: { id: targetId },
          data: dealUpdate,
        });
        await database.dealActivity.create({
          data: {
            dealId: targetId,
            action: 'founder_override',
            detail: `Founder overrode deal values: ${Object.entries(overrides).map(([k, v]) => `${k}=${v}`).join(', ')}`,
            userId,
          },
        });
        revalidatePath(`/deals/${targetId}`);
      }
      break;
    }
  }
}
