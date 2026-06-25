/**
 * Pure helpers for social publishing (no server-only import, so they're unit
 * testable). The Ayrshare client in ./ayrshare consumes these.
 */

export type SocialPlatform = 'linkedin' | 'instagram' | 'facebook';

/**
 * Which social platforms a marketing FounderAction publishes to, by type.
 * Returns null for drafts that aren't social posts (blog, case study, ad copy,
 * outreach) — those have other destinations and shouldn't be pushed to socials.
 */
export function platformsForActionType(type: string): SocialPlatform[] | null {
  switch (type) {
    case 'approve_ig_post':
      return ['instagram'];
    case 'approve_linkedin_post':
      return ['linkedin'];
    default:
      return null;
  }
}

/**
 * Pull the post text (and any media) out of a FounderAction's metadata. The
 * marketer crons store the copy under `caption` (IG) or `body`/`draft`
 * (LinkedIn). Returns null when there's no usable text.
 */
export function extractPostContent(
  metadata: unknown
): { text: string; mediaUrls: string[] } | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const m = metadata as Record<string, unknown>;
  const text =
    (typeof m.caption === 'string' && m.caption.trim()) ||
    (typeof m.body === 'string' && m.body.trim()) ||
    (typeof m.draft === 'string' && m.draft.trim()) ||
    '';
  if (!text) return null;
  const mediaUrls = Array.isArray(m.mediaUrls)
    ? m.mediaUrls.filter((u): u is string => typeof u === 'string')
    : typeof m.imageUrl === 'string'
      ? [m.imageUrl]
      : [];
  return { text, mediaUrls };
}
