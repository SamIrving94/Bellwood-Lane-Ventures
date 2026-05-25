import { NextResponse } from 'next/server';
import { getSourcedPropertiesMulti } from '@repo/property-data/src/propertydata';
import { validateAgentAuth, unauthorizedResponse } from '../_lib/auth';

export const maxDuration = 60;
export const runtime = 'nodejs';

/**
 * GET /agents/diag-propertydata?postcode=M14+5LL&mode=<mode>
 *
 * mode=sourced  → end-to-end /sourced-properties via our wrapper (default)
 * mode=shapes   → probe planning/titles-by-company/HMO raw to see response shapes
 */
export const GET = async (request: Request) => {
  if (!validateAgentAuth(request)) return unauthorizedResponse();

  const url = new URL(request.url);
  const postcode = url.searchParams.get('postcode') ?? 'M14 5LL';
  const compact = postcode.replace(/\s/g, '');
  const radius = url.searchParams.get('radius') ?? '3';
  const mode = url.searchParams.get('mode') ?? 'sourced';

  if (mode === 'shapes') {
    const apiKey = process.env.PROPERTYDATA_API_KEY ?? '';
    if (!apiKey)
      return NextResponse.json({ error: 'no key' }, { status: 500 });

    const probe = async (ep: string, extraParams: Record<string, string> = {}) => {
      const u = new URL(`https://api.propertydata.co.uk${ep}`);
      u.searchParams.set('key', apiKey);
      u.searchParams.set('postcode', compact);
      for (const [k, v] of Object.entries(extraParams)) u.searchParams.set(k, v);
      try {
        const res = await fetch(u.toString(), {
          headers: { Accept: 'application/json' },
        });
        const body = await res.json().catch(() => null);
        // Walk the body to find array fields and report their names + lengths
        const arrays: Record<string, number> = {};
        const walk = (val: unknown, path: string) => {
          if (Array.isArray(val)) {
            arrays[path] = val.length;
            if (val.length > 0 && val[0] && typeof val[0] === 'object') {
              // Report keys of first array item
              arrays[`${path}[0].keys`] = Object.keys(
                val[0] as Record<string, unknown>,
              ).length;
            }
            return;
          }
          if (val && typeof val === 'object' && !Array.isArray(val)) {
            for (const [k, v] of Object.entries(val)) {
              walk(v, path ? `${path}.${k}` : k);
            }
          }
        };
        if (body) walk(body, '');
        // Capture first item from any array for shape understanding
        const firstItem: Record<string, unknown> = {};
        const captureFirst = (val: unknown, path: string) => {
          if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
            firstItem[path] = val[0];
          } else if (val && typeof val === 'object') {
            for (const [k, v] of Object.entries(val)) {
              captureFirst(v, path ? `${path}.${k}` : k);
            }
          }
        };
        if (body) captureFirst(body, '');
        return {
          ep,
          http: res.status,
          bodyKeys: body ? Object.keys(body) : null,
          arrays,
          firstItemSample: firstItem,
          status: (body as { status?: string } | null)?.status,
          apiMessage: (body as { message?: string } | null)?.message,
        };
      } catch (err) {
        return { ep, http: null, err: (err as Error).message };
      }
    };

    const results = [];
    results.push(await probe('/planning-applications'));
    await new Promise((r) => setTimeout(r, 2700));
    results.push(await probe('/national-hmo-register'));
    await new Promise((r) => setTimeout(r, 2700));
    // titles-by-company needs a company_id, not postcode — probe with placeholder
    results.push(await probe('/titles-by-company', { company_number: '00000000' }));

    return NextResponse.json({ ok: true, postcode, results });
  }

  // Default mode: end-to-end test via our wrapper
  const t0 = Date.now();
  const props = await getSourcedPropertiesMulti(postcode, {
    radiusMiles: Number(radius),
  });
  const elapsedMs = Date.now() - t0;

  const byType = props.reduce<Record<string, number>>((acc, p) => {
    acc[p.listingType] = (acc[p.listingType] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    ok: true,
    postcode,
    radius,
    elapsedMs,
    total: props.length,
    byType,
    sample: props.slice(0, 5).map((p) => ({
      address: p.address,
      postcode: p.postcode,
      price: p.pricePence
        ? `£${Math.round(p.pricePence / 100).toLocaleString('en-GB')}`
        : null,
      listingType: p.listingType,
      daysOnMarket: p.daysOnMarket,
      url: p.listingUrl,
    })),
  });
};
