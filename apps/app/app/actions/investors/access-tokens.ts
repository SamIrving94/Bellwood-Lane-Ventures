'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 24 chars of url-safe base64 from random bytes (mirrors deal-updates tokens).
function generateToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Line 2 — mint a read-only magic link for an investor. The link shows the
 * public sourced-deal feed (numbers + location only). No account is created
 * for the investor; the token alone grants access and can be revoked.
 */
export async function mintInvestorToken(label: string, email?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  if (!label.trim()) throw new Error('Add a name for this link.');
  if (email && email.trim() && !EMAIL_RE.test(email.trim())) {
    throw new Error('That email looks wrong.');
  }

  const created = await database.investorAccessToken.create({
    data: {
      token: generateToken(),
      label: label.trim().slice(0, 200),
      email: email?.trim().toLowerCase() || null,
      createdBy: userId,
    },
    select: { id: true, token: true },
  });

  revalidatePath('/investors');
  return created;
}

export async function revokeInvestorToken(id: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  await database.investorAccessToken.update({
    where: { id },
    data: { revoked: true },
  });

  revalidatePath('/investors');
  return { ok: true };
}

export async function restoreInvestorToken(id: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  await database.investorAccessToken.update({
    where: { id },
    data: { revoked: false },
  });

  revalidatePath('/investors');
  return { ok: true };
}
