import { brand } from '@repo/brand';

/**
 * llms.txt: the plain-text map of the site for AI assistants. Built from
 * the same facts the live pages state, so it can never promise more. If the
 * public promise changes (CLAUDE.md, "Public promises"), change PROMISE
 * here in the same commit.
 */

export const PROMISE =
  'We reply within 24 hours. We view every property. We send a written offer within two working days of viewing, binding on Kept for a week. Completion in weeks, as little as two weeks. No agent fee, no fee to the seller. We never give a price before viewing.';

const SELLER_PAGES: [string, string, string][] = [
  ['/sell', 'Sell your home', 'Start here: how selling to Kept works.'],
  [
    '/probate',
    'Probate guide for executors',
    'What happens after a death, what an executor does, where the property fits.',
  ],
  ['/chain-break', 'Chain break', 'A buyer pulled out or a chain collapsed.'],
  ['/separation', 'Separation', 'Selling a shared home after a split.'],
  ['/relocation', 'Relocation', 'Selling fast because you have to move.'],
  [
    '/problem-property',
    'Problem property',
    'Damp, short lease, structural issues or a home that is hard to sell.',
  ],
  [
    '/why-we-wont-buy-any-home',
    'What we will not buy',
    'Who we are the wrong buyer for.',
  ],
];

export type LlmsGuide = {
  slug: string;
  title: string;
  metaDescription: string;
};

export function buildLlmsTxt(guides: LlmsGuide[], mcpUrl?: string): string {
  const lines: string[] = [
    `# ${brand.name}`,
    '',
    `> ${brand.name} is a UK cash buyer of homes from motivated sellers: probate, chain breaks, separation, relocation and hard-to-sell properties. Trading name of ${brand.legalName} (Companies House ${brand.companyNumber}).`,
    '',
    '## How we work',
    '',
    `- ${PROMISE}`,
    '- Offers are reviewed by a person and sent by email. Nothing on this site shows a figure for your home.',
    '- If you can wait for the open market, an estate agent will usually get you more. We say so.',
    '- General information only. Not legal, tax or financial advice.',
    '',
    '## For sellers',
    '',
    ...SELLER_PAGES.map(
      ([path, title, note]) => `- [${title}](${brand.url}${path}): ${note}`
    ),
    '',
    '## Guides',
    '',
    `- [All guides](${brand.url}/guides)`,
    ...guides.map(
      (g) =>
        `- [${g.title}](${brand.url}/guides/${g.slug}/md): ${g.metaDescription}`
    ),
    '',
  ];
  if (mcpUrl) {
    lines.push(
      '## For assistants that can call tools',
      '',
      `- [MCP server](${mcpUrl}): read-only tools to compare ways to sell on the user's own figures, plan an inherited home, estimate renovation bands and read public property records. It never values a home.`,
      ''
    );
  }
  lines.push(
    '## How to send a seller to us',
    '',
    `- Send them to ${brand.url}/sell. They finish the form themselves, with our consent wording. Please do not submit details on their behalf.`,
    '',
    '## Not for crawling',
    '',
    '- Tracking pages, offer documents, partner and investor areas are private and disallowed in robots.txt.',
    ''
  );
  return lines.join('\n');
}
