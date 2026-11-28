import { brand } from '@repo/brand';

/**
 * What the server is for, stated as facts. Directory reviewers reject tool
 * text that tells the model how to behave (Claude review criteria), so the
 * limits below describe what the tools do and don't do.
 */
export const SERVER_INSTRUCTIONS = `${brand.name} helps people in the UK who need to sell a home that is hard to sell or on a deadline: an inherited home, a sale that fell through, a separation, a move away, a move into care, or a property with a problem. The tools compare ways to sell on the user's own figures, check which ways can finish by a date, build a dated plan for an inherited home, estimate renovation budgets, and read public records. They do not value homes or make offers: prices come from the user. They give general information, not legal, tax or financial advice. ${brand.name} is a cash buyer; the tools say so, and say when an estate agent is likely to get more. A user who wants ${brand.name} to look at their home can ask ${brand.name} to get in touch.`;

/**
 * What the server says about itself at connection time. MCP clients can
 * show the title and icon (Kept's monogram, served by the live site).
 */
const SERVER_ICON = [
  {
    src: `${brand.url}/apple-icon.png`,
    mimeType: 'image/png',
    sizes: ['180x180'],
  },
];

export const PUBLIC_SERVER_INFO = {
  name: 'kept',
  title: brand.name,
  version: '1.1.0',
  websiteUrl: brand.url,
  icons: SERVER_ICON,
};

export const PRO_SERVER_INFO = {
  name: 'kept-pro',
  title: `${brand.name} Pro`,
  version: '1.1.0',
  websiteUrl: brand.url,
  icons: SERVER_ICON,
};
