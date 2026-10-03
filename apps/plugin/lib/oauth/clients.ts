/**
 * OAuth clients for the Pro plugin. Two ways a client (ChatGPT) identifies
 * itself, both stateless:
 *
 *  - **CIMD** (Client ID Metadata Document, preferred by the 2026-07-28 MCP
 *    spec): client_id is an https URL serving the client's metadata. We
 *    fetch it, but only from an allowlist of hosts (PLUGIN_CIMD_HOSTS),
 *    because fetching an arbitrary caller-supplied URL from our server is an
 *    SSRF hole.
 *  - **DCR** (Dynamic Client Registration, deprecated but still used): we
 *    sign the registered metadata into the client_id itself, so there is no
 *    client table to keep.
 */

import { TTL } from './config';
import { signToken, verifyToken } from './tokens';

export interface OAuthClient {
  clientId: string;
  clientName: string;
  redirectUris: string[];
}

const DCR_PREFIX = 'kc_';
const DEFAULT_CIMD_HOSTS = [
  'openai.com',
  'chatgpt.com',
  'oaiusercontent.com',
  'claude.ai',
  'anthropic.com',
];
const MAX_REDIRECT_URIS = 10;
const MAX_METADATA_BYTES = 64 * 1024;

function cimdHosts(): string[] {
  const raw = process.env.PLUGIN_CIMD_HOSTS;
  return raw
    ? raw
        .split(',')
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean)
    : DEFAULT_CIMD_HOSTS;
}

function hostAllowed(host: string): boolean {
  const h = host.toLowerCase();
  return cimdHosts().some(
    (allowed) => h === allowed || h.endsWith(`.${allowed}`)
  );
}

/** https anywhere; http only for loopback (local development clients). */
export function isAcceptableRedirectUri(uri: string): boolean {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash) return false;
  if (u.protocol === 'https:') return true;
  return (
    u.protocol === 'http:' &&
    (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
  );
}

export function registerClient(
  body: unknown
):
  | { ok: true; client: OAuthClient; clientIdIssuedAt: number }
  | { ok: false; error: string; description: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const uris = b.redirect_uris;
  if (
    !Array.isArray(uris) ||
    uris.length === 0 ||
    uris.length > MAX_REDIRECT_URIS ||
    !uris.every((u) => typeof u === 'string' && isAcceptableRedirectUri(u))
  ) {
    return {
      ok: false,
      error: 'invalid_redirect_uri',
      description: 'redirect_uris must be 1–10 https URLs',
    };
  }
  const method = b.token_endpoint_auth_method ?? 'none';
  if (method !== 'none') {
    return {
      ok: false,
      error: 'invalid_client_metadata',
      description:
        'Only public clients (token_endpoint_auth_method "none") are supported',
    };
  }
  const clientName =
    typeof b.client_name === 'string'
      ? b.client_name.slice(0, 100)
      : 'MCP client';
  const token = signToken(
    'client',
    { redirect_uris: uris, client_name: clientName },
    TTL.client
  );
  return {
    ok: true,
    client: {
      clientId: `${DCR_PREFIX}${token}`,
      clientName,
      redirectUris: uris as string[],
    },
    clientIdIssuedAt: Math.floor(Date.now() / 1000),
  };
}

async function fetchCimd(clientId: string): Promise<OAuthClient | null> {
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !hostAllowed(url.hostname)) return null;
  const res = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
    headers: { accept: 'application/json' },
  }).catch(() => null);
  if (!res?.ok) return null;
  const text = await res.text();
  if (text.length > MAX_METADATA_BYTES) return null;
  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
  // The document must name itself, or anyone could host a copy.
  if (doc.client_id !== clientId) return null;
  const uris = doc.redirect_uris;
  if (
    !Array.isArray(uris) ||
    !uris.every((u) => typeof u === 'string' && isAcceptableRedirectUri(u))
  ) {
    return null;
  }
  return {
    clientId,
    clientName:
      typeof doc.client_name === 'string'
        ? doc.client_name.slice(0, 100)
        : url.hostname,
    redirectUris: uris as string[],
  };
}

export async function resolveClient(
  clientId: string | null | undefined
): Promise<OAuthClient | null> {
  if (!clientId) return null;
  if (clientId.startsWith(DCR_PREFIX)) {
    const claims = verifyToken<{
      redirect_uris: string[];
      client_name: string;
      pur: 'client';
      jti: string;
      iat: number;
      exp: number;
    }>('client', clientId.slice(DCR_PREFIX.length));
    if (!claims) return null;
    return {
      clientId,
      clientName: claims.client_name,
      redirectUris: claims.redirect_uris,
    };
  }
  if (clientId.startsWith('https://')) {
    return await fetchCimd(clientId);
  }
  return null;
}
