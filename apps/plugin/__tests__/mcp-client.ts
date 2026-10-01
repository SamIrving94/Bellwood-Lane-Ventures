/**
 * Minimal JSON-RPC driver for an MCP route handler, over the 2025-era
 * stateless Streamable HTTP fallback (initialize, then the call). Parses
 * either a JSON body or an SSE-framed one.
 */

type Handler = (req: Request) => Promise<Response>;

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  const type = res.headers.get('content-type') ?? '';
  if (type.includes('text/event-stream')) {
    const data = text
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
      .filter(Boolean);
    return data.length ? JSON.parse(data.at(-1) as string) : null;
  }
  return text ? JSON.parse(text) : null;
}

// biome-ignore lint/suspicious/noExplicitAny: JSON-RPC payloads are asserted field by field in the tests.
export type Json = any;

export async function rpc(
  handler: Handler,
  method: string,
  params: Record<string, unknown> = {},
  headers: Record<string, string> = {}
): Promise<{ status: number; body: Json; headers: Headers }> {
  const res = await handler(
    new Request('https://plugin.test/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': '2025-06-18',
        ...headers,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
  );
  return {
    status: res.status,
    body: await readBody(res),
    headers: res.headers,
  };
}
