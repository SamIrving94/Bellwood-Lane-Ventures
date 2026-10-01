/**
 * The Pro plugin's OAuth 2.1 authorization-code flow with PKCE (S256 only).
 *
 *   ChatGPT → GET /oauth/authorize            validate client + redirect + PKCE
 *   user    → POST email                       6-digit code emailed (if registered)
 *   user    → POST code                        → 302 redirect_uri?code&state&iss
 *   ChatGPT → POST /oauth/token                code + verifier → access + refresh
 *
 * Why an emailed code, not a magic link: people open email on their phone
 * while ChatGPT is on their laptop. A code typed into the same browser keeps
 * the redirect in the session that started it.
 *
 * Why no enumeration: the email step always says "if that email is
 * registered, we've sent a code". An unknown email gets a pending token that
 * can never succeed.
 */

import { createHash, randomInt } from 'node:crypto';
import { brand } from '@repo/brand';
import { sendEmail } from '@repo/email';
import { type OAuthClient, resolveClient } from './clients';
import {
  OTP_MAX_ATTEMPTS,
  SCOPES,
  type Scope,
  TTL,
  issuer,
  resourceUrl,
} from './config';
import { attemptWithin, consumeOnce } from './consume';
import { findIdentity, normaliseEmail } from './identity';
import { keyedHash, newId, safeEqual, signToken, verifyToken } from './tokens';

export interface AuthRequest {
  client_id: string;
  client_name: string;
  redirect_uri: string;
  code_challenge: string;
  state: string | null;
  scope: Scope[];
  resource: string;
}

type AuthRequestClaims = AuthRequest & {
  pur: 'authreq';
  jti: string;
  iat: number;
  exp: number;
};

type OtpClaims = AuthRequest & {
  pur: 'otp';
  jti: string;
  iat: number;
  exp: number;
  email: string;
  granted: Scope[];
  otpHash: string;
};

type CodeClaims = Omit<AuthRequest, 'client_name' | 'scope'> & {
  pur: 'code';
  jti: string;
  iat: number;
  exp: number;
  email: string;
  scope: Scope[];
};

export type AccessClaims = {
  pur: 'access';
  jti: string;
  iat: number;
  exp: number;
  sub: string;
  scope: Scope[];
  aud: string;
  client_id: string;
};

type RefreshClaims = Omit<AccessClaims, 'pur'> & { pur: 'refresh' };

const CODE_CHALLENGE = /^[A-Za-z0-9_-]{43,128}$/;
const CODE_VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;

function parseScope(raw: string | null): Scope[] {
  if (!raw) return [...SCOPES];
  const asked = raw.split(/\s+/).filter(Boolean);
  return SCOPES.filter((s) => asked.includes(s));
}

export function redirectWithError(
  redirectUri: string,
  error: string,
  state: string | null,
  iss: string
): string {
  const u = new URL(redirectUri);
  u.searchParams.set('error', error);
  if (state) u.searchParams.set('state', state);
  u.searchParams.set('iss', iss);
  return u.toString();
}

/**
 * Validate an /authorize request. A bad client or redirect URI is shown to
 * the user (never redirected, per OAuth); anything else is redirected back
 * to the client as an error.
 */
export async function validateAuthorizeRequest(
  req: Request,
  params: URLSearchParams
): Promise<
  | { kind: 'ok'; authReq: AuthRequest; client: OAuthClient; token: string }
  | { kind: 'show_error'; message: string }
  | { kind: 'redirect'; location: string }
