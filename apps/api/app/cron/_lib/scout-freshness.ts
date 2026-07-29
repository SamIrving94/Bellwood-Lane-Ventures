/**
 * Scout "new lead flow" telemetry.
 *
 * The scouting cron writes leads with `createMany({ skipDuplicates: true })`
 * against the `address_postcode` unique key. Because the cron rotates through a
 * bounded batch of scan areas and re-scans each area every few days, most runs
 * re-find listings that are ALREADY in the pipeline — those rows are silently
 * dropped. So `qualified: 30, persisted: 0` is a perfectly normal-looking run
 * that delivers the founder nothing new.
 *
 * Two numbers answer "why am I seeing no new properties?":
 *   • qualified — how many leads cleared scoring this run
 *   • persisted — how many of those were actually NEW rows
 *
 * This module holds the pure decision + copy logic for those numbers so it can
 * be unit-tested without a database or a live pipeline run.
 */

/** One run's new-lead outcome, as recorded on the run's AgentEvent payload. */
export type ScoutRunStats = {
  /** Leads that cleared the scorer this run. */
  qualified: number;
  /** Rows actually inserted (qualified minus dedup-dropped). */
  persisted: number;
};

/**
 * A run must qualify at least this many leads before "zero new" counts as dry.
 *
 * A run that qualifies 0–4 leads isn't "spinning" — it's a thin or degraded
 * run, and that failure mode already has its own alert (`scouting-source-error`).
 * We only want to catch the specific pathology where the scout looks busy
 * (a full-looking board of qualified leads) yet adds nothing.
 */
export const DRY_RUN_MIN_QUALIFIED = 5;

/**
 * How many CONSECUTIVE dry runs before we bother the founder.
 *
 * The cron scans MAX_SEEDS_PER_RUN (6) areas per run, oldest-probed first, and
 * rotates. With the current ~16-area list a full sweep of every target area
 * takes ceil(16 / 6) = 3 runs. So:
 *   • 1 dry run  → expected. Those areas were probably scanned 2–3 days ago.
 *   • 2 dry runs → still inside one rotation cycle. Noise.
 *   • 3 dry runs → the scout has covered EVERY area it knows about and added
 *     nothing. That is a real signal: the areas are exhausted, a source has
 *     quietly gone stale, or the scoring threshold is filtering everything new.
 *
 * Three is therefore the smallest streak that can't be explained by rotation.
 */
export const DRY_RUN_STREAK_THRESHOLD = 3;

/**
 * Did this run qualify a meaningful number of leads yet persist none of them?
 */
export const isDryRun = (run: ScoutRunStats): boolean =>
  run.persisted === 0 && run.qualified >= DRY_RUN_MIN_QUALIFIED;

/**
 * Count the leading run of dry runs.
 *
 * `runs` must be newest-first: index 0 is the run that just finished, followed
 * by prior runs read back off the AgentEvent log. Counting stops at the first
 * non-dry run — including runs whose `persisted` we couldn't read (events
 * written before this field existed), which are conservatively treated as
 * "not dry" so a deploy can never manufacture a streak out of old history.
 */
export const countDryStreak = (runs: ScoutRunStats[]): number => {
  let streak = 0;
  for (const run of runs) {
    if (!isDryRun(run)) break;
    streak++;
  }
  return streak;
};

/**
 * Should the "scout is spinning" founder card be raised for this streak?
 */
export const shouldAlertDryStreak = (streak: number): boolean =>
  streak >= DRY_RUN_STREAK_THRESHOLD;

/** Copy for a founder-facing card: `title` is one line, `description` is short. */
export type ActionCopy = { title: string; description: string };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Copy for the daily review card (`dedupKey: 'scout-review-leads'`).
 *
 * The old copy said "Review N new qualified leads" for every run, which was a
 * lie on the (common) runs where N were all duplicates. The founder's real
 * question is "is any of this new?", so `new` leads the headline in all three
 * states: all new / some new / none new.
 */
export const buildReviewActionCopy = (params: {
  qualified: number;
  persisted: number;
  strong: number;
  highScore: number;
}): ActionCopy => {
  const { qualified, persisted, strong, highScore } = params;
  const seenBefore = Math.max(0, qualified - persisted);
  const quality = `${strong} STRONG, ${highScore} scored 70+.`;
  const triage = 'Open Pipeline → Leads to review each: invest / pass / refer.';

  // Nothing new — say so first, and don't dress it up as work to do.
  if (persisted === 0) {
    return {
      title: `${plural(qualified, 'lead')} found — 0 NEW`,
      description: [
        'Every lead this run was **already in your pipeline**. Nothing new to review.',
        `The scout re-scanned areas it has covered before, so all ${qualified} were duplicates.`,
        'If this keeps up, widen the scan areas in Settings → Scouting.',
      ].join('\n\n'),
    };
  }

  // Everything found was new — the healthy case.
  if (seenBefore === 0) {
    return {
      title: `${plural(persisted, 'NEW lead')} to review${highScore ? ` (${highScore} scored 70+)` : ''}`,
      description: [
        `All ${qualified} leads from today's scout run are **new**. ${quality}`,
        triage,
      ].join('\n\n'),
    };
  }

  // Mixed — the usual steady state.
  return {
    title: `${plural(qualified, 'lead')} — ${persisted} NEW${highScore ? ` (${highScore} scored 70+)` : ''}`,
    description: [
      `**${persisted} new**, ${seenBefore} already seen. ${quality}`,
      triage,
    ].join('\n\n'),
  };
};

/**
 * Copy for the deduped "scout is spinning" card (`dedupKey: 'scout-no-new-leads'`).
 *
 * Descriptions are rendered as Markdown on the Actions board, so real list
 * syntax is used rather than bullet glyphs inside a paragraph.
 */
export const buildDryStreakActionCopy = (params: {
  streak: number;
  qualified: number;
}): ActionCopy => {
  const { streak, qualified } = params;
  return {
    title: `Scout found 0 NEW leads for ${plural(streak, 'run')} running`,
    description: [
      `The scout is **working but adding nothing**. The last ${streak} runs all qualified leads (${qualified} today) and persisted **zero** — every one was already in your pipeline.`,
      'It has now swept every scan area at least once with no new stock.',
      'Likely causes:',
      [
        '- **Scan areas exhausted** — add new areas in Settings → Scouting.',
        '- **A source has gone stale** — check the run response / source alerts.',
        '- **Score threshold too tight** — nothing new is clearing it.',
      ].join('\n'),
      'This card clears itself as soon as a run persists a new lead.',
    ].join('\n\n'),
  };
};
