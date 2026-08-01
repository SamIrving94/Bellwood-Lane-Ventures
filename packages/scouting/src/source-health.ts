/**
 * Discovery-source health.
 *
 * The scouting pipeline degrades gracefully: any source that throws is caught,
 * recorded, and the run continues on whatever is left. That is the right
 * runtime behaviour and the wrong reporting behaviour — for weeks the daily
 * scout looked healthy (200, ~30 leads persisted) while four of its six
 * discovery sources were dark, because PropertyData alone still filled the
 * per-run cap. The leads were real listings; they just carried none of the
 * distress signal the whole thesis rests on.
 *
 * Three states have to be told apart, because the founder's response differs:
 *
 *   not_configured — an API key is missing. Nothing will ever come out of this
 *                    source until someone sets it. Actionable, permanent, and
 *                    invisible today: a source whose fetcher swallows its own
 *                    error (HMCTS returns `[]`) never reaches `sourceErrors`
 *                    at all, so it can't raise an alert.
 *   error          — the source ran and failed. Possibly transient (The
 *                    Gazette 500s), possibly not. Worth watching, not
 *                    necessarily worth acting on today.
 *   skipped        — deliberately disabled for this run (`skipSlowSources`).
 *                    Not a fault, but it must not read as "ran, found nothing".
 *
 * Everything here is pure and env-injectable so it can be tested without
 * touching the network or the process environment.
 */

export type SourceStatus = 'ok' | 'error' | 'skipped' | 'not_configured';

export interface SourceHealthEntry {
  /** Stable key, matching the `sources` / `sourceErrors` field names. */
  key: string;
  /** Founder-readable source name. */
  label: string;
  status: SourceStatus;
  /** Leads this source contributed this run. */
  count: number;
  /** Why it isn't `ok` — an error message, or the missing env key(s). */
  detail?: string;
  /**
   * True for the sources that carry the distressed-seller signal. A run with
   * every core source dark is still capable of returning a full batch of
   * leads — they just aren't motivated-seller leads, which is precisely the
   * failure this module exists to make loud.
   */
  core: boolean;
}

interface SourceSpec {
  key: string;
  label: string;
  /** Env vars required for this source to function at all. */
  envKeys: string[];
  core: boolean;
}

/**
 * The discovery sources, in founder-facing order.
 *
 * `core` marks the sources that supply motivation (why would this owner sell
 * below market?) as opposed to inventory (what is currently listed?).
 * PropertyData is core because it is the only source of listing-distress
 * signals — price reductions, time on market — even though it also supplies
 * the raw inventory.
 */
export const DISCOVERY_SOURCES: readonly SourceSpec[] = [
  {
    key: 'hmcts',
    label: 'HMCTS probate registry',
    envKeys: ['HMCTS_PROBATE_API_KEY'],
    core: true,
  },
  {
    key: 'gazette',
    label: 'The Gazette (probate notices)',
    envKeys: [],
    core: true,
  },
  {
    key: 'chDistress',
    label: 'Companies House (charges + insolvency)',
    envKeys: ['COMPANIES_HOUSE_API_KEY'],
    core: true,
  },
  {
    key: 'propertydata',
    label: 'PropertyData listings',
    envKeys: ['PROPERTYDATA_API_KEY'],
    core: true,
  },
  {
    key: 'shortLease',
    label: 'Short-lease scout',
    envKeys: ['PROPERTYDATA_API_KEY'],
    core: false,
  },
  {
    key: 'planning',
    label: 'Planning applications',
    envKeys: ['PROPERTYDATA_API_KEY'],
    core: false,
  },
  {
    key: 'hmo',
    label: 'HMO register',
    envKeys: ['PROPERTYDATA_API_KEY'],
    core: false,
  },
  {
    key: 'dissolved',
    label: 'Dissolved companies',
    envKeys: ['COMPANIES_HOUSE_API_KEY'],
    core: false,
  },
] as const;

