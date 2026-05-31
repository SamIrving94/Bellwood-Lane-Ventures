import { authMiddleware } from '@repo/auth/middleware';
import { noseconeMiddleware, noseconeOptions } from '@repo/security/middleware';
import type { NextMiddleware } from 'next/server';

// FLAGS_SECRET / noseconeOptionsWithToolbar removed when @repo/feature-flags
// was culled — the toolbar route no longer exists.
const securityHeaders = noseconeMiddleware(noseconeOptions);

export default authMiddleware(() =>
  securityHeaders()
) as unknown as NextMiddleware;

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