> {
  const client = await resolveClient(params.get('client_id'));
  if (!client) {
    return { kind: 'show_error', message: 'This app is not recognised.' };
  }
  const redirectUri = params.get('redirect_uri') ?? client.redirectUris[0];
  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    return {
      kind: 'show_error',
      message:
        'The return address for this app does not match its registration.',
    };
  }
  const state = params.get('state');
  const iss = issuer(req);
  if (params.get('response_type') !== 'code') {
    return {
      kind: 'redirect',
      location: redirectWithError(
        redirectUri,
        'unsupported_response_type',
        state,
        iss
      ),
    };
  }
  const challenge = params.get('code_challenge') ?? '';
  if (
    params.get('code_challenge_method') !== 'S256' ||
    !CODE_CHALLENGE.test(challenge)
  ) {
    return {
      kind: 'redirect',
      location: redirectWithError(redirectUri, 'invalid_request', state, iss),
    };
  }
  const resource = params.get('resource') ?? resourceUrl(req);
  if (resource.replace(/\/$/, '') !== resourceUrl(req)) {
    return {
      kind: 'redirect',
      location: redirectWithError(redirectUri, 'invalid_target', state, iss),
    };
  }
  const scope = parseScope(params.get('scope'));
  if (scope.length === 0) {
    return {
      kind: 'redirect',
      location: redirectWithError(redirectUri, 'invalid_scope', state, iss),
    };
  }
  const authReq: AuthRequest = {
    client_id: client.clientId,
    client_name: client.clientName,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    state,
    scope,
    resource: resourceUrl(req),
  };
  return {
    kind: 'ok',
    authReq,
    client,
    token: signToken('authreq', { ...authReq }, TTL.authRequest),
  };
}

function signInEmail(code: string) {
  const subject = `Your ${brand.name} sign-in code: ${code}`;
  const text = [
    `Your code to connect ${brand.name} to ChatGPT is ${code}.`,
    '',
    'It works for 10 minutes. If you did not ask for it, ignore this email: nothing has been connected.',
    '',
    brand.name,
  ].join('\n');
  return { subject, text };
}

/** Step 2: the user gave an email. Always returns a pending token. */
export async function startSignIn(
  authReqToken: string,
  rawEmail: string
): Promise<{ ok: true; pending: string } | { ok: false; message: string }> {
  const authReq = verifyToken<AuthRequestClaims>('authreq', authReqToken);
  if (!authReq) {
    return {
      ok: false,
      message: 'This sign-in has expired. Go back to ChatGPT and try again.',
    };
  }
  const email = normaliseEmail(rawEmail);
  const identity = await findIdentity(email);
  const granted = identity
    ? authReq.scope.filter((s) => identity.scopes.includes(s))
    : [];
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const jti = newId();
  // An unknown email (or one with none of the asked-for roles) gets a hash
  // of a random value, so no code can ever match it.
  const otpHash = keyedHash(`${jti}.${granted.length > 0 ? code : newId()}`);
  const { pur: _p, jti: _j, iat: _i, exp: _e, ...req } = authReq;
  const pending = signToken(
    'otp',
    { ...req, jti, email, granted, otpHash },
    TTL.otp
  );

  if (granted.length > 0) {
    const { subject, text } = signInEmail(code);
    await sendEmail({ to: email, subject, text });
  }
  return { ok: true, pending };
}

/** Step 3: the user typed the code. Returns where to send the browser. */
export async function confirmSignIn(
  req: Request,
  pendingToken: string,
  rawCode: string
): Promise<
  | { ok: true; location: string }
  | { ok: false; message: string; retry: boolean }
> {
  const pending = verifyToken<OtpClaims>('otp', pendingToken);
  if (!pending) {
    return {
      ok: false,
      message: 'This code has expired. Go back to ChatGPT and start again.',
      retry: false,
    };
  }
  if (
    !(await attemptWithin('otp', pending.jti, pending.exp, OTP_MAX_ATTEMPTS))
  ) {
    return {
      ok: false,
      message: 'Too many attempts. Go back to ChatGPT and start again.',
      retry: false,
    };
  }
  const code = rawCode.replace(/\D/g, '');
  const ok =
    pending.granted.length > 0 &&
    code.length === 6 &&
    safeEqual(keyedHash(`${pending.jti}.${code}`), pending.otpHash);
  if (!ok) {
    return {
      ok: false,
      message: 'That code is not right. Check the email and try again.',
      retry: true,
    };
  }
  if (!(await consumeOnce('otp', pending.jti, pending.exp))) {
    return {
      ok: false,
      message: 'This code has already been used.',
      retry: false,
    };
  }
  const identity = await findIdentity(pending.email);
  const scope = identity
    ? pending.granted.filter((s) => identity.scopes.includes(s))
    : [];
  if (scope.length === 0) {
    return {
      ok: false,
      message: 'This account no longer has access.',
      retry: false,
    };
  }
  const authCode = signToken(
    'code',
    {
      client_id: pending.client_id,
      redirect_uri: pending.redirect_uri,
      code_challenge: pending.code_challenge,
      state: pending.state,
      resource: pending.resource,
      email: pending.email,
      scope,
    },
    TTL.code
  );
  const u = new URL(pending.redirect_uri);
  u.searchParams.set('code', authCode);
  if (pending.state) u.searchParams.set('state', pending.state);
  u.searchParams.set('iss', issuer(req));
  return { ok: true, location: u.toString() };
}

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export type TokenError = { error: string; error_description?: string };

