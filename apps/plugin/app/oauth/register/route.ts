import { registerClient } from '@/lib/oauth/clients';

/** RFC 7591 dynamic client registration (stateless; see lib/oauth/clients). */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const result = registerClient(body);
  if (!result.ok) {
    return Response.json(
      { error: result.error, error_description: result.description },
      { status: 400 }
    );
  }
  return Response.json(
    {
      client_id: result.client.clientId,
      client_id_issued_at: result.clientIdIssuedAt,
      client_name: result.client.clientName,
      redirect_uris: result.client.redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    },
    { status: 201, headers: { 'cache-control': 'no-store' } }
  );
}
