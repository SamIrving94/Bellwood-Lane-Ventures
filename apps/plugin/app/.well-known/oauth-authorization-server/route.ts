import { authorizationServerMetadata } from '@/lib/oauth/config';

/** RFC 8414 authorization server metadata for the Pro plugin. */
export function GET(req: Request) {
  return Response.json(authorizationServerMetadata(req), {
    headers: { 'cache-control': 'public, max-age=300' },
  });
}
