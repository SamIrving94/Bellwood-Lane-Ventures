import { getPublicOrigin } from 'mcp-handler';

/** Scopes are roles: one per kind of professional the Pro plugin serves. */
export const SCOPES = ['agent', 'investor'] as const;
export type Scope = (typeof SCOPES)[number];

export const PRO_MCP_PATH = '/pro/mcp';
export const PROTECTED_RESOURCE_METADATA_PATH = `/.well-known/oauth-protected-resource${PRO_MCP_PATH}`;

export const TTL = {
  authRequest: 15 * 60,
  otp: 10 * 60,
  code: 2 * 60,
  access: 60 * 60,
  refresh: 30 * 24 * 60 * 60,
  client: 10 * 365 * 24 * 60 * 60,
} as const;

/** Wrong-code attempts allowed per emailed code. */
export const OTP_MAX_ATTEMPTS = 5;

/**
 * The public origin. PLUGIN_PUBLIC_URL pins it in production so the issuer
 * never depends on request headers; otherwise it comes from the proxy
 * headers (local dev, previews).
 */
export function issuer(req: Request): string {
  const pinned = process.env.PLUGIN_PUBLIC_URL?.trim().replace(/\/$/, '');
  return pinned || getPublicOrigin(req);
}

export function resourceUrl(req: Request): string {
  return `${issuer(req)}${PRO_MCP_PATH}`;
}

export function authorizationServerMetadata(req: Request) {
  const iss = issuer(req);
  return {
    issuer: iss,
    authorization_endpoint: `${iss}/oauth/authorize`,
    token_endpoint: `${iss}/oauth/token`,
    registration_endpoint: `${iss}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [...SCOPES],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
    service_documentation: 'https://wearekept.co.uk',
  };
}
