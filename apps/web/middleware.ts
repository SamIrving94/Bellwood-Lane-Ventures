import { noseconeMiddleware, noseconeOptions } from '@repo/security/middleware';
import type { NextRequest } from 'next/server';

/**
 * Security headers for the public site.
 *
 * apps/web previously shipped no middleware at all, so pages carrying a seller's
 * address and offer figure (/track/[token], /instant-offer/offer/[id]) could be
 * framed by any origin — the setup for clickjacking or an overlay phishing page
 * on a domain the seller has been told to trust.
 *
 * CSP stays off (the nosecone default) because the public site loads Google
 * Fonts and inline styles; turning it on needs its own pass with the report-only
 * header first, so it is not bundled into a launch-hardening change.
 */
const siteHeaders = noseconeMiddleware({
  ...noseconeOptions,
  xFrameOptions: true,
});

/**
 * One exception: /guides/preview/* is framed by the founder dashboard
 * (apps/app /marketing/guides/[id]) so a draft guide can be read as the
 * real page before it is approved. Only the dashboard's own origin may
 * frame it (CSP frame-ancestors; X-Frame-Options can't name an origin, so
 * it is dropped here). The dashboard sends Cross-Origin-Embedder-Policy:
 * require-corp, so the page must also say it may be loaded cross-origin.
 * The page holds no seller data and has nothing to click that changes
 * anything, so there is nothing to clickjack.
 */
const previewHeaders = noseconeMiddleware({
  ...noseconeOptions,
  xFrameOptions: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

const dashboardOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? '').origin;
  } catch {
    return null;
  }
})();

export async function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/guides/preview/')) {
    return siteHeaders();
  }
  const response = await previewHeaders();
  response.headers.set(
    'Content-Security-Policy',
    `frame-ancestors 'self'${dashboardOrigin ? ` ${dashboardOrigin}` : ''}`
  );
  return response;
}

export const config = {
  // Skip Next internals and static files; headers matter on documents and API
  // responses, not on hashed assets.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?)$).*)',
  ],
};
