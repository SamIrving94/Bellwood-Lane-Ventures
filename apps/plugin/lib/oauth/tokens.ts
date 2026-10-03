/**
 * Signed, stateless tokens for the Pro plugin's OAuth 2.1 server.
 *
 * Format: base64url(JSON payload) "." base64url(HMAC-SHA256). The HMAC
 * covers a purpose string as well as the payload, so a token minted for one
 * job (a client registration, a sign-in code, an access token) can never be
 * replayed as another. Single-use and attempt limits live in ./consume.ts.
 *
 * Secret: PLUGIN_AUTH_SECRET, at least 32 characters, set on the plugin's
 * Vercel project only. Rotating it signs every user out.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type TokenPurpose =
  | 'client' // DCR client_id
  | 'authreq' // validated /authorize request, carried through the form
  | 'otp' // pending sign-in, carries a hash of the emailed code
  | 'code' // authorization code
  | 'access'
  | 'refresh';

export interface TokenClaims {
  /** Purpose, mirrored in the payload for debugging; the HMAC is what binds it. */
  pur: TokenPurpose;
  /** Unique id, for single-use and attempt counting. */
  jti: string;
  iat: number;
  exp: number;
  [key: string]: unknown;
}

const MIN_SECRET_LENGTH = 32;

function secret(): string {
  const s = process.env.PLUGIN_AUTH_SECRET?.replace(/^﻿/, '').trim();
  if (!s || s.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `PLUGIN_AUTH_SECRET must be set (at least ${MIN_SECRET_LENGTH} characters)`
    );
  }
  return s;
}

function b64url(value: Buffer | string): string {
  return (
    typeof value === 'string' ? Buffer.from(value, 'utf8') : value
  ).toString('base64url');
}

function mac(purpose: TokenPurpose, body: string): Buffer {
  return createHmac('sha256', secret()).update(`${purpose}.${body}`).digest();
}

export function newId(bytes = 16): string {
  return randomBytes(bytes).toString('base64url');
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function signToken(
  purpose: TokenPurpose,
  data: Record<string, unknown>,
  ttlSeconds: number
): string {
  const iat = nowSeconds();
  const claims: TokenClaims = {
    ...data,
    pur: purpose,
    jti: typeof data.jti === 'string' ? data.jti : newId(),
    iat,
    exp: iat + ttlSeconds,
  };
  const body = b64url(JSON.stringify(claims));
  return `${body}.${b64url(mac(purpose, body))}`;
}

/** The claims every token carries, whatever else it holds. */
export interface BaseClaims {
  pur: TokenPurpose;
  jti: string;
  iat: number;
  exp: number;
}

/** Returns the claims, or null for a bad signature, wrong purpose or expiry. */
export function verifyToken<T extends BaseClaims = TokenClaims>(
  purpose: TokenPurpose,
  token: string | null | undefined
): T | null {
  if (!token || typeof token !== 'string' || token.length > 8192) {
    return null;
  }
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts as [string, string];
  let given: Buffer;
  try {
    given = Buffer.from(sig, 'base64url');
  } catch {
    return null;
  }
  const expected = mac(purpose, body);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }
  let claims: T;
  try {
    claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
  if (claims.pur !== purpose) return null;
  if (typeof claims.exp !== 'number' || claims.exp < nowSeconds()) return null;
  return claims;
}

/** SHA-256 keyed hash, for storing an emailed code inside a token. */
export function keyedHash(value: string): string {
  return createHmac('sha256', secret())
    .update(`hash.${value}`)
    .digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
