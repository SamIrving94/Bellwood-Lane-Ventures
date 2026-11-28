import { brand } from '@repo/brand';
import { SITUATION_INFO, type Situation } from '@repo/kept-tools';

/**
 * Handoff links from the plugin to the live site, UTM-tagged so the site's
 * lead-source capture (#168) records which assistant and which tool sent
 * the visit. ChatGPT and Claude land as "AI assistant" on the dashboard's
 * "Where enquiries came from" card (packages/analytics/lead-source.ts),
 * with the tool as the campaign. Nothing is collected inside the assistant:
 * the user finishes on our own page, with our own consent copy.
 */

/**
 * Which assistant is calling, for the utm_source tag and the usage log.
 * Read from the MCP client's own name at initialize. ChatGPT and Claude are
 * folded to 'chatgpt' and 'claude' so history stays comparable; any other
 * client keeps its own name (Muse, Instinct...) as a short slug, so we can
 * see which assistants send real sellers before building for any of them.
 * Unknown or missing = 'agent'. Only the client's product name is used;
 * nothing about the user.
 */
const CHATGPT_CLIENT = /openai|chatgpt/;
const CLAUDE_CLIENT = /claude|anthropic/;
const NON_SLUG = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;
const TRAILING_SLASH = /\/$/;

export function clientSource(clientName: string | undefined | null): string {
  const name = (clientName ?? '').toLowerCase();
  if (CHATGPT_CLIENT.test(name)) {
    return 'chatgpt';
  }
  if (CLAUDE_CLIENT.test(name)) {
    return 'claude';
  }
  const slug = name
    .replace(NON_SLUG, '-')
    .replace(EDGE_DASHES, '')
    .slice(0, 30);
  return slug || 'agent';
}

/**
 * The source for one tool call. A stateless request can reach a server
 * instance that never saw the client's initialize, so the client name may
 * be missing; then the HTTP User-Agent decides. It recognises only ChatGPT
 * and Claude: a library's User-Agent is not an assistant's name. The SDK
 * passes the original request to tool callbacks as ctx.http.req.
 */
export function callSource(
  clientName: string | undefined | null,
  ctx: unknown
): string {
  const named = clientSource(clientName);
  if (named !== 'agent') {
    return named;
  }
  const req = (ctx as { http?: { req?: Request } } | undefined)?.http?.req;
  const userAgent = (req?.headers?.get('user-agent') ?? '').toLowerCase();
  if (CHATGPT_CLIENT.test(userAgent)) {
    return 'chatgpt';
  }
  if (CLAUDE_CLIENT.test(userAgent)) {
    return 'claude';
  }
  return 'agent';
}

export function siteLink(path: string, tool: string, source = 'agent'): string {
  const base = (process.env.KEPT_WEB_URL || brand.url).replace(
    TRAILING_SLASH,
    ''
  );
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
 * working days of the viewing, no figure before it. With a situation, it
 * goes to that situation's page and carries that page's own honest line.
 */
export function keptHandoff(
  tool: string,
  source: string,
  situation?: Situation
): NextStep {
  const info = situation ? SITUATION_INFO[situation] : null;
  return {
    label: `Ask ${brand.name} for a written offer`,
    url: siteLink(info?.path ?? '/sell', tool, source),
    context: `${brand.name} is a cash buyer. We view every home first and send a written offer within two working days of the viewing. ${
      info?.honest ??
      'If you can wait for the open market, an estate agent will usually get you more.'
    }`,
  };
}
