import { describe, expect, it } from 'vitest';
import {
  type EnrichedLead,
  checkEnrichmentHealth,
  parseBatchDataResponse,
  parseProbateDataResponse,
  summariseEnrichment,
} from '../enrichment';

// These tests lock the *contract* of the two enrichment providers
// (ProbateData.com Tier 1, BatchData Tier 2) so a shape change or a
// malformed/empty response degrades safely instead of throwing — this is the
// highest-leverage funnel component and was previously untested.

describe('parseProbateDataResponse (Tier 1)', () => {
  it('extracts a full contact when found', () => {
    expect(
      parseProbateDataResponse({
        found: true,
        contact: {
          name: 'Jane Executor',
          phone: '+447700900000',
          email: 'jane@example.com',
        },
      })
    ).toEqual({
      contactName: 'Jane Executor',
      contactPhone: '+447700900000',
      contactEmail: 'jane@example.com',
      found: true,
    });
  });

  it('nulls missing fields but still reports found', () => {
    expect(
      parseProbateDataResponse({ found: true, contact: { name: 'Only Name' } })
    ).toEqual({
      contactName: 'Only Name',
      contactPhone: null,
      contactEmail: null,
      found: true,
    });
  });

  it('returns not-found when found:false', () => {
    expect(parseProbateDataResponse({ found: false }).found).toBe(false);
  });

  it('returns not-found when contact is absent', () => {
    expect(parseProbateDataResponse({ found: true }).found).toBe(false);
  });

  it('degrades safely on null/undefined/empty input', () => {
    for (const input of [null, undefined, {} as never]) {
      expect(parseProbateDataResponse(input)).toEqual({
        contactName: null,
        contactPhone: null,
        contactEmail: null,
        found: false,
      });
    }
  });
});

describe('parseBatchDataResponse (Tier 2)', () => {
  it('extracts owner phone/email from the first result', () => {
    expect(
      parseBatchDataResponse({
        results: [
          { owner: { phone: '+447700900111', email: 'owner@example.com' } },
        ],
      })
    ).toEqual({
      contactPhone: '+447700900111',
      contactEmail: 'owner@example.com',
      found: true,
    });
  });

  it('returns not-found when results are empty', () => {
    expect(parseBatchDataResponse({ results: [] }).found).toBe(false);
  });

  it('returns not-found when the owner is missing', () => {
    expect(parseBatchDataResponse({ results: [{}] }).found).toBe(false);
  });

  it('degrades safely on null/undefined input', () => {
    expect(parseBatchDataResponse(null).found).toBe(false);
    expect(parseBatchDataResponse(undefined).found).toBe(false);
  });
});

describe('checkEnrichmentHealth', () => {
  it('reports ok for both tiers when keys are present', () => {
    const h = checkEnrichmentHealth({
      PROBATE_DATA_API_KEY: 'x',
      BATCH_DATA_API_KEY: 'y',
    });
    expect(h).toEqual({
      tier1: 'ok',
      tier2: 'ok',
      configuredTiers: 2,
      degraded: false,
    });
  });

  it('flags a partially-configured cascade', () => {
    const h = checkEnrichmentHealth({ PROBATE_DATA_API_KEY: 'x' });
    expect(h.tier1).toBe('ok');
    expect(h.tier2).toBe('no_key');
    expect(h.configuredTiers).toBe(1);
    expect(h.degraded).toBe(false);
  });

  it('marks the cascade degraded when no automated tier is configured', () => {
    const h = checkEnrichmentHealth({});
    expect(h).toEqual({
      tier1: 'no_key',
      tier2: 'no_key',
      configuredTiers: 0,
      degraded: true,
    });
  });
});

describe('summariseEnrichment', () => {
  const lead = (
    tier: 1 | 2 | 3,
    phone: string | null,
    email: string | null
  ): EnrichedLead => ({
    probateRef: 'ref',
    address: '1 Test St',
    postcode: 'AB1 2CD',
    leadType: 'probate',
    grantDate: '2026-01-01',
    grantType: 'probate',
    daysSinceGrant: 10,
    goldenWindowLabel: 'hot',
    solicitorFirm: null,
    estateValuePence: null,
    contactName: 'X',
    contactPhone: phone,
    contactEmail: email,
    enrichmentTier: tier,
    sourceTrail: 'test',
  });

  it('computes tier distribution and contact hit-rate', () => {
    const summary = summariseEnrichment([
      lead(1, '+44', null),
      lead(2, null, 'a@b.com'),
      lead(3, null, null),
      lead(3, null, null),
    ]);
    expect(summary.total).toBe(4);
    expect(summary.tier1).toBe(1);
    expect(summary.tier2).toBe(1);
    expect(summary.tier3).toBe(2);
    expect(summary.contactHitRate).toBeCloseTo(0.5);
  });

  it('returns a zero hit-rate for an empty batch (no divide-by-zero)', () => {
    expect(summariseEnrichment([])).toEqual({
      total: 0,
      tier1: 0,
      tier2: 0,
      tier3: 0,
      contactHitRate: 0,
    });
  });
});
