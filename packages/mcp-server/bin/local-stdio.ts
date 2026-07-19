#!/usr/bin/env node
/**
 * Local stdio entry point for the Bellwood MCP server.
 *
 * Invoked by Claude Code / Cursor as a sub-process. Communicates over stdio
 * using the MCP JSON-RPC protocol. NEVER prints to stdout outside the MCP
 * stream — use stderr for any human-readable logging.
 *
 * Configure in Claude Code (`~/.claude/claude_desktop_config.json` or
 * platform equivalent):
 *
 *   {
 *     "mcpServers": {
 *       "bellwood": {
 *         "command": "pnpm",
 *         "args": ["--filter", "@repo/mcp-server", "start:stdio"],
 *         "cwd": "/absolute/path/to/bellwood-app"
 *       }
 *     }
 *   }
 *
 * Environment variables the tools rely on (inherit from your shell):
 *   - DATABASE_URL              — Neon Postgres connection string
 *   - OS_PLACES_API_KEY         — OS Places (UK address) API
 *   - EPC_API_TOKEN             — Energy Performance of Buildings Data API (bearer token)
 *   - COMPANIES_HOUSE_API_KEY   — Companies House
 *   - PROPERTYDATA_API_KEY      — PropertyData (for HPI fallback, agents lookup)
 *
 * Missing keys degrade gracefully: a tool returns null fields rather than
 * crashing. Watch stderr for `[@repo/property-data]` warnings.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildServer, BELLWOOD_MCP_VERSION } from '../src/server';

async function main(): Promise<void> {
  // stderr only — stdout is reserved for the MCP wire protocol.
  process.stderr.write(
    `[bellwood-mcp] starting v${BELLWOOD_MCP_VERSION} (stdio transport)\n`,
  );

  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write('[bellwood-mcp] ready — listening on stdio\n');
}

main().catch((err) => {
  process.stderr.write(`[bellwood-mcp] fatal: ${err?.message ?? String(err)}\n`);
  process.exit(1);
});
