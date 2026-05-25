import { NextResponse } from 'next/server';
import {
  getActiveListings,
  getSourcedPropertiesRaw,
} from '@repo/property-data/src/propertydata';
import { validateAgentAuth, unauthorizedResponse } from '../_lib/auth';

/**
 * GET /agents/diag-propertydata?postcode=M14+5LL&radius=2
 *
 * Ground-truth probe of PropertyData. Hits /sourced-properties (RAW — bypass
 * cache + schema so we see the API's actual response shape) for EVERY known
 * list type AND /listings, all in parallel.
 *
 * Used to discover which list types this account actually has access to,
 * without guessing.
 */
export const GET = async (request: Request) => {
  if (!validateAgentAuth(request)) return unauthorizedResponse();

  const url = new URL(request.url);
  const postcode = url.searchParams.get('postcode');
  if (!postcode) {
    return NextResponse.json({ error: 'postcode required' }, { status: 400 });
  }
  const radius = Number(url.searchParams.get('radius') ?? '2');

  // Try each list type individually so a single bad value doesn't poison
  // the whole batch.
  const listTypes = [
    'repossession',
    'probate',
    'auction',
    'houseauction',
    'bmv',
    'belowmarketvalue',
    'unmodernised',
    'cashbuyer',
  ];

  const sourcedResults = await Promise.all(
    listTypes.map(async (list) => {
      const r = await getSourcedPropertiesRaw(postcode, {
        radiusMiles: radius,
        list,
      });
      const body = r.body as Record<string, unknown> | null;
      const properties =
        (body?.result as { properties?: unknown[] } | undefined)
          ?.properties ?? null;
      return {
        list,
        httpStatus: r.status,
        apiStatus: (body as { status?: string } | null)?.status,
        apiCode: (body as { code?: string } | null)?.code,
        apiMessage: (body as { message?: string } | null)?.message,
        listingCount: Array.isArray(properties) ? properties.length : null,
        error: r.error ?? null,
      };
    }),
  );

  // /listings probe — no list param, just postcode + radius
  let listingsResult: {
    count: number | null;
    error: string | null;
    sample: unknown[];
  };
  try {
    const listings = await getActiveListings(postcode, {
      radiusMiles: radius,
    });
    const stale = listings.filter(
      (l) => (l.daysOnMarket ?? 0) >= 60,
    );
    listingsResult = {
      count: listings.length,
      error: null,
      sample: listings.slice(0, 3).map((l) => ({
        address: l.address,
        postcode: l.postcode,
        daysOnMarket: l.daysOnMarket,
        pricePence: l.pricePence,
      })),
    };
    return NextResponse.json({
      ok: true,
      postcode,
      radius,
      sourced: sourcedResults,
      listings: {
        total: listings.length,
        stale60d: stale.length,
        sample: listingsResult.sample,
      },
    });
  } catch (err) {
    listingsResult = {
      count: null,
      error: (err as Error).message,
      sample: [],
    };
    return NextResponse.json({
      ok: false,
      postcode,
      radius,
      sourced: sourcedResults,
      listings: listingsResult,
    });
  }
};
