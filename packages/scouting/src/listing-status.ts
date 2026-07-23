/**
 * Listing-liveness check — is a portal listing still actually for sale?
 *
 * Why: ScoutLeads persist for days between sourcing and appraisal (area
 * rotation), and a listing that was live when sourced can go SSTC (sold
 * subject to contract) or be withdrawn in the meantime. The appraisal crons
 * spend real money per lead (~22 PropertyData credits for a snapshot, plus an
 * AVM and a Claude vision call), so re-validating the listing first — for
 * free, by fetching the listing page itself — protects that spend.
 *
 * Design: FAIL OPEN. We only ever report 'sstc'/'removed' on a positive
 * marker match (or a hard 404/410). Blocked fetches, timeouts, bot
 * challenges and odd pages all come back 'unknown', and callers treat
 * 'unknown' exactly like 'live' — worst case is today's behaviour. Callers
 * must also never delete on a dead verdict: park the lead as 'passed' (it
 * stays visible in the Passed tab) so a false positive is recoverable.
 */

const USER_AGENT =
  'BellwoodListingCheck/1.0 (+https://bellwoodslane.co.uk; respect robots.txt)';
const FETCH_TIMEOUT_MS = 10_000;

export type ListingLiveness = 'live' | 'sstc' | 'removed' | 'unknown';

export type ListingCheck = {
  status: ListingLiveness;
  /** The matched marker text (or http status), for diagnosing misfires. */
  marker: string | null;
};

// Withdrawn/expired-listing markers — checked first: a removed listing's
// "similar properties" page often also contains SSTC-ish text.
const REMOVED_MARKERS: RegExp[] = [
  /property\s+has\s+been\s+removed/i,
  /listing\s+(?:has\s+been\s+removed|is\s+no\s+longer\s+available)/i,
  /no\s+longer\s+(?:available|on\s+the\s+market)/i,
  /couldn.t\s+find\s+(?:the|that)\s+property/i,
];

// Under-offer markers, covering both human-readable page text ("Sold STC")
// and machine tokens in embedded state JSON ("sold_stc" / "sold-stc").
const SSTC_MARKERS: RegExp[] = [
  /sold\s+stc\b/i,
  /sold\s+subject\s+to\s+contract/i,
  /sold[-_]stc/i,
  /\bunder\s+offer\b/i,
  /\bsale\s+agreed\b/i,
];

/** Pure classifier over listing-page HTML — exported for tests. */
export function classifyListingHtml(html: string): ListingCheck {
  for (const re of REMOVED_MARKERS) {
    const m = html.match(re);
    if (m) return { status: 'removed', marker: m[0] };
  }
  for (const re of SSTC_MARKERS) {
    const m = html.match(re);
    if (m) return { status: 'sstc', marker: m[0] };
  }
  return { status: 'live', marker: null };
}

/**
 * Fetch a listing URL and classify whether it is still live. Never throws;
 * anything other than a confident dead-listing signal returns 'unknown'.
 */
export async function checkListingLiveness(url: string): Promise<ListingCheck> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { status: 'unknown', marker: null };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { status: 'unknown', marker: null };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    // A hard 404/410 on a listing URL is the one non-marker signal we trust:
    // portals serve it once a listing is fully withdrawn.
    if (res.status === 404 || res.status === 410) {
      return { status: 'removed', marker: `http_${res.status}` };
    }
    if (!res.ok) {
      return { status: 'unknown', marker: null };
    }
    const html = await res.text();
    return classifyListingHtml(html);
  } catch {
    return { status: 'unknown', marker: null };
  } finally {
    clearTimeout(timer);
  }
}
