import { describe, expect, it } from 'vitest';
import type { EnrichedLead } from '../enrichment';
import { goldenWindowLabel } from '../probate-data';
import {
  isEnteringHighPropensityWindow,
  propensityForLeadType,
  recommendedTouchSchedule,
} from '../propensity';
import { scoreLead } from '../scorer';
import { DEFAULT_SCORER_CONFIG, mergeScorerConfig } from '../scorer-config';

function probateLead(overrides: Partial<EnrichedLead> = {}): EnrichedLead {
  return {
    probateRef: 'gazette-prop-1',
    address: '4 Chapel Row',
    postcode: 'M20 3AA',
    leadType: 'probate',
    grantDate: '2026-06-01',
    grantType: 'probate',
    daysSinceGrant: 5,
    goldenWindowLabel: 'cold',
    solicitorFirm: null,
    estateValuePence: null,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    enrichmentTier: 3,
    sourceTrail: 'gazette → tier3/manual',
    ...overrides,
  };
}

describe('propensityForLeadType — probate (t=0 = Gazette s.27 notice)', () => {
  it('is near-zero in weeks 0–6 (executor lacks legal authority)', () => {
    for (const day of [0, 10, 30, 42]) {
      const p = propensityForLeadType('probate', day);
      expect(p.hasCurve).toBe(true);
      expect(p.value).toBeLessThanOrEqual(0.1);
      expect(p.label).toMatch(/pre-grant/i);
    }
  });

  it('rises sharply through weeks 8–16 into the grant window', () => {
    const wk8 = propensityForLeadType('probate', 56);
    const wk12 = propensityForLeadType('probate', 84);
    const wk16 = propensityForLeadType('probate', 112);
    expect(wk8.value).toBeGreaterThan(0.3);
    expect(wk12.value).toBeGreaterThan(wk8.value);
    expect(wk16.value).toBe(1);
    expect(wk8.label).toMatch(/grant window/i);
  });

  it('plateaus through months 6–9 then decays', () => {
    const m6 = propensityForLeadType('probate', 180);
    const m9 = propensityForLeadType('probate', 270);
    const m12 = propensityForLeadType('probate', 365);
    const m24 = propensityForLeadType('probate', 730);
    expect(m6.value).toBeGreaterThanOrEqual(0.8);
    expect(m9.value).toBeGreaterThanOrEqual(0.75);
    expect(m12.value).toBeLessThan(m9.value);
    expect(m24.value).toBeLessThanOrEqual(0.2);
  });

  it('CALIBRATION CAVEAT: the curve shape is a statutory prior, not measured', () => {
    // The probate t=0 anchor is the Gazette s.27 notice date, and a notice
    // may be placed before OR after the Grant of Probate. Until the shape is
    // verified against our own daysSinceSignal-at-conversion data (logged by
    // the lead→deal conversion path as an AgentEvent), treat the breakpoints
    // as tunable priors — they live in ScorerConfig.propensityCurves so the
    // founder can retune them from EvalConfig without a deploy. This test
    // exists to carry that caveat and to pin the tunability contract.
    const tuned = mergeScorerConfig({
      propensityCurves: {
        probate: [
          { day: 0, value: 0.5, label: 'Recalibrated' },
          { day: 100, value: 1, label: 'Recalibrated peak' },
        ],
      },
    });
    expect(propensityForLeadType('probate', 0, tuned).value).toBe(0.5);
    expect(propensityForLeadType('probate', 100, tuned).value).toBe(1);
    // Other curves survive a partial override untouched.
    expect(propensityForLeadType('receivership', 0, tuned).value).toBe(1);
  });
});

