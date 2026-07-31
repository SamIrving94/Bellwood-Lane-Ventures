/**
 * Gazette probate source — request contract + resilience.
 *
 * Two families of test here:
 *
 *  1. REQUEST CONTRACT. The source spent 27–29 Jul 2026 returning
 *     `Gazette list HTTP 500` because it sent `?noticetype=deceased-estates`,
 *     a parameter that does not exist in The Gazette's documented API. These
 *     lock the shape we actually ask for so a bogus filter cannot creep back:
 *     the `wills-and-probate` category path, `noticecode=2903`, documented
 *     pagination params, and NO date filter (see the regression lock below).
 *
 *  2. RESILIENCE + VISIBILITY. Requests carry a descriptive User-Agent (the
 *     gov WAF 5xx's UA-less bots), transient 5xx are retried, and a persistent
 *     LIST failure THROWS so the scouting pipeline records sourceErrors.gazette
 *     and alerts the founder — it must never silently return [].
 *
 * The network is always mocked; these must never touch the live endpoint.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchGazetteProbateNotices } from '../gazette';
import listPage from './fixtures/gazette-list-page.json';
import noticeDetail from './fixtures/gazette-notice-detail.json';

function jsonResponse(
  status: number,
  body: unknown,
  headers?: Record<string, string>
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (k: string) => headers?.[k.toLowerCase()] ?? null,
    },
    json: async () => body,
  } as unknown as Response;
}

/** Deep clone so a test mutating a fixture can't leak into the next one. */
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const isListUrl = (url: string) => url.includes('/notice/data.json?');
const isDetailUrl = (url: string) => /\/notice\/[^/]+\/data\.json/.test(url);

/** The list fixture carries a rel="next"; strip it to mark a terminal page. */
function withoutNextLink(
  page: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...page,
    link: (page.link as Record<string, string>[]).filter(
      (l) => l['@rel'] !== 'next'
    ),
  };
}

/**
 * Route mock: serves the list fixture for list URLs and the detail fixture for
 * per-notice URLs, which is the minimum needed to exercise the happy path.
 *
 * The default list page is TERMINAL (no rel="next"), so tests assert on a
 * single page of two notices unless they explicitly opt into pagination.
 */
function routedFetch(
  opts: {
    list?: (url: string, page: number) => Response;
    detail?: (url: string, id: string) => Response;
  } = {}
) {
  return vi.fn(async (url: string) => {
    if (isListUrl(url)) {
      const page = Number(new URL(url).searchParams.get('results-page') ?? '1');
      return (
        opts.list?.(url, page) ??
        jsonResponse(200, withoutNextLink(clone(listPage)))
      );
    }
    if (isDetailUrl(url)) {
      const id = url.match(/\/notice\/([^/]+)\/data\.json/)?.[1] ?? '';
      return opts.detail?.(url, id) ?? jsonResponse(200, clone(noticeDetail));
    }
    throw new Error(`unexpected URL ${url}`);
  });
}

