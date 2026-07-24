/**
 * Next.js boot hook. Runs ONCE per server process / Vercel function
 * cold start.
 *
 * ⚠ HARD CONSTRAINT — no 'server-only' imports here. This runtime lacks
 * the react-server condition, so importing @repo/ai or @repo/database
 * (both start with `import 'server-only'`) THROWS and kills register()
 * before it installs anything. That exact failure meant the LLM logger
 * never ran in production — zero LlmCallLog rows, ever. We therefore:
 *   - talk to Prisma via the GENERATED client directly (no guard), and
 *   - hand the hooks to @repo/ai via globalThis, which is shared across
 *     Next's separate instrumentation/route bundles (module state isn't).
 *
 * Wires:
 *   - LLM telemetry: every callClaude/callClaudeForObject writes a row
 *     to LlmCallLog.
 *   - Model routing: per-feature model overrides + shadow evals, read
 *     from the Setting row `model_routing` (60s cache) — editable from
 *     the dashboard (Settings → AI models), no deploy.
 *
 * Sentry instrumentation stays disabled — see next.config.ts.
 */
export async function register() {
  // register() runs once per RUNTIME — nodejs AND edge. The edge runtime
  // (which executes middleware.ts) cannot load the generated Prisma
  // client; letting it try kills the whole edge entry, so every request
  // matched by the middleware 500s with MIDDLEWARE_INVOCATION_FAILED
  // (= the dashboard login outage). Only the node runtime needs these
  // hooks — bail out everywhere else.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { PrismaClient } = await import('@repo/database/generated/client');
  const db = new PrismaClient();

  (globalThis as Record<string, unknown>).__bellwoodLlmLogger = async (metric: {
    feature: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
    success: boolean;
    errorReason?: string;
  }) => {
    await db.llmCallLog.create({
      data: {
        feature: metric.feature,
        model: metric.model,
        inputTokens: metric.inputTokens,
        outputTokens: metric.outputTokens,
        durationMs: metric.durationMs,
        success: metric.success,
        errorReason: metric.errorReason,
      },
    });
  };

  let routingCache: { table: Record<string, unknown>; fetchedAt: number } | null =
    null;
  (globalThis as Record<string, unknown>).__bellwoodModelRouter = async (
    feature: string,
  ) => {
    const now = Date.now();
    if (!routingCache || now - routingCache.fetchedAt > 60_000) {
      const row = await db.setting.findUnique({
        where: { key: 'model_routing' },
      });
      routingCache = {
        table: (row?.value as Record<string, unknown>) ?? {},
        fetchedAt: now,
      };
    }
    const route = routingCache.table[feature];
    return route && typeof route === 'object' ? route : null;
  };
}
