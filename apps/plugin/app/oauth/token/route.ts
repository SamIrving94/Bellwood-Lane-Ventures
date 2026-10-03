import { exchangeToken } from '@/lib/oauth/flow';

/** RFC 6749 token endpoint: authorization_code (with PKCE) and refresh_token. */
export async function POST(req: Request) {
  const type = req.headers.get('content-type') ?? '';
  let form: URLSearchParams;
  if (type.includes('application/json')) {
    const json = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    form = new URLSearchParams(
      Object.entries(json).map(([k, v]) => [k, String(v)])
    );
  } else {
    form = new URLSearchParams(await req.text());
  }
  let result: Awaited<ReturnType<typeof exchangeToken>>;
  try {
    result = await exchangeToken(form);
  } catch (err) {
    console.error('[plugin] token exchange failed', err);
    return Response.json(
      { error: 'temporarily_unavailable' },
      { status: 503, headers: { 'cache-control': 'no-store' } }
    );
  }
  return Response.json(result.body, {
    status: result.ok ? 200 : result.status,
    headers: { 'cache-control': 'no-store', pragma: 'no-cache' },
  });
}
