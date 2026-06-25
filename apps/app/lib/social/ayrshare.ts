import 'server-only';

/**
 * Social publishing via Ayrshare — one API for LinkedIn, Instagram, Facebook.
 *
 * This is the "publish" leg the Marketer agent was missing: approving a draft
 * used to just mark it done; now it can actually post (or schedule) it. Behind
 * the founder-approval gate — nothing here auto-publishes without an explicit
 * approve action.
 *
 * Graceful by design (mirrors @repo/email): with no AYRSHARE_API_KEY the
 * publish is a no-op that returns `status: 'skipped'`, so the approve flow still
 * completes and stamps publishedAt — it goes live for real once the key is set.
 */

import type { SocialPlatform } from './post-mapping';

export {
  extractPostContent,
  platformsForActionType,
  type SocialPlatform,
} from './post-mapping';

const AYRSHARE_ENDPOINT = 'https://api.ayrshare.com/api/post';
const REQUEST_TIMEOUT_MS = 12_000;

export type PublishStatus =
  | 'published' // posted now
  | 'scheduled' // queued for a future time
  | 'skipped' // no API key — flow continues, nothing posted
  | 'unsupported' // this draft type isn't a social post (e.g. blog, ad copy)
  | 'error';

export interface PublishResult {
  status: PublishStatus;
  platforms: SocialPlatform[];
  /** Ayrshare post id when published/scheduled. */
  id?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------

export interface PublishInput {
  platforms: SocialPlatform[];
  text: string;
  mediaUrls?: string[];
  /** ISO-8601 — when omitted, posts immediately. */
  scheduleDate?: string;
}

export async function publishToSocial(
  input: PublishInput
): Promise<PublishResult> {
  const { platforms, text, mediaUrls = [], scheduleDate } = input;

  if (platforms.length === 0 || !text.trim()) {
    return { status: 'unsupported', platforms };
  }

  const apiKey = process.env.AYRSHARE_API_KEY;
  if (!apiKey) {
    console.warn(
      '[social/ayrshare] AYRSHARE_API_KEY not set — skipping publish (flow continues)'
    );
    return { status: 'skipped', platforms };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(AYRSHARE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        post: text,
        platforms,
        ...(mediaUrls.length > 0 ? { mediaUrls } : {}),
        ...(scheduleDate ? { scheduleDate } : {}),
      }),
      signal: controller.signal,
    });

    const data = (await res.json().catch(() => null)) as {
      id?: string;
      status?: string;
      errors?: unknown;
    } | null;

    if (!res.ok || data?.status === 'error') {
      return {
        status: 'error',
        platforms,
        error: `Ayrshare ${res.status}${data?.errors ? `: ${JSON.stringify(data.errors).slice(0, 200)}` : ''}`,
      };
    }

    return {
      status: scheduleDate ? 'scheduled' : 'published',
      platforms,
      id: data?.id,
    };
  } catch (err) {
    return {
      status: 'error',
      platforms,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
