/**
 * Next.js boot hook. Runs ONCE per server process / Vercel function
 * cold start.
 *
 * Currently wires:
 *   - LLM telemetry: every Claude call writes a row to LlmCallLog.
 *     @repo/ai stays Prisma-free; the integration happens here.
 *   - Durable PropertyData cache: response payloads persist to Postgres so a
 *     cold-started lambda doesn't re-buy data (credits) a previous instance
 *     already paid for. @repo/property-data stays Prisma-free; wired here.
 *
 * Sentry instrumentation stays disabled — see next.config.ts.
 */

// Type-only import (erased at runtime — keeps @repo/database out of this module's
// eager load, while letting us type the Json write below).
import type { Prisma } from '@repo/database';

export async function register() {
  const { setLlmLogger, setModelRouter } = await import('@repo/ai/claude');
  const { setPersistentStore } = await import('@repo/property-data');
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

  // Durable second tier for the PropertyData client. Reads/writes are already
  // wrapped in the client's try/catch, so a DB blip (or a missing table before
  // the migration runs) degrades gracefully to the in-memory cache.
  setPersistentStore({
    async get(key) {
      const row = await database.propertyDataCache.findUnique({
        where: { key },
      });
      if (!row) return null;
      const expiresAt = row.expiresAt.getTime();
      if (expiresAt <= Date.now()) return null;
      return { value: row.value, expiresAt };
    },
    async set(key, value, expiresAt) {
      // Key is `${endpoint}:${params}` — keep the endpoint for spend analysis.
      const endpoint = key.split(':')[0] ?? 'unknown';
      const data = {
        endpoint,
        value: value as Prisma.InputJsonValue,
        expiresAt: new Date(expiresAt),
      };
      await database.propertyDataCache.upsert({
        where: { key },
        create: { key, ...data },
        update: data,
      });
    },
  });
}
