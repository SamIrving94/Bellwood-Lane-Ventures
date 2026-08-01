import type { ActionType } from '@repo/database';

/**
 * All FounderAction types that the Marketing hub should surface.
 * The Queue tab filters on these, the Calendar tab shows completed ones,
 * and the Performance tab groups counts by these.
 *
 * Cast to `ActionType[]` so Prisma's `in:` accepts the mutable array.
 * Each literal is asserted as an ActionType — the new approve_* enum members
 * are added by Agent A's schema migration in this branch.
 */
export const MARKETING_ACTION_TYPES: ActionType[] = [
  'approve_ig_post' as ActionType,
  'approve_linkedin_post' as ActionType,
  'approve_blog_draft' as ActionType,
  'approve_case_study' as ActionType,
  'approve_solicitor_outreach' as ActionType,
  'approve_paid_ad_copy' as ActionType,
  'approve_outreach_draft' as ActionType,
  'review_campaign' as ActionType,
  'dispatch_campaign' as ActionType,
];

export type MarketingActionType = ActionType;

/**
 * Custom alphabetical-aware ordering — Prisma enum ordering is alphabetical so
 * we re-sort in JS. Lower number = higher priority.
 */
export const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Human labels for the per-type chips/badges.
 */
export const MARKETING_TYPE_LABELS: Record<string, string> = {
  approve_ig_post: 'Instagram',
  approve_linkedin_post: 'LinkedIn',
  approve_blog_draft: 'Blog',
  approve_case_study: 'Case study',
  approve_solicitor_outreach: 'Solicitor outreach',
  approve_paid_ad_copy: 'Paid ad',
  approve_outreach_draft: 'Outreach',
  review_campaign: 'Campaign review',
  dispatch_campaign: 'Campaign dispatch',
};

/**
 * Short codes shown on calendar chips, e.g. "IG", "LI", "Blog".
 */
export const MARKETING_TYPE_SHORT: Record<string, string> = {
  approve_ig_post: 'IG',
  approve_linkedin_post: 'LI',
  approve_blog_draft: 'Blog',
  approve_case_study: 'Case',
  approve_solicitor_outreach: 'Sol',
  approve_paid_ad_copy: 'Ad',
  approve_outreach_draft: 'Out',
  review_campaign: 'Camp',
  dispatch_campaign: 'Disp',
};
