import { brand } from '@repo/brand';

/**
 * Handoff links from the plugin to the live site. UTM-tagged so the site's
 * analytics can count plugin-sourced visits and form submissions — the
 * plugin's success metric (docs/mcp/04-prd.md). Nothing is collected inside
 * ChatGPT; the user finishes on our own page, with our own consent copy.
 */
export function siteLink(path: string, tool: string): string {
  const base = (process.env.KEPT_WEB_URL || brand.url).replace(/\/$/, '');
  const url = new URL(`${base}${path}`);
  url.searchParams.set('utm_source', 'chatgpt');
  url.searchParams.set('utm_medium', 'plugin');
  url.searchParams.set('utm_campaign', tool);
  return url.toString();
}

export interface NextStep {
  label: string;
  url: string;
  /** Plain-English context shown beside the button. */
  context: string;
}

/**
 * The one honest handoff (docs/brand/KEPT.md: say who we're wrong for,
 * unprompted). Wording matches the live promise: written offer within two
 * working days of the viewing, no figure before it.
 */
export function keptHandoff(path: string, tool: string): NextStep {
  return {
    label: `Ask ${brand.name} for a written offer`,
    url: siteLink(path, tool),
    context: `${brand.name} is a cash buyer. We view every home first and send a written offer within two working days of the viewing. If you can wait for the open market, an estate agent will usually get you more.`,
  };
}
