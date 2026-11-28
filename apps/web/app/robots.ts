import { brand } from '@repo/brand';
import type { MetadataRoute } from 'next';

/**
 * Crawl rules. The gated and tokenised surfaces are listed here as well as
 * carrying their own noindex, so a crawler never has to fetch them to learn
 * that. The sitemap is how a newly published guide gets found.
 */
const PRIVATE_PATHS = [
  '/api/',
  '/keyhole',
  '/portal',
  '/track',
  '/viewing',
  '/investors/',
  '/partners/',
  '/instant-offer/offer/',
  '/journey/',
  '/guides/preview/',
];

/**
 * AI assistants, named on purpose (founder direction, 28 Nov 2026: sellers
 * will increasingly ask an assistant "how do I sell my home quickly" before
 * they search). We want to be the source those answers quote, so the public
 * pages are open to both kinds of bot:
 *  - answer/search bots (fetch a page when a person asks)
 *  - training crawlers (shape what models know about us)
 * The private list above applies to every one of them. A bot with its own
 * group ignores the `*` group, so the list is repeated, not inherited.
 * To close the door on one, delete its name here; it falls back to `*`.
 */
const AI_CRAWLERS = [
  // OpenAI
  'OAI-SearchBot',
  'ChatGPT-User',
  'GPTBot',
  // Anthropic
  'Claude-SearchBot',
  'Claude-User',
  'ClaudeBot',
  // Google (Gemini training and grounding)
  'Google-Extended',
  // Meta (Muse and other Meta assistants)
  'meta-externalagent',
  'meta-externalfetcher',
  // Perplexity
  'PerplexityBot',
  'Perplexity-User',
  // Apple, Common Crawl (feeds many models)
  'Applebot-Extended',
  'CCBot',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE_PATHS },
      { userAgent: AI_CRAWLERS, allow: '/', disallow: PRIVATE_PATHS },
    ],
    sitemap: `${brand.url}/sitemap.xml`,
  };
}
