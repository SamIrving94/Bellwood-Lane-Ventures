import 'server-only';

import { database } from '@repo/database';
import { log } from '@repo/observability/log';
import { keys } from '../keys';
import { decryptToken, encryptToken } from './crypto';

/**
 * The Google connection for the platform: the main Kept Workspace account,
 * connected once by a founder from Settings → Google. Drafts, Calendar,
 * Drive, labels and the morning brief all use it.
 *
 * Other Kept mailboxes (a colleague's, a shared hello@) can be added beside
 * it, for one job only: the deal email log reads them too. They have their
 * own narrower sign-in (`MAILBOX_SCOPES`) and are never used for anything
 * else. Each is stored under its own key, `google:mailbox:<address>`.
 *
 * It lives in the generic `Setting` table (key/value JSON) rather than a
 * model of its own, so shipping this needs no schema change and nothing
 * can break before `prisma db push` is run.
 */
const CONNECTION_KEY = 'google:connection';

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  // Read, label and draft mail. Needed to label inbound mail by deal.
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar.events',
  // Only files this app creates. It cannot see the rest of the Drive.
  'https://www.googleapis.com/auth/drive.file',
];

/**
 * An extra mailbox only needs to read mail and add the `Kept/Logged` label.
 * No Calendar, no Drive.
 */
export const MAILBOX_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.modify',
];

const MAILBOX_PREFIX = 'google:mailbox:';
const mailboxKey = (email: string) => `${MAILBOX_PREFIX}${email.toLowerCase()}`;

type StoredConnection = {
  email: string;
  refreshTokenEnc: string;
  connectedAt: string;
  connectedBy: string;
  /** Set when Google rejects the token (revoked, password change). */
  brokenAt?: string;
};

export type GoogleStatus = {
  /** OAuth client id + secret are present in env. */
  configured: boolean;
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
  /** Connected once, but Google now refuses the token: reconnect needed. */
  broken: boolean;
  /**
   * Every mailbox the email log reads right now: the main account first,
   * then any extra Kept mailbox that is still working.
   */
  mailboxes: string[];
};

export type MailboxStatus = {
  email: string;
  connectedAt: string;
  /** Google refuses its token now: remove it and add it again. */
  broken: boolean;
};

const env = () => keys();

export const isGoogleConfigured = (): boolean =>
  Boolean(env().GOOGLE_CLIENT_ID && env().GOOGLE_CLIENT_SECRET);

const readConnection = async (): Promise<StoredConnection | null> => {
  const row = await database.setting.findUnique({
    where: { key: CONNECTION_KEY },
  });
  return (row?.value as StoredConnection | undefined) ?? null;
};

const readMailboxes = async (): Promise<
  { key: string; stored: StoredConnection }[]
> => {
  const rows = await database.setting.findMany({
    where: { key: { startsWith: MAILBOX_PREFIX } },
    orderBy: { key: 'asc' },
  });
  return rows
    .map((r) => ({ key: r.key, stored: r.value as StoredConnection }))
    .filter((r) => typeof r.stored?.email === 'string');
};

export const getGoogleStatus = async (): Promise<GoogleStatus> => {
  const [stored, extras] = await Promise.all([
    readConnection(),
    readMailboxes(),
  ]);
  const connected = Boolean(stored) && !stored?.brokenAt;
  return {
    configured: isGoogleConfigured(),
    connected,
    email: stored?.email ?? null,
    connectedAt: stored?.connectedAt ?? null,
    broken: Boolean(stored?.brokenAt),
    mailboxes: [
      ...(connected && stored ? [stored.email] : []),
      ...extras.filter((m) => !m.stored.brokenAt).map((m) => m.stored.email),
    ],
  };
};

/** The extra mailboxes, for Settings → Google. Never returns a token. */
export const listExtraMailboxes = async (): Promise<MailboxStatus[]> =>
  (await readMailboxes()).map(({ stored }) => ({
    email: stored.email,
    connectedAt: stored.connectedAt,
    broken: Boolean(stored.brokenAt),
  }));

export const saveGoogleConnection = async (input: {
  email: string;
  refreshToken: string;
  userId: string;
}): Promise<void> => {
  const secret = env().GOOGLE_CLIENT_SECRET;
  if (!secret) {
    throw new Error('Google is not configured');
  }
  const value: StoredConnection = {
    email: input.email,
    refreshTokenEnc: encryptToken(input.refreshToken, secret),
    connectedAt: new Date().toISOString(),
    connectedBy: input.userId,
  };
  await database.setting.upsert({
    where: { key: CONNECTION_KEY },
    create: { key: CONNECTION_KEY, value, updatedBy: input.userId },
    update: { value, updatedBy: input.userId },
  });
  cache.delete(CONNECTION_KEY);
};

/**
 * Add (or reconnect) an extra Kept mailbox for the email log. The caller
 * has already checked it is on the main account's domain
 * (`mailboxRefusal`).
 */
