/**
 * Next.js boot hook. Runs ONCE per server process / Vercel function
 * cold start.
 *
 * Currently wires:
 *   - LLM telemetry: every Claude call writes a row to LlmCallLog.
 *     @repo/ai stays Prisma-free; the integration happens here.
 *
 * Sentry instrumentation stays disabled — see next.config.ts.
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

  // Per-feature model routing — the founder edits the `model_routing`
  // Setting row from the dashboard (Settings → AI models); changes apply
  // within 60s, no deploy. Shape: { [feature]: ModelRoute }.
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
