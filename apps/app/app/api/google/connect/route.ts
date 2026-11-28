import { randomBytes } from 'node:crypto';
import { getFounderSession } from '@repo/auth/server';
import { buildGoogleAuthUrl } from '@repo/google';
import { NextResponse } from 'next/server';

const STATE_COOKIE = 'kept_google_oauth_state';

// Starts the "Connect Google" flow. Founder-only: whoever completes this
// decides which mailbox the platform drafts into.
//
// `?mailbox=1` starts "Add a mailbox" instead: another Kept account, read by
// the email log only. The purpose rides in the state value, so the callback
// knows which it is and nobody can switch it on the way back.
export const GET = async (request: Request) => {
  const session = await getFounderSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const purpose =
    requestUrl.searchParams.get('mailbox') === '1' ? 'mailbox' : 'main';
  const state = `${purpose}.${randomBytes(24).toString('base64url')}`;
  const url = buildGoogleAuthUrl({ appUrl: origin, state, purpose });
  if (!url) {
    return NextResponse.redirect(
      `${origin}/settings/google?error=not_configured`
    );
  }
  const response = NextResponse.redirect(url);
  // The state value ties the callback to this browser, so a link crafted by
  // someone else cannot attach THEIR Google account to our platform.
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: origin.startsWith('https://'),
    sameSite: 'lax',
    maxAge: 600,
    path: '/api/google',
  });
  return response;
};
