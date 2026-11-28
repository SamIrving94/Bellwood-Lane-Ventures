import { brand } from '@repo/brand';

/**
 * Handoff links from the plugin to the live site. UTM-tagged so the site's
 * analytics can count plugin-sourced visits and form submissions — the
 * plugin's success metric (docs/mcp/04-prd.md). Nothing is collected inside
 * ChatGPT; the user finishes on our own page, with our own consent copy.
 */
/**
 * Which assistant is calling, for the utm_source tag. Read from the MCP
 * client's own name at initialize. ChatGPT is folded to 'chatgpt' so history
 * stays comparable; any other client keeps its own name (Muse, Instinct,
 * Claude...) as a short slug, so we can see which assistants send real
 * sellers before building for any of them. Unknown or missing = 'agent'.
 * Only the client's product name is used; nothing about the user.
 */
const CHATGPT_CLIENT = /openai|chatgpt/;
const NON_SLUG = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;

export function clientSource(clientName: string | undefined | null): string {
  const name = (clientName ?? '').toLowerCase();
  if (CHATGPT_CLIENT.test(name)) {
    return 'chatgpt';
  }
  const slug = name
    .replace(NON_SLUG, '-')
    .replace(EDGE_DASHES, '')
    .slice(0, 30);
  return slug || 'agent';
}

export function siteLink(path: string, tool: string, source = 'agent'): string {
  const base = (process.env.KEPT_WEB_URL || brand.url).replace(/\/$/, '');
  const url = new URL(`${base}${path}`);
  url.searchParams.set('utm_source', source);
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
export function keptHandoff(
  path: string,
  tool: string,
  source = 'agent'
): NextStep {
  return {
    label: `Ask ${brand.name} for a written offer`,
    url: siteLink(path, tool, source),
    context: `${brand.name} is a cash buyer. We view every home first and send a written offer within two working days of the viewing. If you can wait for the open market, an estate agent will usually get you more.`,
  };
}
