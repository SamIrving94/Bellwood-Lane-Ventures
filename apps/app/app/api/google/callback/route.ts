import { getFounderSession } from '@repo/auth/server';
import {
  exchangeGoogleCode,
  isPersonalGoogleAccount,
  saveGoogleConnection,
} from '@repo/google';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const STATE_COOKIE = 'kept_google_oauth_state';

// Google sends the founder back here after they approve access.
export const GET = async (request: Request) => {
  const url = new URL(request.url);
  const back = (query: string) => {
    const response = NextResponse.redirect(
      `${url.origin}/settings/google?${query}`
    );
    response.cookies.delete({ name: STATE_COOKIE, path: '/api/google' });
    return response;
  };

  const session = await getFounderSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const expected = (await cookies()).get(STATE_COOKIE)?.value;
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  if (!(expected && state && state === expected)) {
    return back('error=state');
  }
  if (!code) {
    // The founder pressed Cancel on Google's screen.
    return back('error=cancelled');
  }

  const result = await exchangeGoogleCode({ code, appUrl: url.origin });
  if (!result.ok) {
    return back(`error=${result.reason}`);
  }
  // The connection is for the Kept Workspace account. A personal Gmail
  // here would put vendor drafts and deal folders in a private account.
  if (isPersonalGoogleAccount(result.email)) {
    return back('error=personal_account');
  }

  await saveGoogleConnection({
    email: result.email,
    refreshToken: result.refreshToken,
    userId: session.userId,
  });
  return back('connected=1');
};
