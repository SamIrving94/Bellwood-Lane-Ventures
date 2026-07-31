// Server-side OS Places proxy. Keeps the API key off the client.
//
//   GET /api/os-places?mode=postcode&q=M14+5BQ
//   GET /api/os-places?mode=find&q=12+Crescent+Road,+Manchester
//
// Wraps the existing @repo/property-data helpers so the env-key handling
// stays in one place.

import {
  LIMITS,
  checkRateLimit,
  clientIp,
  retryAfterSeconds,
} from '@/lib/rate-limit';
import { lookupByPostcode, resolveAddress } from '@repo/property-data';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
// Postcode lookups are stable; "find" is more dynamic. Cache headers
// also set on the OS Places HTTP fetch inside the helper.
export const revalidate = 300;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode');
  const q = searchParams.get('q');

  if (!q || q.trim().length < 2 || q.length > 200) {
    return NextResponse.json({ results: [] });
  }

  // The OS Places key is metered. Unthrottled, a bot burns the monthly quota
  // in hours and takes address lookup down mid-campaign.
  const ip = clientIp(request) ?? 'anonymous';
  const limit = await checkRateLimit(LIMITS.osPlacesByIp, `ip:${ip}`);
  if (!limit.ok) {
    return NextResponse.json(
      { results: [], error: 'Too many lookups. Please slow down.' },
      {
        status: 429,
        headers: { 'Retry-After': retryAfterSeconds(limit.resetAt) },
      }
    );
  }
  if (mode !== 'postcode' && mode !== 'find') {
    return NextResponse.json(
      { error: 'mode must be "postcode" or "find"' },
      { status: 400 }
    );
  }

  try {
    if (mode === 'postcode') {
      const results = await lookupByPostcode(q);
      return NextResponse.json({ results });
    }
    const result = await resolveAddress(q);
    return NextResponse.json({ results: [result] });
  } catch (err) {
    console.warn('[os-places] lookup failed', err);
    return NextResponse.json({ results: [] });
  }
}
