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

  // Durable PropertyData cache (PR #28) — @repo/property-data reads this slot
  // via getPersistentStore(); it cannot be imported here (its barrel is
  // 'server-only'). Reads/writes sit inside fetchPropertyData's try/catch, so
  // a DB blip degrades gracefully to the in-memory cache.
  (globalThis as Record<string, unknown>).__bellwoodPdStore = {
    async get(key: string) {
      const row = await db.propertyDataCache.findUnique({ where: { key } });
      if (!row) return null;
      const expiresAt = row.expiresAt.getTime();
      if (expiresAt <= Date.now()) return null;
      return { value: row.value, expiresAt };
    },
    async set(key: string, value: unknown, expiresAt: number) {
      // Key is `${endpoint}:${params}` — keep the endpoint for spend analysis.
      const endpoint = key.split(':')[0] ?? 'unknown';
      const data = {
        endpoint,
        value: value as object,
        expiresAt: new Date(expiresAt),
      };
      await db.propertyDataCache.upsert({
        where: { key },
        create: { key, ...data },
        update: data,
      });
    },
  };
}
