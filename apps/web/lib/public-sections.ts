/**
 * Sections of the public site that are switched off for now (founder
 * decision, 11 Oct 2026: hide the agent side and the pricing methodology
 * publicly until we're ready to show them).
 *
 * Off means: the pages 404, every link to them is hidden, and they drop out
 * of the sitemap. The pages themselves are untouched, so turning a section
 * back on is flipping its flag here (plus HIDDEN_LANDINGS in
 * apps/api/app/cron/_lib/guides/evergreen-questions.ts, which the guide
 * writer can't import from this app).
 *
 * Not covered on purpose: /partners/login and /portal (existing partners
 * sign in to those; they are not public) and /partners/[code] referral
 * links, which only redirect into the seller flow.
 */
export const AGENT_SIDE_PUBLIC = false;
export const METHODOLOGY_PUBLIC = false;

const AGENT_SIDE_PATHS = [
  '/agents',
  '/save-the-sale',
  '/partners/signup',
  '/instant-offer/partner-brief',
];
const METHODOLOGY_PATHS = ['/instant-offer/methodology'];

/**
 * True when a site path points into a hidden section — for links stored as
 * data (e.g. a published guide's CTA) that can't be gated at the call site.
 */
export function isHiddenPath(href: string): boolean {
  const path = href.split(/[?#]/)[0];
  const hidden = [
    ...(AGENT_SIDE_PUBLIC ? [] : AGENT_SIDE_PATHS),
    ...(METHODOLOGY_PUBLIC ? [] : METHODOLOGY_PATHS),
  ];
  return hidden.some((p) => path === p || path.startsWith(`${p}/`));
}
