/**
 * Resolve the best "view this property" link for a lead.
 *
 * The stored `listingUrl` is unreliable: it's frequently null, or points at a
 * generic data-provider page (e.g. propertydata.co.uk) rather than the actual
 * property — which lands the founder on a broken or useless page. We only trust
 * a URL when it's a *direct listing detail page* on a recognised portal
 * (Rightmove / Zoopla / OnTheMarket). Anything else falls back to a Google
 * search of the full address, which reliably finds the property (and its real
 * listing, if one exists) instead of dumping the user on a generic site.
 *
 * Pure + side-effect free so it can be unit-tested and used from client
 * components.
 */

export type PropertyLink = {
  url: string;
  label: string;
  /** true = verified direct portal/council link, false = address-search fallback */
  isDirect: boolean;
};

const DIRECT_LISTING_RULES: { label: string; test: (u: URL) => boolean }[] = [
  {
    label: 'View on Rightmove ↗',
    test: (u) =>
      /(^|\.)rightmove\.co\.uk$/.test(u.hostname) &&
      /\/properties\/\d+/.test(u.pathname),
  },
  {
    label: 'View on Zoopla ↗',
    test: (u) =>
      /(^|\.)zoopla\.co\.uk$/.test(u.hostname) &&
      /\/details\/\d+/.test(u.pathname),
  },
  {
    label: 'View on OnTheMarket ↗',
    test: (u) =>
      /(^|\.)onthemarket\.com$/.test(u.hostname) &&
      /\/details\/\d+/.test(u.pathname),
  },
];

function safeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u : null;
  } catch {
    return null;
  }
}

export function resolvePropertyLink(opts: {
  listingUrl?: string | null;
  planningUrl?: string | null;
  address: string;
  postcode: string;
}): PropertyLink {
  const { listingUrl, planningUrl, address, postcode } = opts;

  if (listingUrl) {
    const u = safeUrl(listingUrl);
    if (u) {
      for (const rule of DIRECT_LISTING_RULES) {
        if (rule.test(u)) {
          return { url: listingUrl, label: rule.label, isDirect: true };
        }
      }
    }
  }

  // Planning records are council portal pages — a genuinely useful direct link.
  if (planningUrl) {
    const u = safeUrl(planningUrl);
    if (u) {
      return {
        url: planningUrl,
        label: 'View planning record ↗',
        isDirect: true,
      };
    }
  }

  // Fallback: search the full address. Most reliable way to actually find the
  // property rather than a generic provider page.
  const q = encodeURIComponent(`${address}, ${postcode}`.trim());
  return {
    url: `https://www.google.com/search?q=${q}`,
    label: 'Find property ↗',
    isDirect: false,
  };
}
