/**
 * Bellwood MCP server — exposes Bellwood domain primitives as Model Context
 * Protocol tools. Used by:
 *   - Claude Code (terminal) for ad-hoc deal exploration
 *   - Cursor / other MCP-aware editors for grounded code authoring
 *   - In-product agent flows (via the HTTP transport — see TODO at bottom)
 *
 * Each tool wraps an existing internal API:
 *   - HMLR / EPC / OS Places / HPI / Companies House → @repo/property-data
 *   - Scout DB / pipeline / founder actions → @repo/database (Prisma)
 *
 * No auth at this layer. The stdio transport is local-only (parent-process
 * trust). For an HTTP transport, wrap this in a Next.js route with bearer
 * auth — see TODO at the bottom of this file.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAll } from './tools';

export const BELLWOOD_MCP_VERSION = '0.1.0';

export function buildServer(): McpServer {
  const server = new McpServer({
    name: 'bellwood',
    version: BELLWOOD_MCP_VERSION,
  });

  registerAll(server);

  return server;
}

// ───────────────────────────────────────────────────────────────────────────
// TODO — production HTTP transport
//
// For Vercel deployment, wrap this server in a Next.js route at
// apps/api/app/mcp/route.ts using `StreamableHTTPServerTransport` from
// `@modelcontextprotocol/sdk/server/streamableHttp.js`. Add bearer-token
// auth via validateAgentAuth() so external agents can call the same tools
// over HTTPS. The tool surface is identical — only the transport changes.
// ───────────────────────────────────────────────────────────────────────────