export interface BuildSourceHealthInput {
  /** Leads contributed per source key. */
  counts: Record<string, number>;
  /** Error message per source key (from the pipeline's `sourceErrors`). */
  errors: Record<string, string | undefined>;
  /** Source keys deliberately not run this execution. */
  skipped?: string[];
  /** Env to read API keys from. Injectable for tests. */
  env?: Record<string, string | undefined>;
}

/**
 * Resolve each discovery source to a single status.
 *
 * Precedence is deliberate:
 *
 *   skipped        wins over everything. A source excluded from the run is out
 *                  of the funnel by choice, and reporting a missing key for it
 *                  would send the founder to configure something that still
 *                  wouldn't run.
 *   not_configured wins over error, because "you never set the key" is both
 *                  the root cause and the fixable thing. A source that errored
 *                  *and* has no key is not a flaky endpoint.
 */
export function buildSourceHealth(
  input: BuildSourceHealthInput
): SourceHealthEntry[] {
  const { counts, errors, skipped = [], env = process.env } = input;
  const skippedSet = new Set(skipped);

  return DISCOVERY_SOURCES.map((spec) => {
    const count = counts[spec.key] ?? 0;

    if (skippedSet.has(spec.key)) {
      return {
        key: spec.key,
        label: spec.label,
        status: 'skipped' as const,
        count,
        detail: 'skipped this run',
        core: spec.core,
      };
    }

    const missingKeys = spec.envKeys.filter((k) => !env[k]);
    if (missingKeys.length > 0) {
      return {
        key: spec.key,
        label: spec.label,
        status: 'not_configured' as const,
        count,
        detail: `missing ${missingKeys.join(', ')}`,
        core: spec.core,
      };
    }

    const error = errors[spec.key];
    if (error) {
      return {
        key: spec.key,
        label: spec.label,
        status: 'error' as const,
        count,
        detail: error,
        core: spec.core,
      };
    }

    return {
      key: spec.key,
      label: spec.label,
      status: 'ok' as const,
      count,
      core: spec.core,
    };
  });
}

export interface SourceHealthSummary {
  /** Sources that ran without fault (regardless of how many leads they found). */
  live: number;
  /** Sources that produced nothing because they are broken, unset or disabled. */
  dark: number;
  coreLive: number;
  coreTotal: number;
  /** Distinct env vars that would bring dark sources back. Deduped, sorted. */
  missingKeys: string[];
  /** True when no core source is live — leads carry no distress signal. */
  allCoreDark: boolean;
  /** One founder-readable line per source, ready to drop into an alert body. */
  lines: string[];
  /** One-line headline, e.g. "1 of 4 core discovery sources live". */
  headline: string;
}

const STATUS_LABEL: Record<SourceStatus, string> = {
  ok: 'live',
  error: 'FAILING',
  skipped: 'skipped',
  not_configured: 'NOT CONFIGURED',
};

/**
 * Roll per-source health into the numbers an alert should lead with.
 *
 * The headline counts *core* sources specifically. Total-source counts
 * flatter the situation — the optional PropertyData extras share a key with
 * the one source that does work, so "5 of 8 live" can hide "1 of 4 core live".
 */
export function summariseSourceHealth(
  health: SourceHealthEntry[]
): SourceHealthSummary {
  const live = health.filter((h) => h.status === 'ok').length;
  const core = health.filter((h) => h.core);
  const coreLive = core.filter((h) => h.status === 'ok').length;

  const missingKeys = Array.from(
    new Set(
      health
        .filter((h) => h.status === 'not_configured')
        .flatMap((h) => (h.detail ?? '').replace(/^missing /, '').split(', '))
        .filter(Boolean)
    )
  ).sort();

  const lines = health.map((h) => {
    const status = STATUS_LABEL[h.status];
    const suffix =
      h.status === 'ok'
        ? `${h.count} lead${h.count === 1 ? '' : 's'}`
        : (h.detail ?? '');
    return `• ${h.label} — ${status}${suffix ? `: ${suffix}` : ''}`;
  });

  return {
    live,
    dark: health.length - live,
    coreLive,
    coreTotal: core.length,
    missingKeys,
    allCoreDark: coreLive === 0,
    lines,
    headline: `${coreLive} of ${core.length} core discovery sources live`,
  };
}
