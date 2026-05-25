import { NextResponse } from 'next/server';
import { validateAgentAuth, unauthorizedResponse } from '../_lib/auth';

export const maxDuration = 60;
export const runtime = 'nodejs';

/**
 * GET /agents/diag-propertydata?postcode=M14+5LL&radius=3
 *
 * Verified against PropertyData's documented sourcing categories.
 * Tries the 12 high-value distressed slugs (the ones that map to
 * Bellwood's wedge: repossession, probate, quick-sale, etc).
 */
const API_BASE = 'https://api.propertydata.co.uk';

/** The 12 PropertyData sourcing lists most relevant to Bellwood. */
const BELLWOOD_LISTS = [
  'repossessed-properties',
  'quick-sale-properties',
  'reduced-properties',
  'slow-to-sell-properties',
  'derelict-properties',
  'unmodernised-properties',
  'back-on-market',
  'properties-with-no-chain',
  'cash-buyers-only-properties',
  'auction-properties',
  'short-lease-properties',
  'poor-epc-score',
] as const;

async function probe(apiKey: string, list: string, postcode: string, radius: string) {
  const url = new URL(`${API_BASE}/sourced-properties`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('postcode', postcode);
  url.searchParams.set('list', list);
  url.searchParams.set('radius', radius);
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const result = body?.result as Record<string, unknown> | undefined;
    const properties = (result?.properties as unknown[] | undefined) ?? null;
    return {
      list,
      http: res.status,
      apiCode: (body?.code as string | undefined) ?? null,
      apiMsg: (body?.message as string | undefined) ?? null,
      resultKeys: result ? Object.keys(result) : null,
      // Try multiple shapes — properties[] is one guess. Could be data[], rows[], items[].
      shapeProbe: {
        propertiesLen: Array.isArray(properties) ? properties.length : null,
        rawResultPreview: result ? JSON.stringify(result).slice(0, 400) : null,
      },
    };
  } catch (err) {
    return {
      list,
      http: null,
      apiCode: null,
      apiMsg: null,
      count: null,
      sample: null,
      error: (err as Error).message,
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
  const postcode = (url.searchParams.get('postcode') ?? 'M14 5LL').replace(/\s/g, '');
  const radius = url.searchParams.get('radius') ?? '3';

  const results = [];
  // Only probe one list value so we can see the full response shape clearly.
  const list = url.searchParams.get('list') ?? 'repossessed-properties';
  const result = await probe(apiKey, list, postcode, radius);
  return NextResponse.json({ ok: true, postcode, radius, list, result });
};
