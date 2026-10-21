import { database } from '@repo/database';
import {
  type ProviderProbe,
  probeEpc,
  probePostcodeUprns,
  probePropertyData,
} from '@repo/property-data';

/**
 * Daily data-provider key check.
 *
 * WHY: on 18 Oct 2026 a UPRN golden-set run found the OS Places key dead
 * ("OS Places: invalid API key"). The client returns null on failure by
 * design, so the UPRN matcher had silently fallen back to EPC-only and no
 * lead could reach "high" confidence — and nothing said so. This makes one
 * cheap read-only call per provider each morning, logs the result as an
 * AgentEvent, and raises ONE founder card when a provider flips to failing.
 *
 * Noise contract (same shape as /cron/watchdog):
 *   - One card per provider, keyed `provider-health:<provider>`.
 *   - A flip ok → failing raises (or reopens) the card.
 *   - Still failing next morning: an open card is refreshed in place; a card
 *     the founder already closed stays closed until the provider recovers
 *     and fails again. No daily nagging about a known outage.
 *   - Recovery auto-completes the card.
 *
 * OS Places is deliberately NOT probed: its trial licence expired and won't
 * be renewed (founder decision, 18 Oct 2026), so a probe would be a card
 * that can never close. PropertyData /uprns replaces it as the UPRN
 * matcher's second source.
 *
 * Key values never leave this module: every message is redacted before it
 * is stored or returned.
 */

export const PROVIDERS = ['epc', 'propertydata', 'propertydata-uprns'] as const;
export type ProviderName = (typeof PROVIDERS)[number];
export type ProviderStatus = 'ok' | 'failing';

export type ProviderCheck = {
  provider: ProviderName;
  status: ProviderStatus;
  detail?: string;
  error?: string;
  ms: number;
};

export type CardAction = 'raise' | 'refresh' | 'resolve';

// Any valid unit postcode works: an empty answer still proves the key was
// accepted. Downing Street is a stable, real postcode.
export const PROBE_POSTCODE = 'SW1A 2AA';

// /uprns must return HOMES to count as healthy, so it needs a residential
// postcode, not Downing Street.
export const UPRNS_PROBE_POSTCODE = 'SW6 3EF';

const PROVIDER_LABEL: Record<ProviderName, string> = {
  epc: 'EPC register',
  propertydata: 'PropertyData',
  'propertydata-uprns': 'PropertyData UPRN lookup',
};

const PROVIDER_KEY_VAR: Record<ProviderName, string> = {
  epc: 'EPC_API_TOKEN',
  propertydata: 'PROPERTYDATA_API_KEY',
  'propertydata-uprns': 'PROPERTYDATA_API_KEY',
};

// What a dead key quietly does downstream — so the card says why it matters.
const PROVIDER_IMPACT: Record<ProviderName, string> = {
  epc: 'UPRN matching and EPC enrichment get no certificates, so leads lose floor area and energy band.',
  propertydata:
    'Appraisals, comps and scouting calls fail, so the AVM records no-valuation.',
  'propertydata-uprns':
    'The UPRN matcher loses its second source, so no lead can reach "high" confidence and own-certificate floor areas stop.',
};

const PROBES: Record<ProviderName, () => Promise<ProviderProbe>> = {
  epc: () => probeEpc(PROBE_POSTCODE),
  propertydata: () => probePropertyData(),
  'propertydata-uprns': () => probePostcodeUprns(UPRNS_PROBE_POSTCODE),
};

const settingKey = (p: ProviderName) => `provider-health:${p}`;
export const dedupKeyFor = (p: ProviderName) => `provider-health:${p}`;

/** Strip every configured key value, and any `key=` query param, from text. */
export function redactSecrets(
  text: string,
  secrets: Array<string | undefined> = PROVIDERS.map(
    (p) => process.env[PROVIDER_KEY_VAR[p]]
  )
): string {
  let out = text;
  for (const s of secrets) {
    if (s && s.length >= 4) {
      out = out.split(s).join('[redacted]');
    }
  }
  return out.replace(/([?&]key=)[^&\s]+/gi, '$1[redacted]');
}

export function cardActionFor(
  previous: ProviderStatus | null,
  current: ProviderStatus
): CardAction {
  if (current === 'ok') {
    return 'resolve';
  }
  return previous === 'failing' ? 'refresh' : 'raise';
}

