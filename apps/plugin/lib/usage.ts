/**
 * One log line per tool call, so we can learn from live use. Read them in
 * Vercel runtime logs (search "kept_plugin_tool").
 *
 * Logs the tool name, the outcome and the time taken. NEVER the arguments
 * or the result: those can hold an address, a date of death or a price,
 * and the probate firewall says a user's case data is theirs, not ours
 * (docs/proposals/keyhole-probate-shelf-tree.md; docs/mcp/04-prd.md).
 * mcp-handler's own onEvent hook is deliberately not used: its
 * REQUEST_RECEIVED event carries the full request body.
 */

import type { McpServer } from '@modelcontextprotocol/server';

export type Surface = 'public' | 'pro';

export interface UsageLine {
  event: 'kept_plugin_tool';
  surface: Surface;
  tool: string;
  outcome: 'ok' | 'tool_error' | 'exception';
  ms: number;
}

export function logUsage(line: UsageLine): void {
  console.log(JSON.stringify(line));
}

type AnyCallback = (...args: unknown[]) => unknown;
type RegisterTool = (name: string, config: unknown, cb: AnyCallback) => unknown;

function isToolError(result: unknown): boolean {
  return (
    typeof result === 'object' &&
    result !== null &&
    (result as { isError?: unknown }).isError === true
  );
}

function wrap(surface: Surface, tool: string, cb: AnyCallback): AnyCallback {
  return async (...args: unknown[]) => {
    const started = Date.now();
    try {
      const result = await cb(...args);
      logUsage({
        event: 'kept_plugin_tool',
        surface,
        tool,
        outcome: isToolError(result) ? 'tool_error' : 'ok',
        ms: Date.now() - started,
      });
      return result;
    } catch (err) {
      logUsage({
        event: 'kept_plugin_tool',
        surface,
        tool,
        outcome: 'exception',
        ms: Date.now() - started,
      });
      throw err;
    }
  };
}

/**
 * Make every tool registered on this server log a usage line. Call once,
 * before registering tools.
 */
export function withUsageLogging(
  server: McpServer,
  surface: Surface
): McpServer {
  const target = server as unknown as { registerTool: RegisterTool };
  const register = target.registerTool.bind(server) as RegisterTool;
  target.registerTool = (name, config, cb) =>
    register(name, config, wrap(surface, name, cb));
  return server;
}
