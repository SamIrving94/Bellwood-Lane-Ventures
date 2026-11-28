import { brand } from '@repo/brand';
import { SITUATION_INFO, type Situation } from '@repo/kept-tools';
import { type AssistantHost, HOST_UTM_SOURCE } from './host';

/**
 * Handoff links from the plugin to the live site, UTM-tagged so the site's
 * lead-source capture (#168) records which assistant and which tool sent
 * the visit. ChatGPT and Claude land as "AI assistant" on the dashboard's
 * "Where enquiries came from" card, with the tool as the campaign.
 */
export function siteLink(
  path: string,
  tool: string,
  host: AssistantHost = 'other'
): string {
  const base = (process.env.KEPT_WEB_URL || brand.url).replace(/\/$/, '');
  const url = new URL(`${base}${path}`);
  url.searchParams.set('utm_source', HOST_UTM_SOURCE[host]);
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
  host: AssistantHost,
  situation?: Situation
): NextStep {
  const info = situation ? SITUATION_INFO[situation] : null;
  return {
    label: `Ask ${brand.name} for a written offer`,
    url: siteLink(info?.path ?? '/sell', tool, host),
    context: `${brand.name} is a cash buyer. We view every home first and send a written offer within two working days of the viewing. ${
      info?.honest ??
      'If you can wait for the open market, an estate agent will usually get you more.'
    }`,
  };
}
