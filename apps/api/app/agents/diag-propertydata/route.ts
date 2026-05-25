import { NextResponse } from 'next/server';
import { validateAgentAuth, unauthorizedResponse } from '../_lib/auth';

/**
 * GET /agents/diag-propertydata?postcode=M14+5LL&radius=2
 *
 * Raw forensic probe — hits PropertyData endpoints directly (no wrapper)
 * with throttling to avoid rate limits. Returns the actual HTTP response
 * + body for each endpoint so we can see what THIS PropertyData account
 * actually supports.
 */
const API_BASE = 'https://api.propertydata.co.uk';

async function probe(
  apiKey: string,
  endpoint: string,
  params: Record<string, string>,
): Promise<{
  endpoint: string;
  params: Record<string, string>;
  httpStatus: number | null;
  apiStatus: string | null;
  apiCode: string | null;
  apiMessage: string | null;
  resultKeys: string[] | null;
  resultCount: number | null;
  rawSample: unknown;
  error: string | null;
}> {
  const url = new URL(`${API_BASE}${endpoint}`);
  url.searchParams.set('key', apiKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });
    const body = (await res.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const result = body?.result as Record<string, unknown> | undefined;
    const resultKeys = result ? Object.keys(result) : null;
    // Try to find an array length anywhere in the result
    let resultCount: number | null = null;
    if (result) {
      for (const v of Object.values(result)) {
        if (Array.isArray(v)) {
          resultCount = v.length;
          break;
        }
      }
    }
    // Trim raw sample to first 600 chars
    const rawSample =
      body && JSON.stringify(body).length < 800
        ? body
        : JSON.stringify(body).slice(0, 600);
    return {
      endpoint,
      params,
      httpStatus: res.status,
      apiStatus: (body?.status as string | undefined) ?? null,
      apiCode: (body?.code as string | undefined) ?? null,
      apiMessage: (body?.message as string | undefined) ?? null,
      resultKeys,
      resultCount,
      rawSample,
      error: null,
    };
  } catch (err) {
    return {
      endpoint,
      params,
      httpStatus: null,
      apiStatus: null,
      apiCode: null,
      apiMessage: null,
      resultKeys: null,
      resultCount: null,
      rawSample: null,
      error: (err as Error).message,
    };
  }
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const GET = async (request: Request) => {
  if (!validateAgentAuth(request)) return unauthorizedResponse();

  const apiKey = process.env.PROPERTYDATA_API_KEY ?? '';
  if (!apiKey) {
    return NextResponse.json(
      { error: 'PROPERTYDATA_API_KEY missing on server' },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const postcode = url.searchParams.get('postcode') ?? 'M14 5LL';
  const radius = url.searchParams.get('radius') ?? '2';
  const compact = postcode.replace(/\s/g, '');

  // Throttle: max 4 calls per 10s → 1 call per 2.5s minimum.
  // Use 2700ms to be safe.
  const DELAY = 2700;

  const results: unknown[] = [];

  // 1. Account credits — proves key works
  results.push(await probe(apiKey, '/account/credits', {}));
  await sleep(DELAY);

  // 2. /sourced-properties — try several value formats to find what works
  // (Spec docs may use different casing or different identifiers per tier.)
  const sourcedAttempts: Array<Record<string, string>> = [
    { list: 'repos' },
    { list: 'repo' },
    { list: 'auction-listings' },
    { list: 'sale-listings' },
    { list: 'distressed' },
    { list: 'all' },
  ];
  for (const extra of sourcedAttempts) {
    results.push(
      await probe(apiKey, '/sourced-properties', {
        postcode: compact,
        ...extra,
        radius,
      }),
    );
    await sleep(DELAY);
  }

  // 3. Other endpoint name candidates
  for (const ep of [
    '/sourced-property',
    '/property-list',
    '/property-listings',
    '/residential-properties',
    '/properties-sold',
    '/sold-prices',
    '/auction-listings',
    '/sale-listings',
    '/distressed-properties',
    '/property-info',
  ]) {
    results.push(await probe(apiKey, ep, { postcode: compact }));
    await sleep(DELAY);
  }

  return NextResponse.json({
    ok: true,
    postcode,
    radius,
    note: 'Each probe waits 2.7s after the previous to avoid PropertyData rate limit (4 calls / 10s)',
    results,
  });
};
