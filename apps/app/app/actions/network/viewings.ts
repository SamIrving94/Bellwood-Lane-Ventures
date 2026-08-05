'use server';

import { randomBytes } from 'node:crypto';
import { requireFounder } from '@repo/auth/server';
import { database } from '@repo/database';
import { sendEmail } from '@repo/email';
import { revalidatePath } from 'next/cache';

const webUrl = () => process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3001';

/**
 * Assign a viewing to a field partner. Creates the magic-link report form and
 * emails it to the partner (graceful skip when Resend isn't configured — the
 * link is always shown on the deal page so it can be WhatsApped instead).
 */
export async function assignViewing(
  dealId: string,
  input: {
    partnerId: string | null;
    scheduledAt: string | null; // ISO from the form, or null = partner arranges
    accessNotes: string | null;
  }
) {
  const { userId } = await requireFounder();

  const deal = await database.deal.findUnique({
    where: { id: dealId },
    select: { id: true, address: true, postcode: true },
  });
  if (!deal) throw new Error('Deal not found');

  const token = randomBytes(18).toString('base64url');

  const viewing = await database.viewing.create({
    data: {
      dealId,
      partnerId: input.partnerId,
      token,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      accessNotes: input.accessNotes?.trim() || null,
      status: input.scheduledAt ? 'scheduled' : 'requested',
    },
    include: { partner: { select: { name: true, email: true } } },
  });

  await database.dealActivity.create({
    data: {
      dealId,
      action: 'viewing_assigned',
      detail: viewing.partner
        ? `Viewing assigned to ${viewing.partner.name}`
        : 'Viewing link created (no partner yet)',
      userId,
    },
  });

  const link = `${webUrl()}/viewing/${token}`;

  if (viewing.partner?.email) {
    // Partner-facing, not vendor-facing — safe to send directly.
    await sendEmail({
      to: viewing.partner.email,
      subject: `Viewing request: ${deal.address}, ${deal.postcode}`,
      text: [
        `Hi ${viewing.partner.name.split(' ')[0]},`,
        '',
        `Can you view ${deal.address}, ${deal.postcode} for us?`,
        viewing.scheduledAt
          ? `Proposed time: ${viewing.scheduledAt.toLocaleString('en-GB')}`
          : 'Timing: please arrange directly — details below.',
        input.accessNotes ? `Access: ${input.accessNotes}` : null,
        '',
        'Fill in the report on your phone while you walk the property:',
        link,
        '',
        'Thanks — Kept',
      ]
        .filter((l) => l !== null)
        .join('\n'),
    }).catch(() => {
      // Email is best-effort; the link on the deal page is the fallback.
    });
  }

  revalidatePath(`/deals/${dealId}`);
  return { viewingId: viewing.id, link };
}

export async function cancelViewing(viewingId: string) {
  const { userId } = await requireFounder();

  const viewing = await database.viewing.update({
    where: { id: viewingId },
    data: { status: 'cancelled' },
    select: { dealId: true },
  });

  await database.dealActivity.create({
    data: { dealId: viewing.dealId, action: 'viewing_cancelled', userId },
  });

  revalidatePath(`/deals/${viewing.dealId}`);
}

/**
 * Founder has read the report and acted on it (confirmed or adjusted the
 * offer). Closes the loop: marks the viewing reviewed and completes the
 * matching Action Centre card.
 */
export async function markViewingReviewed(viewingId: string) {
  const { userId } = await requireFounder();

  const viewing = await database.viewing.update({
    where: { id: viewingId },
    data: { status: 'reviewed', reviewedBy: userId, reviewedAt: new Date() },
    select: { dealId: true },
  });

  await database.founderAction.updateMany({
    where: { dedupKey: `viewing:${viewingId}:submitted`, status: 'pending' },
    data: { status: 'completed', resolvedBy: userId, resolvedAt: new Date() },
  });

  revalidatePath(`/deals/${viewing.dealId}`);
  revalidatePath('/');
}
