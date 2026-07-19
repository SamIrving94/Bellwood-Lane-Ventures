/**
 * Next.js boot hook. Runs ONCE per server process / Vercel function
 * cold start. See apps/api/instrumentation.ts for the canonical version.
 *
 * Sentry stays disabled — see next.config.ts.
 */
export async function register() {
  const { setLlmLogger, setModelRouter } = await import('@repo/ai/claude');
  const { database } = await import('@repo/database');

  setLlmLogger(async (metric) => {
    await database.llmCallLog.create({
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
  });

  // Same per-feature routing as apps/api — see that file for the shape.
  let routingCache: { table: Record<string, unknown>; fetchedAt: number } | null =
    null;
  setModelRouter(async (feature) => {
    const now = Date.now();
    if (!routingCache || now - routingCache.fetchedAt > 60_000) {
      const row = await database.setting.findUnique({
        where: { key: 'model_routing' },
      });
      routingCache = {
        table: (row?.value as Record<string, unknown>) ?? {},
        fetchedAt: now,
      };
    }
    const route = routingCache.table[feature];
    return route && typeof route === 'object'
      ? (route as import('@repo/ai/claude').ModelRoute)
      : null;
  });
}
