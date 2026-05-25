import { NextResponse } from 'next/server';
import { validateAgentAuth, unauthorizedResponse } from '../_lib/auth';

/**
 * GET /agents/diag-propertydata?postcode=M14+5LL
 *
 * Aggressive forensic probe — hits ~50 candidate PropertyData endpoints
 * with throttling. Returns which exist, which return data, and which 4xx.
 */
const API_BASE = 'https://api.propertydata.co.uk';

async function probe(
  apiKey: string,
  method: 'GET' | 'POST',
  endpoint: string,
  params: Record<string, string>,
): Promise<{
  ep: string;
  method: string;
  params: Record<string, string>;
  http: number | null;
  apiCode: string | null;
  apiMsg: string | null;
  resultKeys: string[] | null;
  arrayCount: number | null;
  err: string | null;
}> {
  const url = new URL(`${API_BASE}${endpoint}`);
  url.searchParams.set('key', apiKey);
  if (method === 'GET') {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  try {
    const init: RequestInit = {
      method,
      headers: { Accept: 'application/json' },
    };
    if (method === 'POST') {
      init.headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };
      init.body = JSON.stringify(params);
    }
    const res = await fetch(url.toString(), init);
    const body = (await res.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const result = body?.result as Record<string, unknown> | undefined;
    let arrayCount: number | null = null;
    if (result) {
      for (const v of Object.values(result)) {
        if (Array.isArray(v)) {
          arrayCount = v.length;
          break;
        }
      }
    }
    return {
      ep: endpoint,
      method,
      params,
      http: res.status,
      apiCode: (body?.code as string | undefined) ?? null,
      apiMsg: (body?.message as string | undefined) ?? null,
      resultKeys: result ? Object.keys(result) : null,
      arrayCount,
      err: null,
    };
  } catch (err) {
    return {
      ep: endpoint,
      method,
      params,
      http: null,
      apiCode: null,
      apiMsg: null,
      resultKeys: null,
      arrayCount: null,
      err: (err as Error).message,
    };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const GET = async (request: Request) => {
  if (!validateAgentAuth(request)) return unauthorizedResponse();

  const apiKey = process.env.PROPERTYDATA_API_KEY ?? '';
  if (!apiKey)
    return NextResponse.json({ error: 'no key' }, { status: 500 });

  const url = new URL(request.url);
  const postcode = url.searchParams.get('postcode') ?? 'M14 5LL';
  const compact = postcode.replace(/\s/g, '');
  const DELAY = 2700;
  const results: unknown[] = [];

  // ── 1. /sourced-properties — try alternate parameter shapes ────────
  // The literal `list` value being rejected suggests either (a) wrong
  // param name or (b) wrong value. Probe both axes.
  const sourcedTries: Array<{ method: 'GET' | 'POST'; params: Record<string, string> }> = [
    { method: 'GET', params: { postcode: compact, type: 'repossession' } },
    { method: 'GET', params: { postcode: compact, category: 'repossession' } },
    { method: 'GET', params: { postcode: compact, filter: 'repossession' } },
    { method: 'GET', params: { postcode: compact, lists: 'repossession' } },
    { method: 'POST', params: { postcode: compact, list: 'repossession' } },
    { method: 'GET', params: { postcode: compact, list: 'rep' } },
    { method: 'GET', params: { postcode: compact, list: 'p' } },
    { method: 'GET', params: { postcode: compact, list: 'short' } },
    { method: 'GET', params: { postcode: compact, list: 'normal' } },
    { method: 'GET', params: { postcode: compact, list: 'main' } },
  ];
  for (const t of sourcedTries) {
    results.push(await probe(apiKey, t.method, '/sourced-properties', t.params));
    await sleep(DELAY);
  }

  // ── 2. Probe lots of candidate endpoint names with just postcode ───
  const candidateEndpoints = [
    '/properties',
    '/property',
    '/sale',
    '/sales',
    '/sourced',
    '/lists',
    '/list',
    '/auction',
    '/auctions',
    '/repossessions',
    '/probates',
    '/probate',
    '/planning-applications',
    '/planning',
    '/rents',
    '/yields',
    '/demand-rent',
    '/local-hpi',
    '/national-hpi',
    '/growth',
    '/crime',
    '/schools',
    '/household-income',
    '/population',
    '/council-tax',
    '/area-info',
    '/agents-by-area',
    '/developments',
    '/property-articles',
    '/sourced-criteria',
    '/sourcing-criteria',
    '/prices-per-sqf',
    '/sold-prices-per-sqf',
    '/properties-rented',
    '/rented',
    '/short-let',
    '/buy-to-let',
    '/btl',
    '/postcode',
    '/postcode-info',
  ];
  for (const ep of candidateEndpoints) {
    results.push(await probe(apiKey, 'GET', ep, { postcode: compact }));
    await sleep(DELAY);
  }

  return NextResponse.json({
    ok: true,
    postcode,
    note: `Throttle: ${DELAY}ms between calls. Total: ${results.length} probes.`,
    results,
  });
};
