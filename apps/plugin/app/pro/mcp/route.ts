/**
 * Pro plugin endpoint (partner agents and investors), OAuth 2.1 protected.
 * Unauthenticated calls get a 401 whose WWW-Authenticate header points at
 * the protected resource metadata, which is how ChatGPT discovers the
 * sign-in flow (lib/oauth/flow.ts).
 */

import {
  PROTECTED_RESOURCE_METADATA_PATH,
  resourceUrl,
} from '@/lib/oauth/config';
import { verifyAccessToken } from '@/lib/oauth/flow';
import { registerProPlugin } from '@/lib/pro-tools';
import { SERVER_INSTRUCTIONS } from '@/lib/server-info';
import { createMcpHandler, withMcpAuth } from 'mcp-handler';

export const maxDuration = 60;

const handler = createMcpHandler(
  (server) => {
    registerProPlugin(server);
  },
  {
    serverInfo: { name: 'kept-pro', version: '1.0.0' },
    instructions: `${SERVER_INSTRUCTIONS} These tools are for Kept partner estate agents and syndicate investors only.`,
  }
);

const authed = withMcpAuth(
  handler,
  (req, bearer) => {
    const claims = verifyAccessToken(bearer, resourceUrl(req));
    if (!claims) return undefined;
    return {
      token: bearer as string,
      clientId: claims.client_id,
      scopes: claims.scope,
      expiresAt: claims.exp,
      resource: new URL(claims.aud),
      extra: { email: claims.sub },
    };
  },
  {
    required: true,
    resourceMetadataPath: PROTECTED_RESOURCE_METADATA_PATH,
    // Pin the public origin in production so the 401's metadata pointer
    // never depends on request headers (matches lib/oauth/config issuer).
    resourceUrl: process.env.PLUGIN_PUBLIC_URL?.trim() || undefined,
  }
);

export { authed as GET, authed as POST, authed as DELETE };
