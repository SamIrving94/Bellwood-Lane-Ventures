/**
 * Next.js boot hook. Web app's only LLM-using path is the save-the-sale
 * triage inside /api/quote; logger wires it into LlmCallLog the same way
 * as the api + app apps. See apps/api/instrumentation.ts for canonical
 * docs.
 *
 * Sentry stays disabled (lambda size constraint).
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
