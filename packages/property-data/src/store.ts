/**
 * Optional durable cache for PropertyData responses.
 *
 * The in-memory LRU in propertydata.ts dies on every serverless cold start, so a
 * fresh Vercel lambda re-buys the entire (up to 90-day-TTL) dataset — the single
 * biggest source of wasted PropertyData credits, and a compounding cause of the
 * lead-appraise 504s (every cold run re-fetches instead of reusing). A
 * persistent store (Postgres) lets a bought response survive cold starts and be
 * shared across instances, so a postcode is paid for once per TTL window no
 * matter how many lambdas or territories hit it.
 *
 * This package must stay dependency-free (it must NOT import @repo/database), so
 * the durable store is injected by the host app via `setPersistentStore`. When
 * no store is registered, `fetchPropertyData` behaves exactly as before
 * (in-memory only) — the durable tier is purely additive and zero-risk. It is
 * also read/written inside fetchPropertyData's own try/catch, so a DB blip (or a
 * missing table before the migration runs) degrades gracefully to in-memory.
 *
 * Wiring lives in the API app (apps/api/instrumentation.ts).
 */

export type PersistentCacheEntry = {
  value: unknown;
  /** Absolute epoch-ms expiry. */
  expiresAt: number;
};

export type PersistentCacheStore = {
  /** Return the live (non-expired) entry for `key`, or null on miss/expiry. */
  get(key: string): Promise<PersistentCacheEntry | null>;
  /** Upsert `value` under `key` with an absolute epoch-ms `expiresAt`. */
  set(key: string, value: unknown, expiresAt: number): Promise<void>;
};

// The singleton MUST live on globalThis, not in module scope. Next.js bundles
// instrumentation.ts as its own webpack entry, so this module can be inlined
// twice in one server process (once for instrumentation, once for route
// chunks). A module-scoped variable then splits: register() writes to one copy
// while fetchPropertyData reads the other — silently null, cache never used.
const GLOBAL_KEY = Symbol.for('@repo/property-data:persistent-store');

type GlobalWithStore = typeof globalThis & {
  [GLOBAL_KEY]?: PersistentCacheStore | null;
};

/**
 * Register (or clear, with `null`) the durable cache backend. Call once at app
 * boot. Safe to leave unset — the client falls back to in-memory only.
 */
export function setPersistentStore(next: PersistentCacheStore | null): void {
  (globalThis as GlobalWithStore)[GLOBAL_KEY] = next;
}

export function getPersistentStore(): PersistentCacheStore | null {
  return (globalThis as GlobalWithStore)[GLOBAL_KEY] ?? null;
}
