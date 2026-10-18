/**
 * One cheap, read-only call to a data provider that answers a single
 * question: does our key still work?
 *
 * WHY a separate path: the everyday clients swallow failures on purpose
 * (`listPostcodeAddresses` → null, `searchDomesticEpc` → []), so a lead
 * enrichment never dies on a provider outage. That same politeness hid a dead
 * OS Places key on 18 Oct 2026 — the UPRN matcher quietly fell back to
 * EPC-only and no lead could reach "high" confidence. A probe keeps the
 * error message instead of eating it, so `/cron/provider-health` can say
 * exactly what broke.
 *
 * An empty answer is still `ok`: the provider accepted the key and replied.
 * Only "could not get an answer" (no key, rejected key, 5xx, timeout,
 * schema drift) is a failure.
 */
export type ProviderProbe =
  | { ok: true; detail: string }
  | { ok: false; error: string };

/** Keep stored messages short; never let a whole HTML error page through. */
export function probeError(err: unknown): ProviderProbe {
  const message = err instanceof Error ? err.message : String(err);
  return { ok: false, error: message.slice(0, 200) };
}
