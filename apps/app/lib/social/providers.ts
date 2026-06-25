import 'server-only';

/**
 * Pluggable social-publishing providers.
 *
 * The publish loop + connect page talk to a `SocialProvider`, not a specific
 * vendor — so we can run a free / open-source stack instead of a paid SaaS.
 * Pick one with the SOCIAL_PROVIDER env var:
 *
 *   - `linkedin` (default) — LinkedIn's free REST API. Text posts to one
 *     author (person or organisation). No monthly fee. Highest-value channel.
 *   - `postiz` — self-hosted open-source Postiz (postiz.com / github). One hub
 *     for LinkedIn + Instagram + Facebook; Anthony connects accounts in the
 *     Postiz UI, we hand approved posts to its API. ~free.
 *   - `ayrshare` — the paid SaaS (kept as an option, off by default).
 *
 * Every provider is graceful: with no credentials it returns `skipped` so the
 * approve flow still completes and stamps publishedAt.
 */

import { publishToSocial as ayrsharePublish } from './ayrshare';
import { getConnectedAccounts as ayrshareStatus } from './ayrshare-accounts';
import type {
  PublishInput,
  PublishResult,
  SocialPlatform,
} from './post-mapping';

const TIMEOUT_MS = 12_000;

export type ProviderId = 'linkedin' | 'postiz' | 'ayrshare';

export interface ProviderStatus {
  configured: boolean;
  connected: SocialPlatform[];
  displayNames: { platform: string; displayName: string }[];
  error?: string;
  /** Where the founder goes to connect/manage accounts (opened by the UI). */
  manageUrl?: string;
  /** Shown when there's no one-click connect (e.g. token-based setup). */
  setupNote?: string;
}

export interface SocialProvider {
  id: ProviderId;
  label: string;
  /** Platforms this provider can publish to in the current config. */
  supports: SocialPlatform[];
  publish(input: PublishInput): Promise<PublishResult>;
  getStatus(): Promise<ProviderStatus>;
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

// ---------------------------------------------------------------------------
// LinkedIn — direct, free REST API
// ---------------------------------------------------------------------------

const LINKEDIN_API = 'https://api.linkedin.com/rest/posts';

const linkedinProvider: SocialProvider = {
  id: 'linkedin',
  label: 'LinkedIn',
  supports: ['linkedin'],

  async publish(input) {
    const platforms = input.platforms.filter((p) => p === 'linkedin');
    if (platforms.length === 0 || !input.text.trim()) {
      return { status: 'unsupported', platforms: input.platforms };
    }

    const token = process.env.LINKEDIN_ACCESS_TOKEN;
    const author = process.env.LINKEDIN_AUTHOR_URN; // urn:li:person:… or urn:li:organization:…
    if (!token || !author) {
      console.warn('[social/linkedin] not configured — skipping publish');
      return { status: 'skipped', platforms };
    }
    // LinkedIn's API has no native schedule on this endpoint — post now.
    const version = process.env.LINKEDIN_API_VERSION ?? '202405';
    try {
      const res = await withTimeout(LINKEDIN_API, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': version,
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          author,
          commentary: input.text,
          visibility: 'PUBLIC',
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          lifecycleState: 'PUBLISHED',
          isReblogDisabledByAuthor: false,
        }),
      });
      if (res.status !== 201 && !res.ok) {
        const body = await res.text().catch(() => '');
        return {
          status: 'error',
          platforms,
          error: `LinkedIn ${res.status}: ${body.slice(0, 200)}`,
        };
      }
      const id =
        res.headers.get('x-restli-id') ??
        res.headers.get('x-linkedin-id') ??
        undefined;
      return { status: 'published', platforms, id };
    } catch (err) {
      return {
        status: 'error',
        platforms,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },

  getStatus() {
    const token = process.env.LINKEDIN_ACCESS_TOKEN;
    const author = process.env.LINKEDIN_AUTHOR_URN;
    const configured = Boolean(token && author);
    return Promise.resolve({
      configured,
      connected: configured ? (['linkedin'] as SocialPlatform[]) : [],
      displayNames: [],
      manageUrl: 'https://www.linkedin.com/',
      setupNote: configured
        ? undefined
        : 'Add LINKEDIN_ACCESS_TOKEN + LINKEDIN_AUTHOR_URN (free — generate via LinkedIn Developer portal).',
    });
  },
};