export const saveExtraMailbox = async (input: {
  email: string;
  refreshToken: string;
  userId: string;
}): Promise<void> => {
  const secret = env().GOOGLE_CLIENT_SECRET;
  if (!secret) {
    throw new Error('Google is not configured');
  }
  const key = mailboxKey(input.email);
  const value: StoredConnection = {
    email: input.email.toLowerCase(),
    refreshTokenEnc: encryptToken(input.refreshToken, secret),
    connectedAt: new Date().toISOString(),
    connectedBy: input.userId,
  };
  await database.setting.upsert({
    where: { key },
    create: { key, value, updatedBy: input.userId },
    update: { value, updatedBy: input.userId },
  });
  cache.delete(key);
};

const revoke = async (stored: StoredConnection | null): Promise<void> => {
  const secret = env().GOOGLE_CLIENT_SECRET;
  const token =
    stored && secret ? decryptToken(stored.refreshTokenEnc, secret) : null;
  if (token) {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    }).catch(() => {
      // Forgetting the token locally is what matters; revoke is a courtesy.
    });
  }
};

/**
 * Stop reading an extra mailbox: revoke at Google (best effort) and forget
 * the token. Emails already stored from it stay in the log.
 */
export const removeExtraMailbox = async (email: string): Promise<void> => {
  const key = mailboxKey(email);
  const row = await database.setting.findUnique({ where: { key } });
  await revoke((row?.value as StoredConnection | undefined) ?? null);
  await database.setting.deleteMany({ where: { key } });
  cache.delete(key);
};

/** Revoke at Google (best effort) and forget the token. */
export const disconnectGoogle = async (): Promise<void> => {
  await revoke(await readConnection());
  await database.setting.deleteMany({ where: { key: CONNECTION_KEY } });
  cache.delete(CONNECTION_KEY);
};

/** Live access tokens, by Setting key. */
const cache = new Map<
  string,
  { token: string; email: string; expiresAt: number }
>();

export type GoogleSession = { accessToken: string; email: string };

/**
 * A live access token for the Kept account, or null when Google is not
 * configured, not connected, or the connection has gone bad. Every feature
 * calls this first and skips on null: Google being absent must never break
 * the flow it is attached to.
 */
export const getGoogleSession = async (): Promise<GoogleSession | null> =>
  sessionFor(CONNECTION_KEY, readConnection);

/**
 * Sessions for every mailbox the email log reads: the main account first,
 * then each extra Kept mailbox. One that is broken, or whose token cannot
 * be refreshed right now, is left out; the rest still work.
 */
export const getMailboxSessions = async (): Promise<GoogleSession[]> => {
  const main = await getGoogleSession();
  const extras = await readMailboxes();
  const sessions = await Promise.all(
    extras.map(({ key, stored }) => sessionFor(key, async () => stored))
  );
  // An account that is both the main one and an extra (the main account
  // was later switched to it) is read once.
  const seen = new Set<string>();
  return [main, ...sessions].filter((s): s is GoogleSession => {
    if (!s || seen.has(s.email.toLowerCase())) {
      return false;
    }
    seen.add(s.email.toLowerCase());
    return true;
  });
};

const sessionFor = async (
  key: string,
  read: () => Promise<StoredConnection | null>
): Promise<GoogleSession | null> => {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now() + 60_000) {
    return { accessToken: hit.token, email: hit.email };
  }
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: secret } = env();
  if (!(clientId && secret)) {
    return null;
  }
  const stored = await read();
  if (!stored || stored.brokenAt) {
    return null;
  }
  const refreshToken = decryptToken(stored.refreshTokenEnc, secret);
  if (!refreshToken) {
    await markBroken(key, stored, 'stored token could not be decrypted');
    return null;
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: secret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const json = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!(response.ok && json.access_token)) {
    // invalid_grant = revoked or expired for good. Anything else (5xx,
    // network) may pass, so only invalid_grant marks the connection broken.
    if (json.error === 'invalid_grant') {
      await markBroken(
        key,
        stored,
        'Google rejected the token (invalid_grant)'
      );
    } else {
      log.warn('google: token refresh failed', {
        status: response.status,
        error: json.error ?? null,
      });
    }
    return null;
  }

  const fresh = {
    token: json.access_token,
    email: stored.email,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  cache.set(key, fresh);
  return { accessToken: fresh.token, email: fresh.email };
};

const markBroken = async (
  key: string,
  stored: StoredConnection,
  reason: string
): Promise<void> => {
  log.error('google: connection broken, reconnect needed', {
    reason,
    mailbox: key === CONNECTION_KEY ? 'main' : 'extra',
  });
  await database.setting
    .update({
      where: { key },
      data: { value: { ...stored, brokenAt: new Date().toISOString() } },
    })
    .catch(() => {
      // Nothing more to do: the next call will fail the same way and retry.
    });
};

// ── Links: which Google object belongs to which deal / viewing ──────────
// Stored beside the connection for the same no-schema-change reason.

export const getLink = async <T>(key: string): Promise<T | null> => {
  const row = await database.setting.findUnique({
    where: { key: `google:${key}` },
  });
  return (row?.value as T | undefined) ?? null;
};

export const setLink = async (key: string, value: object): Promise<void> => {
  await database.setting.upsert({
    where: { key: `google:${key}` },
    create: { key: `google:${key}`, value },
    update: { value },
  });
};

export const deleteLink = async (key: string): Promise<void> => {
  await database.setting.deleteMany({ where: { key: `google:${key}` } });
};
