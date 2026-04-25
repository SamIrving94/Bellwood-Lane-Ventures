// Server-side OS Places proxy. Keeps the API key off the client.
//
//   GET /api/os-places?mode=postcode&q=M14+5BQ
//   GET /api/os-places?mode=find&q=12+Crescent+Road,+Manchester
//
// Wraps the existing @repo/property-data helpers so the env-key handling
// stays in one place.

import { NextResponse } from 'next/server';
import { lookupByPostcode, resolveAddress } from '@repo/property-data';

export const runtime = 'nodejs';
// Postcode lookups are stable; "find" is more dynamic. Cache headers
// also set on the OS Places HTTP fetch inside the helper.
export const revalidate = 300;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode');
  const q = searchParams.get('q');

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }
  if (mode !== 'postcode' && mode !== 'find') {
    return NextResponse.json(
      { error: 'mode must be "postcode" or "find"' },
      { status: 400 },
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