/** All list URLs the mock was asked for, in order. */
function listUrls(mock: ReturnType<typeof vi.fn>): string[] {
  return mock.mock.calls.map((c) => c[0] as string).filter(isListUrl);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// 1. Request contract
// ---------------------------------------------------------------------------

describe('fetchGazetteProbateNotices — request contract', () => {
  it('requests the wills-and-probate feed with noticecode 2903', async () => {
    const fetchMock = routedFetch();
    vi.stubGlobal('fetch', fetchMock);

    await fetchGazetteProbateNotices(30, 10);

    const url = new URL(listUrls(fetchMock)[0] as string);
    expect(url.origin).toBe('https://www.thegazette.co.uk');
    expect(url.pathname).toBe('/wills-and-probate/notice/data.json');
    expect(url.searchParams.get('noticecode')).toBe('2903');
  });

  it('never sends the bogus `noticetype` parameter that caused the HTTP 500', async () => {
    const fetchMock = routedFetch();
    vi.stubGlobal('fetch', fetchMock);

    await fetchGazetteProbateNotices(30, 10);

    for (const url of listUrls(fetchMock)) {
      expect(url).not.toContain('noticetype');
      expect(url).not.toContain('deceased-estates');
    }
  });

  it('sends documented pagination params', async () => {
    const fetchMock = routedFetch();
    vi.stubGlobal('fetch', fetchMock);

    await fetchGazetteProbateNotices(30, 25);

    const url = new URL(listUrls(fetchMock)[0] as string);
    expect(url.searchParams.get('results-page')).toBe('1');
    expect(url.searchParams.get('results-page-size')).toBe('25');
  });

  it('NEVER sends start-publish-date — the parameter that caused the second 500', async () => {
    // Regression lock. `start-publish-date` is documented, was added as a
    // detail-fetch optimisation, and could not be tested from CI (no egress).
    // Production then observed, same host and day:
    //   ...&results-page-size=10                                  -> 200
    //   ...&results-page-size=30&start-publish-date=2026-06-30     -> 500
    // Same failure mode as the `noticetype` parameter it replaced. The feed is
    // sorted newest-first, so the optimisation bought almost nothing; the
    // client-side cutoff still bounds the window.
    const fetchMock = routedFetch();
    vi.stubGlobal('fetch', fetchMock);

    await fetchGazetteProbateNotices(30, 25);

    for (const raw of listUrls(fetchMock)) {
      const url = new URL(raw as string);
      expect(url.searchParams.get('start-publish-date')).toBeNull();
      expect(url.searchParams.get('end-publish-date')).toBeNull();
      // The parameter from the FIRST outage must stay gone too.
      expect(url.searchParams.get('noticetype')).toBeNull();
    }
  });

  it('caps results-page-size at the documented maximum of 100', async () => {
    const fetchMock = routedFetch();
    vi.stubGlobal('fetch', fetchMock);

    await fetchGazetteProbateNotices(30, 5000);

    const url = new URL(listUrls(fetchMock)[0] as string);
    expect(url.searchParams.get('results-page-size')).toBe('100');
  });

  it('falls back to the all-notices feed when the category feed fails', async () => {
    const fetchMock = routedFetch({
      list: (url) =>
        url.includes('/wills-and-probate/')
          ? jsonResponse(500, null)
          : jsonResponse(200, clone(listPage)),
    });
    vi.stubGlobal('fetch', fetchMock);

    const leads = await fetchGazetteProbateNotices(3650, 1);

    expect(leads).toHaveLength(1);
    const urls = listUrls(fetchMock);
    expect(urls.some((u) => u.includes('/all-notices/notice/data.json'))).toBe(
      true
    );
    // The fallback is still the documented filter, not a bare unfiltered feed.
    const fallback = new URL(
      urls.find((u) => u.includes('/all-notices/')) as string
    );
    expect(fallback.searchParams.get('noticecode')).toBe('2903');
  }, 20_000);

  it('fetches the per-notice linked-data view for the address', async () => {
    const fetchMock = routedFetch();
    vi.stubGlobal('fetch', fetchMock);

    await fetchGazetteProbateNotices(3650, 10);

    const detailUrls = fetchMock.mock.calls
      .map((c) => c[0] as string)
      .filter((u) => !isListUrl(u));
    expect(detailUrls.length).toBeGreaterThan(0);
    for (const u of detailUrls) {
      expect(u).toContain('view=linked-data');
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Parsing — real probate notices must actually become leads
// ---------------------------------------------------------------------------

describe('fetchGazetteProbateNotices — parsing', () => {
  it('turns a deceased-estate notice into a ProbateLead with address + postcode', async () => {
    vi.stubGlobal('fetch', routedFetch());

    // Wide window so the fixture's publication date can never age out.
    const leads = await fetchGazetteProbateNotices(3650, 1);

    expect(leads).toHaveLength(1);
    const lead = leads[0];
    expect(lead?.source).toBe('gazette');
    expect(lead?.probateRef).toBe('gazette-4890400');
    expect(lead?.postcode).toBe('CV6 1NJ');
    expect(lead?.address).toBe('5 Hewitt Avenue, Coundon, Coventry');
    expect(lead?.executorName).toBe("O'HANLON David William");
    expect(lead?.solicitorFirm).toBe(
      'Alsters Kelley LLP, 8 Butts, Coventry, CV1 3GJ'
    );
    expect(lead?.grantType).toBe('probate');
  });

  it('follows non-numeric Edinburgh/Belfast notice ids (E-25991-2455-105)', async () => {
    const fetchMock = routedFetch();
    vi.stubGlobal('fetch', fetchMock);

    await fetchGazetteProbateNotices(3650, 50);

    const detailUrls = fetchMock.mock.calls
      .map((c) => c[0] as string)
      .filter((u) => !isListUrl(u));
    expect(detailUrls.some((u) => u.includes('E-25991-2455-105'))).toBe(true);
  });

  it('drops non-deceased-estate notices (e.g. insolvency) rather than emitting them', async () => {
    const insolvency = {
      result: {
        primaryTopic: {
          type: [
            'https://www.thegazette.co.uk/def/legislation/corporate-insolvency',
          ],
          hasNoticeID: '999',
          hasPublicationDate: 'Wednesday, 22-Jul-2026 09:00:02 UTC',
          isAbout: {
            type: ['corporate-insolvency'],
            postcode: [{ label: 'CV6 1NJ' }],
            person: {
              name: 'ACME LTD',
              hasPersonDetails: 'of 1 Test Road, Coventry, CV6 1NJ',
            },
          },
        },
      },
    };
    vi.stubGlobal(
      'fetch',
      routedFetch({ detail: () => jsonResponse(200, insolvency) })
    );

    const leads = await fetchGazetteProbateNotices(3650, 50);

    expect(leads).toEqual([]);
  });

  it('returns partial results when an individual notice detail fails', async () => {
    // First notice 500s; the second must still come through.
    vi.stubGlobal(
      'fetch',
      routedFetch({
        detail: (_url, id) =>
          id === '4890400'
            ? jsonResponse(500, null)
            : jsonResponse(200, clone(noticeDetail)),
      })
    );

    const leads = await fetchGazetteProbateNotices(3650, 50);

    expect(leads).toHaveLength(1);
  }, 20_000);

  it('excludes notices published before the sinceDays cutoff', async () => {
    const stale = clone(noticeDetail);
    stale.result.primaryTopic.hasPublicationDate =
      'Monday, 06-Jan-2020 09:00:02 UTC';
    vi.stubGlobal(
      'fetch',
      routedFetch({ detail: () => jsonResponse(200, stale) })
    );

    const leads = await fetchGazetteProbateNotices(30, 50);

    expect(leads).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. Pagination
// ---------------------------------------------------------------------------

describe('fetchGazetteProbateNotices — pagination', () => {
  it('follows the HATEOAS rel="next" link when more leads are needed', async () => {
    const fetchMock = routedFetch({
      list: (_url, page) => {
        const body = clone(listPage) as Record<string, unknown>;
        // Page 2 is the last page — drop the `next` link.
        if (page >= 2) {
          body.link = (body.link as Record<string, string>[]).filter(
            (l) => l['@rel'] !== 'next'
          );
        }
        return jsonResponse(200, body);
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchGazetteProbateNotices(3650, 50);

    const pages = listUrls(fetchMock).map((u) =>
      new URL(u).searchParams.get('results-page')
    );
    expect(pages).toContain('1');
    expect(pages).toContain('2');
  }, 20_000);

  it('stops paging once `limit` leads are collected', async () => {
    const fetchMock = routedFetch();
    vi.stubGlobal('fetch', fetchMock);

    const leads = await fetchGazetteProbateNotices(3650, 1);

    expect(leads).toHaveLength(1);
    // One list page only — we had enough after the first detail.
    expect(listUrls(fetchMock)).toHaveLength(1);
  });

  it('stops when the feed reports no next page', async () => {
    const fetchMock = routedFetch();
    vi.stubGlobal('fetch', fetchMock);

    await fetchGazetteProbateNotices(3650, 50);

    expect(listUrls(fetchMock)).toHaveLength(1);
  }, 20_000);
});

// ---------------------------------------------------------------------------
// 4. Resilience + visibility (the load-bearing contract)
// ---------------------------------------------------------------------------

describe('fetchGazetteProbateNotices — resilience', () => {
  it('sends a descriptive User-Agent on the list request', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { entry: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchGazetteProbateNotices(30, 10);

    expect(fetchMock).toHaveBeenCalled();
    const firstCall = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const headers = firstCall[1].headers as Record<string, string>;
    expect(headers['User-Agent']).toMatch(/Bellwood/i);
  });

  it('retries a transient 5xx and then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, null))
      .mockResolvedValueOnce(jsonResponse(200, { entry: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const leads = await fetchGazetteProbateNotices(30, 10);

    expect(leads).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a 429 and honours Retry-After', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, null, { 'retry-after': '1' }))
      .mockResolvedValueOnce(jsonResponse(200, { entry: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const leads = await fetchGazetteProbateNotices(30, 10);

    expect(leads).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry a 4xx — that is our bug, not theirs', async () => {
    // 400 on both feed shapes: 1 attempt each, no retries.
    const fetchMock = vi.fn(async () => jsonResponse(400, null));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchGazetteProbateNotices(30, 10)).rejects.toThrow(
      /HTTP 400/
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('THROWS on a persistent list HTTP failure (never silently returns [])', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(500, null));
    vi.stubGlobal('fetch', fetchMock);

    // Must reject — a source that swallows its error becomes invisible to the
    // pipeline's health reporting. This is the single most important assertion
    // in this file.
    await expect(fetchGazetteProbateNotices(30, 10)).rejects.toThrow(
      /HTTP 500/
    );
    // 3 attempts per feed shape x 2 documented shapes. (Was 3 before the
    // all-notices fallback existed.)
    expect(fetchMock).toHaveBeenCalledTimes(6);
  }, 20_000);

  it('THROWS on a persistent network error', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchGazetteProbateNotices(30, 10)).rejects.toThrow(
      /ECONNRESET/
    );
    expect(fetchMock).toHaveBeenCalledTimes(6);
  }, 20_000);

  it('THROWS on a non-JSON body rather than treating it as zero notices', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, null));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchGazetteProbateNotices(30, 10)).rejects.toThrow(
      /non-JSON/
    );
  });

  it('names every feed shape it tried in the thrown error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(500, null))
    );

    await expect(fetchGazetteProbateNotices(30, 10)).rejects.toThrow(
      /wills-and-probate.*all-notices/s
    );
  }, 20_000);

  it('returns [] (without throwing) when the feed legitimately has no notices', async () => {
    // An empty feed is a valid answer, not a failure — only transport/shape
    // failures may throw, otherwise every quiet day would page the founder.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(200, { entry: [], link: [] }))
    );

    await expect(fetchGazetteProbateNotices(30, 10)).resolves.toEqual([]);
  });
});
