/**
 * Size limits for the MCP endpoints.
 *
 * GHSA-46jr-4wx8-v453 (high, Oct 2026): before @modelcontextprotocol/server
 * 2.3.0, one request inside the SDK's 4 MiB default could exhaust server
 * memory during validation. The fix is the upgrade plus two limits:
 *
 * - `maxToolInputElements`: caps the array elements and object members in a
 *   `tools/call` payload. mcp-handler passes it to McpServer at runtime but
 *   leaves it out of its options type, hence MCP_SERVER_LIMITS below.
 * - A smaller body limit. mcp-handler does not pass the SDK's
 *   `maxRequestBodySize` through, so `withBodyLimit` enforces it here,
 *   before anything parses the body.
 *
 * The public endpoint needs no login, so these matter most there. Our
 * largest real request (a full `compare_sale_routes` call) is under 2 KB
 * and about 20 elements.
 */

/** Generous: 30x the largest real request. */
export const MAX_MCP_BODY_BYTES = 64 * 1024;

/** Spread into createMcpHandler's options. */
export const MCP_SERVER_LIMITS = { maxToolInputElements: 200 } as const;

const tooLarge = () =>
  new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32_600, message: 'Request body too large' },
      id: null,
    }),
    { status: 413, headers: { 'content-type': 'application/json' } }
  );

/** Reads the body, giving up as soon as it passes `limit` bytes. */
async function readCapped(
  body: ReadableStream<Uint8Array>,
  limit: number
): Promise<Uint8Array | null> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * Answers 413 for a POST body over `limit`, checking the declared length
 * first and then the bytes actually sent (a chunked body has no length).
 */
export function withBodyLimit(
  handler: (req: Request) => Promise<Response>,
  limit = MAX_MCP_BODY_BYTES
): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method !== 'POST' || !req.body) {
      return handler(req);
    }
    const declared = Number(req.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > limit) {
      return tooLarge();
    }
    const body = await readCapped(req.body, limit);
    if (body === null) {
      return tooLarge();
    }
    return handler(
      new Request(req.url, {
        method: req.method,
        headers: req.headers,
        body,
      })
    );
  };
}
