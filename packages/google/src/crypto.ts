import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

/**
 * The Google refresh token is a long-lived key to the Kept mailbox, calendar
 * and Drive. It is stored in the database, so it is encrypted at rest
 * (AES-256-GCM) with a key derived from GOOGLE_CLIENT_SECRET, which lives
 * only in Vercel env. A database leak alone therefore does not open the
 * mailbox. Rotating the client secret invalidates the stored token, which
 * is the right behaviour: the founder reconnects.
 */
const deriveKey = (secret: string): Buffer =>
  createHash('sha256').update(`kept-google-token:${secret}`).digest();

export const encryptToken = (plain: string, secret: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv, cipher.getAuthTag(), body]
    .map((part) =>
      typeof part === 'string' ? part : part.toString('base64url')
    )
    .join('.');
};

/** Returns null (never throws) when the value was tampered with or the secret changed. */
export const decryptToken = (stored: string, secret: string): string | null => {
  const [version, iv, tag, body] = stored.split('.');
  if (version !== 'v1' || !iv || !tag || !body) {
    return null;
  }
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      deriveKey(secret),
      Buffer.from(iv, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(body, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
};
