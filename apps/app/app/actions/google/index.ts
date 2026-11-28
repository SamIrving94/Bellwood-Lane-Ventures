'use server';

import { requireFounder } from '@repo/auth/server';
import { database } from '@repo/database';
import {
  disconnectGoogle,
  draftInGmail,
  ensureDealFolder,
  refreshPartnerSheet,
  removeExtraMailbox,
} from '@repo/google';
import { revalidatePath } from 'next/cache';

export async function disconnectGoogleAccount() {
  await requireFounder();
  await disconnectGoogle();
  revalidatePath('/settings/google');
}

/**
 * Stop the email log reading one extra Kept mailbox. Emails already stored
 * from it stay where they are.
 */
export async function removeGoogleMailbox(formData: FormData) {
  await requireFounder();
  const email = String(formData.get('email') ?? '');
  if (email) {
    await removeExtraMailbox(email);
  }
  revalidatePath('/settings/google');
  revalidatePath('/deals/email-log');
}

// Server-action errors reach the browser with their message stripped in
// production, so expected failures are returned, not thrown.
type Failed = { ok: false; error: string };
const NOT_CONNECTED: Failed = {
  ok: false,
  error: 'Google is not connected. Connect it in Settings → Google.',
};
const failed = (err: unknown): Failed => ({
  ok: false,
  error: `Google did not accept that: ${err instanceof Error ? err.message : String(err)}`,
});

/**
 * Put a held vendor email into the Kept Gmail Drafts instead of sending it
 * through Resend. Nothing is sent here: the founder finishes it in Gmail,
 * so it goes from their own address and replies come back to their inbox.
 *
 * The hold moves to `drafted` (out of the review queue). The recipient row
 * is deliberately NOT marked sent, because it has not been.
 */
export async function draftHoldInGmail(
  holdId: string,
  editedBody?: string
): Promise<Failed | { ok: true; mailbox: string }> {
  const { userId } = await requireFounder();

  const hold = await database.outreachHold.findUnique({
    where: { id: holdId },
  });
  if (!hold) {
    return { ok: false, error: 'Email not found.' };
  }
  if (hold.status !== 'held') {
    return { ok: false, error: 'This email has already been reviewed.' };
  }
  if (!hold.recipientEmail) {
    return { ok: false, error: 'This email has no recipient address.' };
  }

  let result: Awaited<ReturnType<typeof draftInGmail>>;
  try {
    result = await draftInGmail({
      to: hold.recipientEmail,
      subject: hold.renderedSubject,
      text: editedBody ?? hold.renderedBody,
    });
  } catch (err) {
    return failed(err);
  }
  if (result.skipped) {
    return NOT_CONNECTED;
  }

  await database.outreachHold.update({
    where: { id: holdId },
    data: {
      status: 'drafted',
      reviewedBy: userId,
      reviewedAt: new Date(),
      editedBody: editedBody ?? undefined,
    },
  });
  await database.agentEvent.create({
    data: {
      agent: 'marketer',
      eventType: 'outreach_hold_drafted',
      summary: 'Vendor email placed in Gmail Drafts after founder review',
      count: 1,
      payload: { holdId, draftId: result.draftId, reviewedBy: userId },
    },
  });

  revalidatePath('/outreach/holds');
  revalidatePath('/actions');
  return { ok: true, mailbox: result.mailbox };
}

export async function createDealDriveFolder(
  dealId: string
): Promise<Failed | { ok: true; url: string }> {
  await requireFounder();
  try {
    const result = await ensureDealFolder(dealId);
    if (result.skipped) {
      return NOT_CONNECTED;
    }
    revalidatePath(`/deals/${dealId}`);
    return { ok: true, url: result.url };
  } catch (err) {
    return failed(err);
  }
}

export async function refreshPartnerSheetNow(): Promise<
  Failed | { ok: true; url: string }
> {
  await requireFounder();
  try {
    const result = await refreshPartnerSheet();
    if (result.skipped) {
      return NOT_CONNECTED;
    }
    revalidatePath('/settings/google');
    return { ok: true, url: result.url };
  } catch (err) {
    return failed(err);
  }
}
