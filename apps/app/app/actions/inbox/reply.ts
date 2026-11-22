'use server';

import { requireFounder } from '@repo/auth/server';
import { database } from '@repo/database';
import { sendEmail } from '@repo/email';
import { bareAddress, replySubject } from '@repo/email/addresses';
import { revalidatePath } from 'next/cache';

export type ReplyResult = { ok: true } | { ok: false; error: string };

/**
 * A founder replies from /inbox. Written and sent by a person, so the
 * "vendor emails are never auto-sent" rail holds: nothing here drafts or
 * dispatches on its own.
 *
 * Threading: In-Reply-To / References point at the latest inbound message,
 * so the reply lands inside the seller's existing conversation in their
 * mail client instead of starting a new one.
 */
export async function sendInboxReply(
  address: string,
  body: string
): Promise<ReplyResult> {
  const { userId } = await requireFounder();

  const to = bareAddress(address);
  if (!to) {
    return { ok: false, error: 'That is not an email address.' };
  }

  const text = body.trim();
  if (!text) {
    return { ok: false, error: 'Write a reply first.' };
  }

  const [latest, inbound] = await Promise.all([
    database.emailMessage.findFirst({
      where: { counterparty: to },
      orderBy: { createdAt: 'desc' },
      select: { subject: true },
    }),
    database.emailMessage.findMany({
      where: {
        counterparty: to,
        direction: 'inbound',
        messageId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { messageId: true },
    }),
  ]);
  if (!latest) {
    return { ok: false, error: 'No conversation with this address yet.' };
  }

  const ids = inbound
    .map((m) => m.messageId)
    .filter((id): id is string => Boolean(id));
  const headers =
    ids.length > 0
      ? {
          'In-Reply-To': ids[0],
          // Oldest first, as mail clients expect.
          References: [...ids].reverse().join(' '),
        }
      : undefined;

  try {
    const result = await sendEmail({
      to,
      subject: replySubject(latest.subject),
      text,
      headers,
      sentBy: userId,
    });
    if (result.skipped) {
      return { ok: false, error: `Not sent: ${result.reason}.` };
    }
  } catch (err) {
    return {
      ok: false,
      error: `Not sent: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  revalidatePath('/inbox');
  revalidatePath(`/inbox/${encodeURIComponent(to)}`);
  return { ok: true };
}