describe('propensityForLeadType — insolvency (t=0 = appointment/filing)', () => {
  it('has two peaks: week 3 and the week-8 statutory proposal deadline', () => {
    const wk3 = propensityForLeadType('insolvency', 21);
    const wk5 = propensityForLeadType('insolvency', 35);
    const wk8 = propensityForLeadType('insolvency', 56);
    expect(wk3.value).toBeGreaterThan(wk5.value); // local peak at week 3
    expect(wk8.value).toBe(1); // statutory deadline is the global peak
    expect(wk8.label).toMatch(/statutory proposals/i);
  });

  it('tails off toward the 12-month administration cap', () => {
    const m10 = propensityForLeadType('insolvency', 300);
    const m12 = propensityForLeadType('insolvency', 365);
    expect(m10.value).toBeLessThan(0.5);
    expect(m12.value).toBeLessThanOrEqual(0.2);
  });
});

describe('propensityForLeadType — receivership (no statutory clock)', () => {
  it('is monotone decay from appointment (LPA 1925 has no sale deadline)', () => {
    const days = [0, 30, 90, 180, 270, 365, 500];
    const values = days.map(
      (d) => propensityForLeadType('receivership', d).value
    );
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeLessThanOrEqual(values[i - 1]!);
    }
    expect(values[0]).toBe(1); // hottest immediately — receiver must sell
  });
});

describe('propensityForLeadType — edges', () => {
  it('returns hasCurve: false for lead types with no statutory clock', () => {
    // distressed_sale is listing-derived (its "days since" is days-on-market)
    // and mortgage_default is a charge, not a filing — neither has a curve.
    for (const type of [
      'distressed_sale',
      'mortgage_default',
      'chain_break',
      'unknown',
    ]) {
      expect(propensityForLeadType(type, 60).hasCurve).toBe(false);
    }
  });

  it('clamps negative / non-finite days instead of throwing', () => {
    expect(propensityForLeadType('probate', -3).value).toBe(0.05);
    expect(propensityForLeadType('probate', Number.NaN).value).toBe(0.05);
  });

  it('holds the last value beyond the end of the curve', () => {
    const far = propensityForLeadType('receivership', 10_000);
    expect(far.value).toBe(0.15);
  });

  it('normalises lead-type spelling like the scorer does', () => {
    expect(propensityForLeadType('Probate Admin', 84).hasCurve).toBe(true);
  });
});

describe('mergeScorerConfig — propensity fields degrade safely', () => {
  it('keeps the researched default when an override curve is malformed', () => {
    const merged = mergeScorerConfig({
      propensityCurves: {
        probate: [{ day: 'soon', value: 2 }], // invalid row → whole curve rejected
        receivership: 'not-an-array',
      },
      propensityMax: 'lots',
    });
    expect(merged.propensityCurves.probate).toEqual(
      DEFAULT_SCORER_CONFIG.propensityCurves.probate
    );
    expect(merged.propensityCurves.receivership).toEqual(
      DEFAULT_SCORER_CONFIG.propensityCurves.receivership
    );
    expect(merged.propensityMax).toBe(DEFAULT_SCORER_CONFIG.propensityMax);
  });

  it('sorts and clamps a valid override curve', () => {
    const merged = mergeScorerConfig({
      propensityCurves: {
        probate: [
          { day: 100, value: 1.7, label: 'peak' },
          { day: 0, value: -0.5, label: 'start' },
        ],
      },
    });
    expect(merged.propensityCurves.probate).toEqual([
      { day: 0, value: 0, label: 'start' },
      { day: 100, value: 1, label: 'peak' },
    ]);
  });
});

