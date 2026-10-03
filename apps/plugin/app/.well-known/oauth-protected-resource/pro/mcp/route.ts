import { SCOPES, issuer, resourceUrl } from '@/lib/oauth/config';
import { generateProtectedResourceMetadata } from 'mcp-handler';

/** RFC 9728 protected resource metadata for /pro/mcp. */
export function GET(req: Request) {
  return Response.json(
    generateProtectedResourceMetadata({
      authServerUrls: [issuer(req)],
      resourceUrl: resourceUrl(req),
      additionalMetadata: {
        scopes_supported: [...SCOPES],
        resource_name: 'Kept for partner agents and investors',
      },
    }),
    { headers: { 'cache-control': 'public, max-age=300' } }
  );
}
