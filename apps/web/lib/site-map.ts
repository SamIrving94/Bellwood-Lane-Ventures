/**
 * The public site's information architecture, in one place.
 *
 * The shared SiteFooter renders these groups and sitemap.ts derives the
 * sitemap from them, so a page added here is linked from every footer AND
 * submitted to search engines; a page missing here is an orphan. (The UX
 * review found six hand-built footers, each linking a different subset, and
 * /legal/privacy reachable from almost none of them.)
 *
 * Token-bearing and print-only pages (/track, /viewing, /investors, offer
 * documents, partner briefs) are deliberately absent: they are reached by
 * private link, never browsed to.
 */

import { AGENT_SIDE_PUBLIC, METHODOLOGY_PUBLIC } from './public-sections';

export type SiteLink = {
  href: string;
  label: string;
  /** false = linked in the footer but not submitted in sitemap.xml. */
  sitemap?: false;
};

export type SiteGroup = { title: string; links: SiteLink[] };

export const SITE_MAP: SiteGroup[] = [
  {
    title: 'Sellers',
    links: [
      { href: '/sell', label: 'Sell your home' },
      { href: '/probate', label: 'Probate guide' },
      { href: '/guides', label: 'Guides' },
      { href: '/chain-break', label: 'Chain break' },
      { href: '/separation', label: 'Separation' },
      { href: '/relocation', label: 'Relocation' },
      { href: '/problem-property', label: 'Problem property' },
      { href: '/your-situation', label: 'Something else' },
      { href: '/why-we-wont-buy-any-home', label: 'What we won’t buy' },
    ],
  },
  // Hidden sections (lib/public-sections.ts) drop out of the footer and the
  // sitemap together. Partner sign-in goes with the agent side: existing
  // partners keep their direct link to /partners/login.
  ...(AGENT_SIDE_PUBLIC
    ? [
        {
          title: 'Agents',
          links: [
            { href: '/agents', label: 'For agents' },
            { href: '/save-the-sale', label: 'Save a sale' },
            {
              href: '/partners/login',
              label: 'Partner sign in',
              sitemap: false as const,
            },
          ],
        },
      ]
    : []),
  {
    title: 'Kept',
    links: [
      { href: '/about', label: 'Kept’s story' },
      ...(METHODOLOGY_PUBLIC
        ? [{ href: '/instant-offer/methodology', label: 'Methodology' }]
        : []),
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/legal/privacy', label: 'Privacy notice' },
      { href: '/legal/fca-disclosure', label: 'Regulatory status' },
    ],
  },
];
