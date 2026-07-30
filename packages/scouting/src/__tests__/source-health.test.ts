import { describe, expect, it } from 'vitest';
import {
  DISCOVERY_SOURCES,
  buildSourceHealth,
  summariseSourceHealth,
} from '../source-health';

/** Every key the pipeline's sources can require, all present. */
const FULL_ENV = {
  HMCTS_PROBATE_API_KEY: 'k',
  COMPANIES_HOUSE_API_KEY: 'k',
  PROPERTYDATA_API_KEY: 'k',
};

/** The production config as observed on 2026-07-29: only PropertyData is set. */
const PROD_ENV_AS_FOUND = { PROPERTYDATA_API_KEY: 'k' };

function healthFor(
  env: Record<string, string | undefined>,
  overrides: Partial<Parameters<typeof buildSourceHealth>[0]> = {}
) {
  return buildSourceHealth({
    counts: {},
    errors: {},
    env,
    ...overrides,
  });
}

describe('buildSourceHealth', () => {
  it('reports a source with all keys present and no error as ok', () => {
    const health = healthFor(FULL_ENV, { counts: { propertydata: 12 } });
    const pd = health.find((h) => h.key === 'propertydata');
    expect(pd?.status).toBe('ok');
    expect(pd?.count).toBe(12);
  });

  it('flags a missing API key as not_configured, naming the key', () => {
    const health = healthFor(PROD_ENV_AS_FOUND);
    const hmcts = health.find((h) => h.key === 'hmcts');
    expect(hmcts?.status).toBe('not_configured');
    expect(hmcts?.detail).toContain('HMCTS_PROBATE_API_KEY');
  });

  it('catches the silent-empty source that never reaches sourceErrors', () => {
    // The regression this module exists for: fetchProbateGrants swallows its
    // own error and returns [], so HMCTS contributes 0 leads and 0 errors.
    // Health must still mark it dark.
    const health = buildSourceHealth({
      counts: { hmcts: 0 },
      errors: {}, // <- nothing thrown, nothing recorded
      env: PROD_ENV_AS_FOUND,
    });
    expect(health.find((h) => h.key === 'hmcts')?.status).toBe(
      'not_configured'
    );
  });

  it('reports a thrown error when the key is present', () => {
    const health = healthFor(FULL_ENV, {
      errors: { gazette: 'Gazette list HTTP 500' },
    });
    const gazette = health.find((h) => h.key === 'gazette');
    expect(gazette?.status).toBe('error');
    expect(gazette?.detail).toBe('Gazette list HTTP 500');
  });

  it('prefers not_configured over error — the key is the root cause', () => {
    const health = healthFor(PROD_ENV_AS_FOUND, {
      errors: { chDistress: 'COMPANIES_HOUSE_API_KEY not configured' },
    });
    expect(health.find((h) => h.key === 'chDistress')?.status).toBe(
      'not_configured'
    );
  });

  it('prefers skipped over not_configured — a skipped source needs no key', () => {
    // Sending the founder to configure a source that still would not run is
    // worse than saying nothing.
    const health = healthFor(PROD_ENV_AS_FOUND, { skipped: ['dissolved'] });
    const dissolved = health.find((h) => h.key === 'dissolved');
    expect(dissolved?.status).toBe('skipped');
    expect(dissolved?.detail).not.toContain('COMPANIES_HOUSE_API_KEY');
  });
});

describe('summariseSourceHealth', () => {
  it('counts core sources, not total sources, in the headline', () => {
    // Total counts flatter the situation: the optional PropertyData extras
    // share a key with the one source that works, so a total-based headline
    // reads far healthier than the funnel actually is.
    const summary = summariseSourceHealth(healthFor(PROD_ENV_AS_FOUND));
    expect(summary.live).toBe(5); // gazette + propertydata + planning/hmo/shortLease
    expect(summary.headline).toBe('2 of 4 core discovery sources live');
  });

  it('reproduces the live production state and flags it as degraded', () => {
    const summary = summariseSourceHealth(
      buildSourceHealth({
        counts: { propertydata: 122 },
        errors: { gazette: 'Gazette list HTTP 500' },
        skipped: ['planning', 'hmo', 'dissolved', 'shortLease'],
        env: PROD_ENV_AS_FOUND,
      })
    );
    // PropertyData live; HMCTS + Companies House unset; Gazette 500ing.
    expect(summary.coreLive).toBe(1);
    expect(summary.allCoreDark).toBe(false);
    expect(summary.missingKeys).toEqual([
      'COMPANIES_HOUSE_API_KEY',
      'HMCTS_PROBATE_API_KEY',
    ]);
  });

  it('sets allCoreDark when nothing carrying distress signal is live', () => {
    // The Gazette needs no API key, so an empty env alone does not darken it —
    // it has to actually fail. This is the genuine worst case: every distress
    // source down while the run may still return a full batch of listings.
    const summary = summariseSourceHealth(
      buildSourceHealth({
        counts: {},
        errors: { gazette: 'Gazette list HTTP 500' },
        env: {},
      })
    );
    expect(summary.allCoreDark).toBe(true);
    expect(summary.coreLive).toBe(0);
  });

  it('dedupes and sorts the missing keys for a single actionable list', () => {
    const summary = summariseSourceHealth(healthFor({}));
    // COMPANIES_HOUSE_API_KEY backs two sources; it must appear once.
    expect(summary.missingKeys).toEqual([
      'COMPANIES_HOUSE_API_KEY',
      'HMCTS_PROBATE_API_KEY',
      'PROPERTYDATA_API_KEY',
    ]);
  });

  it('emits one readable line per source', () => {
    const summary = summariseSourceHealth(
      healthFor(FULL_ENV, { counts: { propertydata: 1 } })
    );
    expect(summary.lines).toHaveLength(DISCOVERY_SOURCES.length);
    expect(summary.lines.some((l) => l.includes('1 lead'))).toBe(true);
  });

  it('reports everything live when fully configured', () => {
    const summary = summariseSourceHealth(healthFor(FULL_ENV));
    expect(summary.dark).toBe(0);
    expect(summary.missingKeys).toEqual([]);
    expect(summary.allCoreDark).toBe(false);
  });
});
