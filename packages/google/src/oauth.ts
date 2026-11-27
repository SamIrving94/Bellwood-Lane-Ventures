import { keys } from '../keys';
import { GOOGLE_SCOPES, MAILBOX_SCOPES } from './connection';

export const googleRedirectUri = (appUrl: string): string =>
  `${appUrl.replace(/\/+$/, '')}/api/google/callback`;

/**
 * `main`: the Kept account behind drafts, Calendar, Drive and the rest.
 * `mailbox`: another Kept mailbox, read by the email log and nothing else.
 */
export type GoogleConnectPurpose = 'main' | 'mailbox';

export const buildGoogleAuthUrl = (input: {
  appUrl: string;
  state: string;
  purpose?: GoogleConnectPurpose;
}): string | null => {
  const clientId = keys().GOOGLE_CLIENT_ID;
  if (!clientId) {
    return null;
  }
  const mailbox = input.purpose === 'mailbox';
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(input.appUrl),
    response_type: 'code',
    scope: (mailbox ? MAILBOX_SCOPES : GOOGLE_SCOPES).join(' '),
    // offline + consent: Google only returns a refresh token when both are
    // set, and without one the connection would die after an hour. Adding
    // a mailbox also asks Google to show the account chooser: the founder
    // is usually signed in as the main account, and wants a different one.
    access_type: 'offline',
    prompt: mailbox ? 'select_account consent' : 'consent',
    state: input.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
};

// Free consumer mailboxes. The connection is for the Kept Workspace
// account; connecting a personal one by mistake would put vendor drafts
// and deal folders in a private account.
const PERSONAL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

export const isPersonalGoogleAccount = (email: string): boolean =>
  PERSONAL_DOMAINS.has(email.toLowerCase().split('@')[1] ?? '');

export type ExchangeResult =
  | { ok: true; email: string; refreshToken: string }
  | {
      ok: false;
      reason:
        | 'not_configured'
        | 'exchange_failed'
        | 'no_refresh_token'
        | 'no_email';
    };

/** Swap the one-time code from the callback for a refresh token. */
export const exchangeGoogleCode = async (input: {
  code: string;
  appUrl: string;
}): Promise<ExchangeResult> => {
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: secret } = keys();
  if (!(clientId && secret)) {
    return { ok: false, reason: 'not_configured' };
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: input.code,
      client_id: clientId,
      client_secret: secret,
      redirect_uri: googleRedirectUri(input.appUrl),
      grant_type: 'authorization_code',
    }),
  });
  if (!response.ok) {
    return { ok: false, reason: 'exchange_failed' };
  }
  const json = (await response.json()) as {
    refresh_token?: string;
    id_token?: string;
  };
  if (!json.refresh_token) {
    return { ok: false, reason: 'no_refresh_token' };
  }
  // The id_token came straight from Google over TLS in this same response,
  // so its payload is read without a signature check.
  const payload = json.id_token?.split('.')[1];
  let email: string | undefined;
  try {
    email = payload
      ? (
          JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
            email?: string;
          }
        ).email
      : undefined;
  } catch {
    email = undefined;
  }
  if (!email) {
    return { ok: false, reason: 'no_email' };
  }
  return { ok: true, email, refreshToken: json.refresh_token };
};
