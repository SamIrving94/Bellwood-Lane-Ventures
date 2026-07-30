import { describe, expect, test } from 'vitest';
import {
  DRY_RUN_MIN_QUALIFIED,
  DRY_RUN_STREAK_MAX,
  DRY_RUN_STREAK_MIN,
  DRY_RUN_STREAK_THRESHOLD,
  type ScoutRunStats,
  buildDryStreakActionCopy,
  buildReviewActionCopy,
  countDryStreak,
  dryStreakThreshold,
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

describe('dryStreakThreshold', () => {
  // The live rotation batch size in the scouting route.
  const SEEDS = 6;

  test('small area count — one sweep per run, held up by the floor', () => {
    // 1 area sweeps every single run, but one dry run is never enough.
    expect(dryStreakThreshold(1, SEEDS)).toBe(DRY_RUN_STREAK_MIN);
    expect(dryStreakThreshold(6, SEEDS)).toBe(DRY_RUN_STREAK_MIN);
  });

  test('the historical ~16-area list still gives 3 runs', () => {
    expect(dryStreakThreshold(16, SEEDS)).toBe(3);
  });

  test('a bigger list waits for its longer sweep — no false alarm at 3', () => {
    // The regression this function exists for: 30 areas sweep in 5 runs, so
    // alerting after 3 would fire while rotation simply hadn't come round.
    expect(dryStreakThreshold(30, SEEDS)).toBe(5);
    expect(dryStreakThreshold(30, SEEDS)).toBeGreaterThan(
      DRY_RUN_STREAK_THRESHOLD
    );
  });

  test('rounds a partial sweep up', () => {
    // 13 areas = 3 runs (6 + 6 + 1), not 2.
    expect(dryStreakThreshold(13, SEEDS)).toBe(3);
  });

  test('large area count is capped so the alert stays reachable', () => {
    expect(dryStreakThreshold(200, SEEDS)).toBe(DRY_RUN_STREAK_MAX);
    expect(dryStreakThreshold(10_000, SEEDS)).toBe(DRY_RUN_STREAK_MAX);
  });

  test('unknown area count falls back to the constant', () => {
    // The legacy scanSeeds / env path doesn't rotate through scouting.areas.
    expect(dryStreakThreshold(null, SEEDS)).toBe(DRY_RUN_STREAK_THRESHOLD);
    expect(dryStreakThreshold(undefined, SEEDS)).toBe(DRY_RUN_STREAK_THRESHOLD);
  });

  test('nonsense inputs fall back rather than producing a silly threshold', () => {
    expect(dryStreakThreshold(0, SEEDS)).toBe(DRY_RUN_STREAK_THRESHOLD);
    expect(dryStreakThreshold(-5, SEEDS)).toBe(DRY_RUN_STREAK_THRESHOLD);
    expect(dryStreakThreshold(Number.NaN, SEEDS)).toBe(
      DRY_RUN_STREAK_THRESHOLD
    );
    expect(dryStreakThreshold(16, 0)).toBe(DRY_RUN_STREAK_THRESHOLD);
    expect(dryStreakThreshold(16, null)).toBe(DRY_RUN_STREAK_THRESHOLD);
    expect(dryStreakThreshold(16, Number.POSITIVE_INFINITY)).toBe(
      DRY_RUN_STREAK_THRESHOLD
    );
  });

  test('the fallback constant sits inside the clamps', () => {
    expect(DRY_RUN_STREAK_THRESHOLD).toBeGreaterThanOrEqual(DRY_RUN_STREAK_MIN);
    expect(DRY_RUN_STREAK_THRESHOLD).toBeLessThanOrEqual(DRY_RUN_STREAK_MAX);
  });

  test('never returns below the floor for any plausible config', () => {
    for (let areas = 1; areas <= 300; areas++) {
      const t = dryStreakThreshold(areas, SEEDS);
      expect(t).toBeGreaterThanOrEqual(DRY_RUN_STREAK_MIN);
      expect(t).toBeLessThanOrEqual(DRY_RUN_STREAK_MAX);
    }
  });
});

describe('shouldAlertDryStreak', () => {
  test('does not alert below the threshold — rotation explains short streaks', () => {
    for (let s = 0; s < DRY_RUN_STREAK_THRESHOLD; s++) {
      expect(shouldAlertDryStreak(s, DRY_RUN_STREAK_THRESHOLD)).toBe(false);
    }
  });

  test('alerts at and above the threshold', () => {
    expect(
      shouldAlertDryStreak(DRY_RUN_STREAK_THRESHOLD, DRY_RUN_STREAK_THRESHOLD)
    ).toBe(true);
    expect(
      shouldAlertDryStreak(
        DRY_RUN_STREAK_THRESHOLD + 5,
        DRY_RUN_STREAK_THRESHOLD
      )
    ).toBe(true);
  });

  test('honours a threshold derived from a bigger area list', () => {
    const big = dryStreakThreshold(30, 6); // 5
    expect(shouldAlertDryStreak(3, big)).toBe(false);
    expect(shouldAlertDryStreak(4, big)).toBe(false);
    expect(shouldAlertDryStreak(5, big)).toBe(true);
  });

  test('honours a threshold derived from a tiny area list', () => {
    const small = dryStreakThreshold(3, 6); // clamped to the floor
    expect(shouldAlertDryStreak(1, small)).toBe(false);
    expect(shouldAlertDryStreak(2, small)).toBe(true);
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
