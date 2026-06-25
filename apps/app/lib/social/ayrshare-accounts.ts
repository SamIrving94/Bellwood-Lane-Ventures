import 'server-only';

/**
 * Ayrshare account connection — lets the founder link his own social accounts
 * (LinkedIn / Instagram / Facebook) to the platform, so approved drafts post to
 * the real accounts.
 *
 * Model: a single Ayrshare account (one AYRSHARE_API_KEY). The founder links
 * his socials through Ayrshare's **hosted linking page** — we generate a signed
 * URL and send him there; he authorises each network with Ayrshare (we never
 * touch his social passwords). After linking, `getConnectedAccounts()` reports
 * which platforms are live.
 *
 * Graceful by design: with no key it reports `configured: false` and the UI
 * shows setup instructions instead of erroring.
 */

import type { SocialPlatform } from './post-mapping';

const API = 'https://api.ayrshare.com/api';
const TIMEOUT_MS = 10_000;

export const SUPPORTED_PLATFORMS: SocialPlatform[] = [
  'linkedin',
  'instagram',
  'facebook',
];

export interface ConnectionStatus {
  /** AYRSHARE_API_KEY present. */
  configured: boolean;
  /** Platforms currently linked and ready to post. */
  connected: SocialPlatform[];
  /** Human-readable account names per platform, when Ayrshare returns them. */
  displayNames: { platform: string; displayName: string }[];
  /** Set when we couldn't reach Ayrshare (network/auth) — UI surfaces it. */
  error?: string;
}

async function withTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch which social accounts are currently linked to the Ayrshare account.
 */
export async function getConnectedAccounts(): Promise<ConnectionStatus> {
  const apiKey = process.env.AYRSHARE_API_KEY;
  if (!apiKey) {
    return { configured: false, connected: [], displayNames: [] };
  }

  try {
    const res = await withTimeout(`${API}/user`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      return {
        configured: true,
        connected: [],
        displayNames: [],
        error: `Ayrshare ${res.status}`,
      };
    }
    const data = (await res.json()) as {
      activeSocialAccounts?: string[];
      displayNames?: { platform?: string; displayName?: string }[];
    };

    const active = Array.isArray(data.activeSocialAccounts)
      ? data.activeSocialAccounts
      : [];
    const connected = SUPPORTED_PLATFORMS.filter((p) => active.includes(p));
    const displayNames = (data.displayNames ?? [])
      .filter((d): d is { platform: string; displayName: string } =>
        Boolean(d?.platform && d?.displayName)
      )
      .map((d) => ({ platform: d.platform, displayName: d.displayName }));

    return { configured: true, connected, displayNames };
  } catch (err) {
    return {
      configured: true,
      connected: [],
      displayNames: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export type LinkingUrlResult =
  | { ok: true; url: string }
  | { ok: false; reason: string };

/**
 * Generate the Ayrshare hosted linking URL the founder is sent to in order to
 * connect/manage his social accounts.
 *
 * Uses Ayrshare's JWT SSO (Business plan): needs AYRSHARE_PRIVATE_KEY +
 * AYRSHARE_DOMAIN (+ optional AYRSHARE_PROFILE_KEY for a specific profile).
 * Returns a not-configured reason when those aren't set, so the UI can fall
 * back to "connect in the Ayrshare dashboard" instructions.
 */
export async function getLinkingUrl(): Promise<LinkingUrlResult> {
  const apiKey = process.env.AYRSHARE_API_KEY;
  if (!apiKey) return { ok: false, reason: 'no_api_key' };

  const domain = process.env.AYRSHARE_DOMAIN;
  const privateKey = process.env.AYRSHARE_PRIVATE_KEY;
  if (!domain || !privateKey) return { ok: false, reason: 'no_sso_keys' };

  try {
    const res = await withTimeout(`${API}/profiles/generateJWT`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        domain,
        privateKey,
        ...(process.env.AYRSHARE_PROFILE_KEY
          ? { profileKey: process.env.AYRSHARE_PROFILE_KEY }
          : {}),
      }),
    });
    const data = (await res.json().catch(() => null)) as {
      url?: string;
      status?: string;
    } | null;
    if (!res.ok || !data?.url) {
      return { ok: false, reason: `ayrshare_${res.status}` };
    }
    return { ok: true, url: data.url };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'request_failed',
    };
  }
}
