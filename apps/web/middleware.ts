import { internationalizationMiddleware } from '@repo/internationalization/middleware';
import {
  noseconeMiddleware,
  noseconeOptions,
} from '@repo/security/middleware';
import { type NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: ['/((?!_next/static|_next/image|ingest|favicon.ico).*)'],
};

const securityHeaders = noseconeMiddleware(noseconeOptions);

export default async function middleware(request: NextRequest) {
  const i18nResponse = internationalizationMiddleware(request);
  if (i18nResponse) {
    return i18nResponse;
  }
  return securityHeaders() ?? NextResponse.next();
}