// ---------------------------------------------------------------------------
// Postiz — self-hosted, open source
// ---------------------------------------------------------------------------

const postizProvider: SocialProvider = {
  id: 'postiz',
  label: 'Postiz (self-hosted)',
  supports: ['linkedin', 'instagram', 'facebook'],

  async publish(input) {
    const base = process.env.POSTIZ_API_URL; // e.g. https://postiz.yourdomain.com
    const key = process.env.POSTIZ_API_KEY;
    if (input.platforms.length === 0 || !input.text.trim()) {
      return { status: 'unsupported', platforms: input.platforms };
    }
    if (!base || !key) {
      console.warn('[social/postiz] not configured — skipping publish');
      return { status: 'skipped', platforms: input.platforms };
    }
    try {
      const res = await withTimeout(
        `${base.replace(/\/$/, '')}/public/v1/posts`,
        {
          method: 'POST',
          headers: {
            Authorization: key,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: input.scheduleDate ? 'schedule' : 'now',
            ...(input.scheduleDate ? { date: input.scheduleDate } : {}),
            content: input.text,
            platforms: input.platforms,
            ...(input.mediaUrls && input.mediaUrls.length > 0
              ? { mediaUrls: input.mediaUrls }
              : {}),
          }),
        }
      );
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return {
          status: 'error',
          platforms: input.platforms,
          error: `Postiz ${res.status}: ${body.slice(0, 160)}`,
        };
      }
      const data = (await res.json().catch(() => null)) as {
        id?: string;
      } | null;
      return {
        status: input.scheduleDate ? 'scheduled' : 'published',
        platforms: input.platforms,
        id: data?.id,
      };
    } catch (err) {
      return {
        status: 'error',
        platforms: input.platforms,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },

  getStatus() {
    const base = process.env.POSTIZ_API_URL;
    const key = process.env.POSTIZ_API_KEY;
    const configured = Boolean(base && key);
    return Promise.resolve({
      configured,
      // Postiz manages connections in its own UI; we can't reliably enumerate
      // them, so we point the founder there to connect/check.
      connected: [],
      displayNames: [],
      manageUrl: base ?? 'https://postiz.com',
      setupNote: configured
        ? 'Connect/manage your accounts in your Postiz dashboard.'
        : 'Self-host Postiz (open source), then set POSTIZ_API_URL + POSTIZ_API_KEY.',
    });
  },
};

// ---------------------------------------------------------------------------
// Ayrshare — paid SaaS (optional)
// ---------------------------------------------------------------------------

const ayrshareProvider: SocialProvider = {
  id: 'ayrshare',
  label: 'Ayrshare',
  supports: ['linkedin', 'instagram', 'facebook'],
  publish: (input) => ayrsharePublish(input),
  async getStatus() {
    const s = await ayrshareStatus();
    return {
      configured: s.configured,
      connected: s.connected,
      displayNames: s.displayNames,
      error: s.error,
      manageUrl: 'https://app.ayrshare.com/social-accounts',
      setupNote: s.configured
        ? undefined
        : 'Add AYRSHARE_API_KEY (paid SaaS) to use this provider.',
    };
  },
};

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

const PROVIDERS: Record<ProviderId, SocialProvider> = {
  linkedin: linkedinProvider,
  postiz: postizProvider,
  ayrshare: ayrshareProvider,
};

/** Resolve the configured SOCIAL_PROVIDER (defaults to free LinkedIn). */
export function resolveProviderId(raw: string | undefined): ProviderId {
  return raw === 'postiz' || raw === 'ayrshare' || raw === 'linkedin'
    ? raw
    : 'linkedin';
}

export function getSocialProvider(): SocialProvider {
  return PROVIDERS[resolveProviderId(process.env.SOCIAL_PROVIDER)];
}
