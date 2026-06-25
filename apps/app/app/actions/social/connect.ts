'use server';

import { getLinkingUrl } from '@/lib/social/ayrshare-accounts';
import { auth } from '@repo/auth/server';

/**
 * Start the social-account linking flow: returns the Ayrshare hosted URL the
 * founder is sent to in order to connect/manage his LinkedIn/Instagram/Facebook
 * accounts. Returns a reason when linking isn't configured so the UI can show
 * the right fallback.
 */
export async function startSocialLinking(): Promise<
  { ok: true; url: string } | { ok: false; reason: string }
> {
  const { userId } = await auth();
  if (!userId) return { ok: false, reason: 'unauthorized' };
  return getLinkingUrl();
}
