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
  feature: string
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
export async function resolveRoute(
  feature: string
): Promise<ModelRoute | null> {
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
  route: ModelRoute | null
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

// ───────────────────────────────────────────────────────────────────────────
// Provider planning — pure, so it is unit-testable without keys or SDKs.
// claude.ts turns a plan into live AI SDK model instances.
// ───────────────────────────────────────────────────────────────────────────

/** Anthropic-direct ids for our tiers (mirrors the constants in claude.ts). */
export const ANTHROPIC_HAIKU = 'claude-haiku-4-5';
export const ANTHROPIC_SONNET = 'claude-sonnet-4-5';
export const ANTHROPIC_OPUS = 'claude-opus-4-7';

/**
 * OpenRouter's ids for the same models. OpenRouter puts a DOT in the
 * version ("claude-sonnet-4.5"); Anthropic direct uses a hyphen
 * ("claude-sonnet-4-5"). The previous fallback chain sent the hyphen form
 * to OpenRouter, which is not a model there — so the chain could never
 * have served a call. Verified against openrouter.ai model pages,
 * 2026-09-12.
 */
export const OPENROUTER_CLAUDE_IDS: Record<string, string> = {
  [ANTHROPIC_HAIKU]: 'anthropic/claude-haiku-4.5',
  [ANTHROPIC_SONNET]: 'anthropic/claude-sonnet-4.5',
  [ANTHROPIC_OPUS]: 'anthropic/claude-opus-4.7',
};

/** Map a bare Anthropic id to its OpenRouter id; slash ids pass through. */
export function toOpenRouterId(model: string): string {
  if (isOpenRouterModel(model)) return model;
  const known = OPENROUTER_CLAUDE_IDS[model];
  if (known) return known;
  // claude-<family>-<major>-<minor> → anthropic/claude-<family>-<major>.<minor>
  return `anthropic/${model.replace(/-(\d+)-(\d+)$/, '-$1.$2')}`;
}

/**
 * Built-in fallback chains, tried in order after the primary fails on a
 * recoverable error. Two tiers: `fast` for Haiku-class work (triage,
 * classification, briefings), `strong` for everything else. Each chain is
 * the same Claude tier via OpenRouter, then an open-weight model, then a
 * second open-weight model — so a provider outage or an empty balance on
 * one account never takes a feature down. Every id verified on
 * openrouter.ai, 2026-09-12 (prices per 1M tokens in/out at that date):
 *   qwen/qwen3-235b-a22b-2507   $0.09 / $0.35
 *   deepseek/deepseek-v4-flash  $0.05 / $0.16
 *   z-ai/glm-5.2                $0.49 / $1.56
 *   moonshotai/kimi-k2.6        $0.58 / $2.44  (multimodal)
 * Override with LLM_FALLBACK_CHAIN=a/b,c/d (applies to both tiers).
 */
export const DEFAULT_FALLBACK_CHAINS = {
  fast: [
    'anthropic/claude-haiku-4.5',
    'qwen/qwen3-235b-a22b-2507',
    'deepseek/deepseek-v4-flash',
  ],
  strong: [
    'anthropic/claude-sonnet-4.5',
    'z-ai/glm-5.2',
    'moonshotai/kimi-k2.6',
  ],
} as const;

export type ProviderKind = 'anthropic' | 'openrouter';

export type ProviderPlanStep = {
  kind: ProviderKind;
  /** The id sent to that provider. */
  model: string;
  /** Log label, e.g. "openrouter:z-ai/glm-5.2". */
  label: string;
};

export type ProviderPlan = {
  primary: ProviderPlanStep;
  fallbacks: ProviderPlanStep[];
};

export type ProviderPlanEnv = {
  ANTHROPIC_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  LLM_PRIMARY_PROVIDER?: 'openrouter' | 'anthropic';
  LLM_FALLBACK_CHAIN?: string;
};

function chainFor(model: string, env: ProviderPlanEnv): string[] {
  if (env.LLM_FALLBACK_CHAIN) {
    return env.LLM_FALLBACK_CHAIN.split(',')
      .map((m) => m.trim())
      .filter(Boolean);
  }
  const tier =
    model === ANTHROPIC_HAIKU || toOpenRouterId(model).includes('haiku')
      ? 'fast'
      : 'strong';
  return [...DEFAULT_FALLBACK_CHAINS[tier]];
}

const step = (kind: ProviderKind, model: string): ProviderPlanStep => ({
  kind,
  model,
  label: `${kind}:${model}`,
});

/**
 * Decide which provider serves a model first and what to try after it.
 *
 *   - Slash id ("vendor/model")      → OpenRouter primary. Fallbacks:
 *     Anthropic Sonnet direct (if keyed), then the strong chain.
 *   - Bare Claude id, OpenRouter key → OpenRouter primary (mapped id),
 *     Anthropic direct as first fallback (if keyed), then the tier chain.
 *     LLM_PRIMARY_PROVIDER=anthropic flips the first two.
 *   - Bare Claude id, Anthropic only → Anthropic direct, no fallbacks.
 *
 * Returns null when no key can serve the model at all.
 */
export function planProviders(
  model: string,
  env: ProviderPlanEnv
): ProviderPlan | null {
  const hasOr = !!env.OPENROUTER_API_KEY;
  const hasAn = !!env.ANTHROPIC_API_KEY;
  const orModel = toOpenRouterId(model);
  const dedupe = (steps: ProviderPlanStep[], primary: ProviderPlanStep) => {
    const seen = new Set([primary.label]);
    return steps.filter((s) => {
      if (seen.has(s.label)) return false;
      seen.add(s.label);
      return true;
    });
  };

  if (isOpenRouterModel(model)) {
    if (!hasOr) return null;
    const primary = step('openrouter', model);
    const fallbacks: ProviderPlanStep[] = [];
    if (hasAn) fallbacks.push(step('anthropic', ANTHROPIC_SONNET));
    for (const m of chainFor(model, env)) fallbacks.push(step('openrouter', m));
    return { primary, fallbacks: dedupe(fallbacks, primary) };
  }

  const anthropicFirst = env.LLM_PRIMARY_PROVIDER === 'anthropic';
  if (hasAn && (anthropicFirst || !hasOr)) {
    const primary = step('anthropic', model);
    const fallbacks: ProviderPlanStep[] = [];
    if (hasOr) {
      fallbacks.push(step('openrouter', orModel));
      for (const m of chainFor(model, env))
        fallbacks.push(step('openrouter', m));
    }
    return { primary, fallbacks: dedupe(fallbacks, primary) };
  }

  if (hasOr) {
    const primary = step('openrouter', orModel);
    const fallbacks: ProviderPlanStep[] = [];
    if (hasAn) fallbacks.push(step('anthropic', model));
    for (const m of chainFor(model, env)) fallbacks.push(step('openrouter', m));
    return { primary, fallbacks: dedupe(fallbacks, primary) };
  }

  return null;
}
