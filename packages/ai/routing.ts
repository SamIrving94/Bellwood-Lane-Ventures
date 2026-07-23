/**
 * @repo/ai/routing — per-feature model routing + shadow evals.
 *
 * The model for each LLM feature is a CONFIG decision, not a code
 * decision. Apps install a router (like setLlmLogger) that resolves a
 * feature tag to a route; the founder edits the routing table in the
 * dashboard and the next call picks it up — no deploy.
 *
 * Route resolution order in callClaude:
 *   1. router(feature).model   — dashboard override (wins)
 *   2. input.model             — the caller's hardcoded tier
 *   3. CLAUDE_SONNET           — default
 *
 * Model id convention:
 *   - No slash  → Anthropic direct (e.g. "claude-sonnet-4-5")
 *   - Has slash → OpenRouter primary (e.g. "moonshotai/kimi-k2.6",
 *     "google/gemini-3-flash"), with Anthropic Sonnet as the fallback.
 *
 * Shadow evals: a route may name a challenger model. After a successful
 * primary call the same prompt is re-run on the challenger and logged to
 * LlmCallLog with a `__shadow` feature suffix — never returned to the
 * caller, never user-facing. Compare cost/latency/quality on the LLM
 * usage dashboard before flipping the primary.
 *
 * PII guardrails live in the route: `providerOnly` pins OpenRouter to
 * named hosts, `zdr` restricts to zero-data-retention endpoints, and
 * `denyDataCollection` excludes providers that train on prompts.
 */

export interface ModelRoute {
  /** Override model for this feature. Slash = OpenRouter, else Anthropic. */
  model?: string;
  /** Challenger model — called in shadow after a successful primary. */
  shadowModel?: string;
  /** 0..1 fraction of calls that also run the shadow. Default 1. */
  shadowSampleRate?: number;
  /** OpenRouter provider allowlist (e.g. ["deepinfra", "fireworks"]). */
  providerOnly?: string[];
  /** Restrict to OpenRouter zero-data-retention endpoints. */
  zdr?: boolean;
  /** Exclude OpenRouter providers that store/train on prompts. */
  denyDataCollection?: boolean;
}

export type ModelRouter = (
  feature: string,
) => Promise<ModelRoute | null> | ModelRoute | null;

let modelRouter: ModelRouter | null = null;

/**
 * Install the router. Apps wire this in instrumentation.ts next to
 * setLlmLogger. Pass null to remove (tests).
 */
export function setModelRouter(router: ModelRouter | null): void {
  modelRouter = router;
}

/** Resolve the route for a feature. Never throws; null on any failure. */
export async function resolveRoute(feature: string): Promise<ModelRoute | null> {
  // globalThis fallback for the same reason as the LLM logger (see
  // claude.ts logSafely): instrumentation.ts can't import this module and
  // wouldn't share its module instance anyway.
  const router =
    modelRouter ??
    ((globalThis as Record<string, unknown>).__bellwoodModelRouter as
      | ModelRouter
      | undefined);
  if (!router) return null;
  try {
    return (await router(feature)) ?? null;
  } catch (err) {
    console.warn('[@repo/ai/routing] router failed (non-fatal)', err);
    return null;
  }
}

/** OpenRouter model ids carry a vendor prefix ("vendor/model"). */
export function isOpenRouterModel(model: string): boolean {
  return model.includes('/');
}

/**
 * Build the OpenRouter `provider` routing preferences body for a route.
 * Returns undefined when the route sets no preferences.
 * https://openrouter.ai/docs/features/provider-routing
 */
export function openRouterProviderPrefs(
  route: ModelRoute | null,
): Record<string, unknown> | undefined {
  if (!route) return undefined;
  const prefs: Record<string, unknown> = {};
  if (route.providerOnly?.length) {
    prefs.only = route.providerOnly;
    prefs.allow_fallbacks = false;
  }
  if (route.zdr) prefs.zdr = true;
  if (route.denyDataCollection) prefs.data_collection = 'deny';
  return Object.keys(prefs).length > 0 ? prefs : undefined;
}
