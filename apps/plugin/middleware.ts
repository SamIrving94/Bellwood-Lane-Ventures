import { type NextRequest, NextResponse } from 'next/server';

/**
 * CORS for the MCP endpoints and the OAuth metadata/token endpoints.
 * ChatGPT calls these server-to-server, but browser-based MCP clients
 * (inspectors, developer tools) need the preflight answered. No cookies are
 * used anywhere on these routes, so a wildcard origin carries no credentials.
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization, Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Mcp-Method, Mcp-Name, Last-Event-ID',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id',
  'Access-Control-Max-Age': '86400',
};

export function middleware(request: NextRequest) {
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }
  const response = NextResponse.next();
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    response.headers.set(k, v);
  }
  return response;
}

export const config = {
  matcher: [
    '/mcp',
    '/pro/mcp',
    '/.well-known/:path*',
    '/oauth/token',
    '/oauth/register',
  ],
};
