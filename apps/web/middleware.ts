import { noseconeMiddleware, noseconeOptions } from '@repo/security/middleware';

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
export const middleware = noseconeMiddleware({
  ...noseconeOptions,
  xFrameOptions: true,
});

export const config = {
  // Skip Next internals and static files; headers matter on documents and API
  // responses, not on hashed assets.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?)$).*)',
  ],
};
