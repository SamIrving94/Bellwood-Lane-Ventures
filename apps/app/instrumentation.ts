/**
 * Next.js boot hook. Runs ONCE per server process / Vercel function
 * cold start. See apps/api/instrumentation.ts for the canonical version
 * and the ⚠ no-'server-only'-imports constraint (importing @repo/ai or
 * @repo/database here throws and silently kills register()).
 *
 * Sentry stays disabled — see next.config.ts.
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