describe('scoring integration — propensity NEVER gates capture', () => {
  it('adds ZERO points (visible, neutral) for a fresh probate notice', () => {
    const b = scoreLead(probateLead({ daysSinceGrant: 5 }), null, null, {});
    const factor = b.factors.find((f) => /pre-grant/i.test(f.label));
    expect(factor).toBeDefined();
    expect(factor?.points).toBe(0);
    expect(factor?.tone).toBe('neutral');
  });

  it('a fresh probate lead scores no lower than before the curve existed', () => {
    // The factor is additive-only: day-5 total must equal a config with the
    // curve stripped out entirely (i.e. pre-feature behaviour).
    const withCurve = scoreLead(
      probateLead({ daysSinceGrant: 5 }),
      null,
      null,
      {}
    );
    const noCurves = {
      ...DEFAULT_SCORER_CONFIG,
      propensityCurves: {},
    };
    const withoutCurve = scoreLead(
      probateLead({ daysSinceGrant: 5 }),
      null,
      null,
      {},
      noCurves
    );
    expect(withCurve.total).toBe(withoutCurve.total);
    expect(withCurve.sourcingScore).toBe(withoutCurve.sourcingScore);
  });

  it('credits the grant window with a labelled acquisition factor', () => {
    const early = scoreLead(probateLead({ daysSinceGrant: 5 }), null, null, {});
    const inWindow = scoreLead(
      probateLead({ daysSinceGrant: 112 }),
      null,
      null,
      {}
    );
    expect(inWindow.total).toBe(
      early.total + DEFAULT_SCORER_CONFIG.propensityMax
    );
    const factor = inWindow.factors.find((f) =>
      /grant window — estate can now sell/i.test(f.label)
    );
    expect(factor?.dimension).toBe('acquisition');
    expect(factor?.points).toBe(DEFAULT_SCORER_CONFIG.propensityMax);
  });

  it('does not misapply the curve to listing-derived lead types', () => {
    // A chain-break listing 112 days on market must NOT collect grant-window
    // credit — its daysSinceGrant is days-on-market, not a statutory clock.
    const b = scoreLead(
      probateLead({ leadType: 'chain_break', daysSinceGrant: 112 }),
      null,
      null,
      {}
    );
    expect(b.factors.some((f) => /grant window/i.test(f.label))).toBe(false);
  });
});

describe('goldenWindowLabel — reconciled with the statutory timeline', () => {
  it('fresh notices are COLD (was hot — that was backwards)', () => {
    expect(goldenWindowLabel(5)).toBe('cold');
    expect(goldenWindowLabel(30)).toBe('cold');
  });

  it('the grant window is hot; late estates cool back down', () => {
    expect(goldenWindowLabel(112)).toBe('hot');
    expect(goldenWindowLabel(200)).toBe('hot');
    expect(goldenWindowLabel(365)).toBe('cool');
    expect(goldenWindowLabel(700)).toBe('cold');
  });
});

describe('isEnteringHighPropensityWindow — the resurfacing trigger', () => {
  it('fires exactly when a probate lead crosses the high threshold', () => {
    // Threshold 0.75 sits on the day 56→112 rise (0.45→1.0): crossed at ~day 87.
    expect(isEnteringHighPropensityWindow('probate', 30)).toBe(false); // pre-grant
    expect(isEnteringHighPropensityWindow('probate', 90)).toBe(true); // just crossed
    expect(isEnteringHighPropensityWindow('probate', 150)).toBe(false); // already in
  });

  it('never fires for a receivership (born at peak, only decays)', () => {
    for (const day of [0, 7, 30, 90, 365]) {
      expect(isEnteringHighPropensityWindow('receivership', day)).toBe(false);
    }
  });

  it('never fires for curveless lead types', () => {
    expect(isEnteringHighPropensityWindow('chain_break', 90)).toBe(false);
  });
});

describe('recommendedTouchSchedule', () => {
  it('probate: soft intro at notice, direct approach weeks 10–14', () => {
    const steps = recommendedTouchSchedule('probate');
    expect(steps).not.toBeNull();
    expect(steps![0]!.touch).toMatch(/soft intro/i);
    expect(steps![1]!.timing).toMatch(/weeks 10–14/i);
  });

  it('returns null for lead types with no statutory timeline', () => {
    expect(recommendedTouchSchedule('chain_break')).toBeNull();
    expect(recommendedTouchSchedule('unknown')).toBeNull();
  });
});
