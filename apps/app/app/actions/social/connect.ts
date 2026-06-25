'use server';

import { getLinkingUrl } from '@/lib/social/ayrshare-accounts';
import { getSocialProvider } from '@/lib/social/providers';
import { auth } from '@repo/auth/server';

/**
 * Start the social-account connect flow. Returns where the founder should go to
 * connect/manage accounts for the active provider:
 *   - Ayrshare: a generated hosted linking URL (JWT/SSO).
 *   - Postiz / LinkedIn: the provider's manage URL (Postiz dashboard / LinkedIn).
 * Returns a reason when nothing can be opened so the UI shows the setup note.
 */
export async function startSocialLinking(): Promise<
  { ok: true; url: string } | { ok: false; reason: string }
> {
  const { userId } = await auth();
  if (!userId) return { ok: false, reason: 'unauthorized' };

  const provider = getSocialProvider();

  // Ayrshare can mint a dynamic hosted linking URL; try that first.
  if (provider.id === 'ayrshare') {
    const linking = await getLinkingUrl();
    if (linking.ok) return linking;
  }

  const status = await provider.getStatus();
  if (status.manageUrl) return { ok: true, url: status.manageUrl };
  return { ok: false, reason: 'no_connect_url' };
}
