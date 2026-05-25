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

  // 2. /sourced-properties with various list values
  for (const list of ['repossession', 'belowmarketvalue', 'auction', 'probate']) {
    results.push(
      await probe(apiKey, '/sourced-properties', {
        postcode: compact,
        list,
        radius,
      }),
    );
    await sleep(DELAY);
  }

  // 3. Plural variants of the endpoint name
  results.push(
    await probe(apiKey, '/properties-listed', { postcode: compact, radius }),
  );
  await sleep(DELAY);
  results.push(
    await probe(apiKey, '/properties-for-sale', { postcode: compact, radius }),
  );
  await sleep(DELAY);
  results.push(
    await probe(apiKey, '/listings', { postcode: compact, radius }),
  );
  await sleep(DELAY);

  // 4. Other endpoints we know work — sanity checks
  results.push(
    await probe(apiKey, '/prices', { postcode: compact }),
  );
  await sleep(DELAY);
  results.push(
    await probe(apiKey, '/demand', { postcode: compact }),
  );

  return NextResponse.json({
    ok: true,
    postcode,
    radius,
    note: 'Each probe waits 2.7s after the previous to avoid PropertyData rate limit (4 calls / 10s)',
    results,
  });
};
