import 'server-only';

import { database } from '@repo/database';
import { log } from '@repo/observability/log';
import { keys } from '../keys';
import { decryptToken, encryptToken } from './crypto';

/**
 * The one Google connection for the platform: the Kept Workspace account,
 * connected once by a founder from Settings → Google.
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

export const getGoogleStatus = async (): Promise<GoogleStatus> => {
  const stored = await readConnection();
  return {
    configured: isGoogleConfigured(),
    connected: Boolean(stored) && !stored?.brokenAt,
    email: stored?.email ?? null,
    connectedAt: stored?.connectedAt ?? null,
    broken: Boolean(stored?.brokenAt),
  };
};

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
  cached = null;
};

/** Revoke at Google (best effort) and forget the token. */
export const disconnectGoogle = async (): Promise<void> => {
  const stored = await readConnection();
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
  await database.setting.deleteMany({ where: { key: CONNECTION_KEY } });
  cached = null;
};

let cached: { token: string; email: string; expiresAt: number } | null = null;

export type GoogleSession = { accessToken: string; email: string };

/**
 * A live access token for the Kept account, or null when Google is not
 * configured, not connected, or the connection has gone bad. Every feature
 * calls this first and skips on null: Google being absent must never break
 * the flow it is attached to.
 */
export const getGoogleSession = async (): Promise<GoogleSession | null> => {
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return { accessToken: cached.token, email: cached.email };
  }
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: secret } = env();
  if (!(clientId && secret)) {
    return null;
  }
  const stored = await readConnection();
  if (!stored || stored.brokenAt) {
    return null;
  }
  const refreshToken = decryptToken(stored.refreshTokenEnc, secret);
  if (!refreshToken) {
    await markBroken(stored, 'stored token could not be decrypted');
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
      await markBroken(stored, 'Google rejected the token (invalid_grant)');
    } else {
      log.warn('google: token refresh failed', {
        status: response.status,
        error: json.error ?? null,
      });
    }
    return null;
  }

  cached = {
    token: json.access_token,
    email: stored.email,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return { accessToken: cached.token, email: cached.email };
};

const markBroken = async (
  stored: StoredConnection,
  reason: string
): Promise<void> => {
  log.error('google: connection broken, reconnect needed', { reason });
  await database.setting
    .update({
      where: { key: CONNECTION_KEY },
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