export function buildFailureCard(check: ProviderCheck): {
  title: string;
  description: string;
} {
  const label = PROVIDER_LABEL[check.provider];
  return {
    title: `${label} is failing: check ${PROVIDER_KEY_VAR[check.provider]}`,
    description: [
      `The daily provider check could not get an answer from ${label}.`,
      `Error: ${check.error ?? 'unknown'}`,
      `Impact: ${PROVIDER_IMPACT[check.provider]}`,
      `Fix: check ${PROVIDER_KEY_VAR[check.provider]} in Vercel (bellwood-api), then redeploy. This card closes itself once the next check passes.`,
    ].join('\n'),
  };
}

/** Run every probe; a probe that throws is a failure, never a crash. */
export function runProviderChecks(
  probes: Record<ProviderName, () => Promise<ProviderProbe>> = PROBES
): Promise<ProviderCheck[]> {
  return Promise.all(
    PROVIDERS.map(async (provider): Promise<ProviderCheck> => {
      const started = Date.now();
      let result: ProviderProbe;
      try {
        result = await probes[provider]();
      } catch (err) {
        result = {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
      const ms = Date.now() - started;
      return result.ok
        ? { provider, status: 'ok', detail: redactSecrets(result.detail), ms }
        : {
            provider,
            status: 'failing',
            error: redactSecrets(result.error).slice(0, 200),
            ms,
          };
    })
  );
}

async function readPreviousStatus(
  provider: ProviderName
): Promise<ProviderStatus | null> {
  const row = await database.setting.findUnique({
    where: { key: settingKey(provider) },
  });
  const value = row?.value as { status?: ProviderStatus } | undefined;
  return value?.status ?? null;
}

async function applyCardAction(
  check: ProviderCheck,
  action: CardAction
): Promise<void> {
  const dedupKey = dedupKeyFor(check.provider);
  const metadata = { provider: check.provider, error: check.error ?? null };

  if (action === 'resolve') {
    await database.founderAction.updateMany({
      where: { dedupKey, status: { in: ['pending', 'in_progress'] } },
      data: { status: 'completed', resolvedAt: new Date() },
    });
    return;
  }

  const { title, description } = buildFailureCard(check);
  if (action === 'refresh') {
    // Only touch a card that is still open — never reopen a dismissed one.
    await database.founderAction.updateMany({
      where: { dedupKey, status: { in: ['pending', 'in_progress'] } },
      data: { title, description, metadata },
    });
    return;
  }

  await database.founderAction.upsert({
    where: { dedupKey },
    create: {
      type: 'general',
      priority: 'high',
      title,
      description,
      agent: 'system',
      dedupKey,
      metadata,
    },
    update: {
      status: 'pending',
      priority: 'high',
      title,
      description,
      resolvedAt: null,
      resolvedBy: null,
      metadata,
    },
  });
}

export async function runProviderHealth(): Promise<{
  checks: ProviderCheck[];
  raised: ProviderName[];
}> {
  const checks = await runProviderChecks();
  const raised: ProviderName[] = [];
  const checkedAt = new Date().toISOString();

  for (const check of checks) {
    // Card bookkeeping is best-effort per provider: one DB hiccup must not
    // stop the others being checked or the run being logged.
    try {
      const previous = await readPreviousStatus(check.provider);
      const action = cardActionFor(previous, check.status);
      await applyCardAction(check, action);
      if (action === 'raise') {
        raised.push(check.provider);
      }
      const value = { status: check.status, error: check.error, checkedAt };
      await database.setting.upsert({
        where: { key: settingKey(check.provider) },
        create: { key: settingKey(check.provider), value },
        update: { value },
      });
    } catch {
      // Non-fatal for a monitoring route.
    }
  }

  const failing = checks.filter((c) => c.status === 'failing');
  await database.agentEvent.create({
    data: {
      agent: 'system',
      eventType: 'provider_health',
      summary:
        failing.length === 0
          ? `Provider check: all ${checks.length} ok`
          : `Provider check: ${failing.map((c) => PROVIDER_LABEL[c.provider]).join(', ')} failing`,
      count: failing.length,
      payload: { checks, raised },
    },
  });

  return { checks, raised };
}
