import type { NextRequest } from 'next/server';
import { getFlags } from '@repo/feature-flags/access';

// Wrapper to satisfy Next.js 15.5's RouteHandlerConfig signature.
export async function GET(request: NextRequest) {
  return getFlags(request);
}
