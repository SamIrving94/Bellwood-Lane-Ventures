'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';

/**
 * For review_leads actions, check if any FounderFeedback has been submitted
 * for leads associated with this action. Returns true if at least one lead
 * has been rated, false if none have been rated.
 *
 * Used to surface a warning before marking an action as Done without rating.
 */
export async function checkFeedbackCompletion(actionId: string): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  // The action was likely created around a batch of new leads — check if any
  // scout_lead feedback exists created after this action was created
  const action = await database.founderAction.findUnique({
    where: { id: actionId },
    select: { createdAt: true },
  });

  if (!action) return false;

  const feedbackCount = await database.founderFeedback.count({
    where: {
      targetType: 'scout_lead',
      createdAt: { gte: action.createdAt },
    },
  });

  return feedbackCount > 0;
}
