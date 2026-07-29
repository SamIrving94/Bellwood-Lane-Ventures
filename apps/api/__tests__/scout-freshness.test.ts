import { describe, expect, test } from 'vitest';
import {
  DRY_RUN_MIN_QUALIFIED,
  DRY_RUN_STREAK_THRESHOLD,
  type ScoutRunStats,
  buildDryStreakActionCopy,
  buildReviewActionCopy,
  countDryStreak,
  isDryRun,
  shouldAlertDryStreak,
} from '../app/cron/_lib/scout-freshness';

const run = (qualified: number, persisted: number): ScoutRunStats => ({
  qualified,
  persisted,
});

describe('isDryRun', () => {
  test('a busy run that persists nothing is dry', () => {
    expect(isDryRun(run(30, 0))).toBe(true);
  });

  test('a run that persists even one lead is not dry', () => {
    expect(isDryRun(run(30, 1))).toBe(false);
  });

  test('a thin run is not dry — that is a source problem, alerted elsewhere', () => {
    expect(isDryRun(run(DRY_RUN_MIN_QUALIFIED - 1, 0))).toBe(false);
    expect(isDryRun(run(0, 0))).toBe(false);
  });

  test('the qualified threshold is inclusive', () => {
    expect(isDryRun(run(DRY_RUN_MIN_QUALIFIED, 0))).toBe(true);
  });
});

describe('countDryStreak', () => {
  test('counts consecutive dry runs from the newest end', () => {
    expect(countDryStreak([run(30, 0), run(28, 0), run(31, 0)])).toBe(3);
  });

  test('stops at the first run that persisted something', () => {
    expect(countDryStreak([run(30, 0), run(28, 4), run(31, 0)])).toBe(1);
  });

  test('a healthy latest run means no streak at all', () => {
    expect(countDryStreak([run(30, 12), run(28, 0), run(31, 0)])).toBe(0);
  });

  test('unknown history (persisted 0 / qualified 0) breaks the streak', () => {
    // Events written before `persisted` existed are mapped to 0/0 by the
    // route — they must not be able to manufacture a streak on deploy day.
    expect(countDryStreak([run(30, 0), run(0, 0), run(0, 0)])).toBe(1);
  });

  test('empty history is not a streak', () => {
    expect(countDryStreak([])).toBe(0);
  });
});

describe('shouldAlertDryStreak', () => {
  test('does not alert below the threshold — rotation explains short streaks', () => {
    for (let s = 0; s < DRY_RUN_STREAK_THRESHOLD; s++) {
      expect(shouldAlertDryStreak(s)).toBe(false);
    }
  });

  test('alerts at and above the threshold', () => {
    expect(shouldAlertDryStreak(DRY_RUN_STREAK_THRESHOLD)).toBe(true);
    expect(shouldAlertDryStreak(DRY_RUN_STREAK_THRESHOLD + 5)).toBe(true);
  });
});

describe('buildReviewActionCopy', () => {
  test('none new — leads with the zero, does not claim work to do', () => {
    const copy = buildReviewActionCopy({
      qualified: 30,
      persisted: 0,
      strong: 4,
      highScore: 11,
    });
    expect(copy.title).toBe('30 leads found — 0 NEW');
    expect(copy.description).toContain('already in your pipeline');
    expect(copy.description).toContain('Nothing new to review');
    // Must not tell the founder to go and triage nothing.
    expect(copy.description).not.toContain('invest / pass / refer');
  });

  test('all new — says so and sends the founder to triage', () => {
    const copy = buildReviewActionCopy({
      qualified: 30,
      persisted: 30,
      strong: 4,
      highScore: 11,
    });
    expect(copy.title).toBe('30 NEW leads to review (11 scored 70+)');
    expect(copy.description).toContain('All 30 leads');
    expect(copy.description).toContain('4 STRONG, 11 scored 70+');
    expect(copy.description).toContain('invest / pass / refer');
  });

  test('all new with no high scorers omits the empty parenthetical', () => {
    const copy = buildReviewActionCopy({
      qualified: 6,
      persisted: 6,
      strong: 0,
      highScore: 0,
    });
    expect(copy.title).toBe('6 NEW leads to review');
  });

  test('mixed — splits new from already seen', () => {
    const copy = buildReviewActionCopy({
      qualified: 30,
      persisted: 8,
      strong: 1,
      highScore: 3,
    });
    expect(copy.title).toBe('30 leads — 8 NEW (3 scored 70+)');
    expect(copy.description).toContain('**8 new**, 22 already seen');
  });

  test('singulars read correctly', () => {
    expect(
      buildReviewActionCopy({
        qualified: 1,
        persisted: 1,
        strong: 0,
        highScore: 0,
      }).title
    ).toBe('1 NEW lead to review');
    expect(
      buildReviewActionCopy({
        qualified: 1,
        persisted: 0,
        strong: 0,
        highScore: 0,
      }).title
    ).toBe('1 lead found — 0 NEW');
  });

  test('the three states produce visibly different titles', () => {
    const base = { qualified: 30, strong: 2, highScore: 5 };
    const titles = new Set(
      [0, 8, 30].map(
        (persisted) => buildReviewActionCopy({ ...base, persisted }).title
      )
    );
    expect(titles.size).toBe(3);
  });
});

describe('buildDryStreakActionCopy', () => {
  test('names the streak and promises self-healing', () => {
    const copy = buildDryStreakActionCopy({ streak: 3, qualified: 30 });
    expect(copy.title).toBe('Scout found 0 NEW leads for 3 runs running');
    expect(copy.description).toContain('working but adding nothing');
    expect(copy.description).toContain('30 today');
    expect(copy.description).toContain('clears itself');
  });
});
