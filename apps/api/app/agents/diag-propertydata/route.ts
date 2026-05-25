import { NextResponse } from 'next/server';
import { getSourcedPropertiesMulti } from '@repo/property-data/src/propertydata';
import { validateAgentAuth, unauthorizedResponse } from '../_lib/auth';

export const maxDuration = 60;
export const runtime = 'nodejs';

/**
 * GET /agents/diag-propertydata?postcode=M14+5LL&radius=3
 *
 * Runs our actual production wrapper (getSourcedPropertiesMulti) so we
 * verify schema + parsing + throttle all work end-to-end. Returns the
 * normalised SourcedProperty[] our cron will see.
 */
export const GET = async (request: Request) => {
  if (!validateAgentAuth(request)) return unauthorizedResponse();

  const url = new URL(request.url);
  const postcode = url.searchParams.get('postcode') ?? 'M14 5LL';
  const radius = Number(url.searchParams.get('radius') ?? '3');

  const t0 = Date.now();
  const props = await getSourcedPropertiesMulti(postcode, {
    radiusMiles: radius,
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
      price: p.pricePence ? `£${Math.round(p.pricePence / 100).toLocaleString('en-GB')}` : null,
      bedrooms: p.bedrooms,
      type: p.propertyType,
      listingType: p.listingType,
      daysOnMarket: p.daysOnMarket,
      discount: p.discountPercent ? `${p.discountPercent}%` : null,
      summary: p.summary,
      url: p.listingUrl,
    })),
  });
};