function s256(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

async function issueTokens(
  sub: string,
  scope: Scope[],
  aud: string,
  clientId: string
): Promise<TokenResponse> {
  const base = { sub, scope, aud, client_id: clientId };
  return {
    access_token: signToken('access', base, TTL.access),
    token_type: 'Bearer',
    expires_in: TTL.access,
    refresh_token: signToken('refresh', base, TTL.refresh),
    scope: scope.join(' '),
  };
}

/** POST /oauth/token. `form` is the parsed x-www-form-urlencoded body. */
export async function exchangeToken(
  form: URLSearchParams
): Promise<
  | { ok: true; body: TokenResponse }
  | { ok: false; status: number; body: TokenError }
> {
  const grant = form.get('grant_type');
  const clientId = form.get('client_id');
  const bad = (error: string, description?: string, status = 400) => ({
    ok: false as const,
    status,
    body: { error, ...(description ? { error_description: description } : {}) },
  });

  if (grant === 'authorization_code') {
    const code = verifyToken<CodeClaims>('code', form.get('code'));
    if (!code) return bad('invalid_grant', 'Code is invalid or expired');
    if (clientId && clientId !== code.client_id)
      return bad('invalid_grant', 'Client mismatch');
    if (
      form.get('redirect_uri') &&
      form.get('redirect_uri') !== code.redirect_uri
    ) {
      return bad('invalid_grant', 'redirect_uri mismatch');
    }
    const verifier = form.get('code_verifier') ?? '';
    if (
      !CODE_VERIFIER.test(verifier) ||
      !safeEqual(s256(verifier), code.code_challenge)
    ) {
      return bad('invalid_grant', 'PKCE verification failed');
    }
    if (!(await consumeOnce('code', code.jti, code.exp))) {
      return bad('invalid_grant', 'Code already used');
    }
    const identity = await findIdentity(code.email);
    const scope = identity
      ? code.scope.filter((s) => identity.scopes.includes(s))
      : [];
    if (scope.length === 0)
      return bad('invalid_grant', 'Access has been removed');
    return {
      ok: true,
      body: await issueTokens(code.email, scope, code.resource, code.client_id),
    };
  }

  if (grant === 'refresh_token') {
    const refresh = verifyToken<RefreshClaims>(
      'refresh',
      form.get('refresh_token')
    );
    if (!refresh)
      return bad('invalid_grant', 'Refresh token is invalid or expired');
    if (clientId && clientId !== refresh.client_id)
      return bad('invalid_grant', 'Client mismatch');
    // Rotation: each refresh token works once.
    if (!(await consumeOnce('refresh', refresh.jti, refresh.exp))) {
      return bad('invalid_grant', 'Refresh token already used');
    }
    const identity = await findIdentity(refresh.sub);
    const scope = identity
      ? refresh.scope.filter((s) => identity.scopes.includes(s))
      : [];
    if (scope.length === 0)
      return bad('invalid_grant', 'Access has been removed');
    return {
      ok: true,
      body: await issueTokens(
        refresh.sub,
        scope,
        refresh.aud,
        refresh.client_id
      ),
    };
  }

  return bad('unsupported_grant_type');
}

export function verifyAccessToken(
  token: string | undefined,
  audience: string
): AccessClaims | null {
  const claims = verifyToken<AccessClaims>('access', token);
  if (!claims) return null;
  if (claims.aud !== audience) return null;
  return claims;
}
