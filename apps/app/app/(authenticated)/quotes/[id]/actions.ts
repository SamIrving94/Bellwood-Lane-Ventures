'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { sendSignedOffer } from '@repo/quote-ops';
import { revalidatePath } from 'next/cache';

/**
 * Approve & Send — final step of the 4-hour SLA flow.
 *
 *   1. Read the FounderAction to pull the `signedOfferUrl` the cron stashed
 *      in metadata.
 *   2. Dispatch the email via `@repo/quote-ops/sendSignedOffer`.
 *   3. Revalidate `/quotes/[id]` and `/actions` so the founder sees the
 *      timeline + the cleared action without a hard reload.
 */
export async function approveAndSendOffer(
  quoteId: string,
  founderActionId: string,
): Promise<{ sent: boolean; emailSkipped: boolean; reason?: string }> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const action = await database.founderAction.findUnique({
    where: { id: founderActionId },
    select: { metadata: true, status: true },
  });
  if (!action) throw new Error('Founder action not found');

  const meta = (action.metadata ?? {}) as Record<string, unknown>;
  const signedOfferUrl =
    typeof meta.signedOfferUrl === 'string'
      ? (meta.signedOfferUrl as string)
      : null;
  if (!signedOfferUrl) {
    throw new Error('No signedOfferUrl in action metadata — re-run the cron');
  }

  const result = await sendSignedOffer({
    quoteId,
    signedOfferUrl,
    founderActionId,
  });

  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath('/actions');

  return {
    sent: result.sent,
    emailSkipped: result.emailSkipped,
    reason: result.reason,
  };
}
