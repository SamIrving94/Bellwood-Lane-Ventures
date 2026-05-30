/**
 * Next.js boot hook. Runs ONCE per server process / Vercel function
 * cold start. See apps/api/instrumentation.ts for the canonical version.
 *
 * Sentry stays disabled — see next.config.ts.
 */
export async function register() {
  const { setLlmLogger } = await import('@repo/ai/claude');
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
}
