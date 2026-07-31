import { describe, expect, it } from 'vitest';
import {
  applySuggestionChange,
  buildScorerSuggestions,
  nudgeValue,
} from '../calibration-suggestions';
import { dedupeDealbreakerRules } from '../dealbreakers';
import { DEFAULT_SCORER_CONFIG } from '../scorer-config';

describe('nudgeValue', () => {
  it('trims by 25% rounded, minimum 1 point', () => {
    expect(nudgeValue(20, 'trim')).toBe(15);
    expect(nudgeValue(5, 'trim')).toBe(4);
    expect(nudgeValue(2, 'trim')).toBe(1);
  });

  it('raises by 25% rounded, minimum 1 point', () => {
    expect(nudgeValue(20, 'raise')).toBe(25);
    expect(nudgeValue(4, 'raise')).toBe(5);
  });

  it('never goes below zero', () => {
    expect(nudgeValue(1, 'trim')).toBe(0);
    expect(nudgeValue(0, 'trim')).toBe(0);
  });
});

describe('buildScorerSuggestions', () => {
  const config = DEFAULT_SCORER_CONFIG;

  it('maps a scalar factor label to its config knob', () => {
    const [s] = buildScorerSuggestions(
      [
        {
          label: 'Distressed sale signal',
          appearances: 6,
          avgRating: 2.1,
          bias: 'over-weighted',
        },
      ],
      config
    );
    expect(s?.change).toEqual({ kind: 'scalar', key: 'distressBonus' });
    expect(s?.currentValue).toBe(config.distressBonus);
    expect(s?.suggestedValue).toBeLessThan(config.distressBonus);
    expect(s?.direction).toBe('trim');
  });

  it('maps lead-type labels to leadTypeScores', () => {
    const [s] = buildScorerSuggestions(
      [{ label: 'Probate', appearances: 8, avgRating: 4.4, bias: 'under-weighted' }],
      config
    );
    expect(s?.change).toEqual({ kind: 'leadType', key: 'probate' });
    expect(s?.suggestedValue).toBeGreaterThan(config.leadTypeScores.probate!);
  });

  it('maps condition labels to conditionScores slugs', () => {
    const [s] = buildScorerSuggestions(
      [{ label: 'Unmodernised', appearances: 5, avgRating: 2.0, bias: 'over-weighted' }],
      config
    );
    expect(s?.change).toEqual({
      kind: 'condition',
      key: 'unmodernised-properties',
    });
  });

  it('maps days-on-market factor labels back to their band', () => {
    const [s] = buildScorerSuggestions(
      [
        {
          label: 'On market 180+ days (very stale) (204d)',
          appearances: 4,
          avgRating: 2.2,
          bias: 'over-weighted',
        },
      ],
      config
    );
    expect(s?.change).toEqual({
      kind: 'domBand',
      label: 'On market 180+ days (very stale)',
    });
    expect(s?.currentValue).toBe(12);
  });

  it('skips aligned factors and unmappable labels', () => {
    const suggestions = buildScorerSuggestions(
      [
        { label: 'Probate', appearances: 5, avgRating: 3.2, bias: 'aligned' },
        {
          label: 'Some unknown factor',
          appearances: 9,
          avgRating: 1.5,
          bias: 'over-weighted',
        },
      ],
      config
    );
    expect(suggestions).toEqual([]);
  });
});

describe('applySuggestionChange', () => {
  const config = DEFAULT_SCORER_CONFIG;

  it('applies scalar, leadType, condition and band changes immutably', () => {
    const a = applySuggestionChange(config, { kind: 'scalar', key: 'distressBonus' }, 4);
    expect(a.distressBonus).toBe(4);
    expect(config.distressBonus).toBe(5);

    const b = applySuggestionChange(config, { kind: 'leadType', key: 'probate' }, 25);
    expect(b.leadTypeScores.probate).toBe(25);

    const c = applySuggestionChange(
      config,
      { kind: 'condition', key: 'unmodernised-properties' },
      8
    );
    expect(c.conditionScores['unmodernised-properties']).toBe(8);

    const d = applySuggestionChange(
      config,
      { kind: 'domBand', label: 'On market 90+ days (stale)' },
      10
    );
    expect(d.daysOnMarketBands.find((x) => x.label.startsWith('On market 90+'))?.points).toBe(10);
  });

  it('clamps to non-negative integers', () => {
    const a = applySuggestionChange(config, { kind: 'scalar', key: 'velocityMax' }, -3);
    expect(a.velocityMax).toBe(0);
  });
});

describe('dedupeDealbreakerRules', () => {
  it('dedupes case/whitespace-insensitively, keeping first phrasing', () => {
    const rules = dedupeDealbreakerRules([
      'Never buy next to a railway line',
      'never buy next to  a railway line',
      'No flats above shops',
      '  ',
    ]);
    expect(rules).toEqual([
      'Never buy next to a railway line',
      'No flats above shops',
    ]);
  });

  it('caps the rule list', () => {
    const many = Array.from({ length: 40 }, (_, i) => `rule ${i}`);
    expect(dedupeDealbreakerRules(many).length).toBeLessThanOrEqual(20);
  });
});
