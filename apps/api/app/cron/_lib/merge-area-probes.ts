/**
 * Merge a scout run's per-seed outcomes back onto the stored scouting areas.
 *
 * Pure and exported so the truth-keeping is testable without a cron run.
 *
 * Before this existed the rotation stamp merged ONLY `checkedAt` into
 * `lastProbe`, so an area that failed once showed its stale error string
 * under an ever-fresh timestamp — and an area that had recovered kept
 * displaying an error the cron had already disproven every morning. The
 * SW3 incident sat behind exactly that: a dead seed's 422 looked recent
 * forever, and nothing the cron learned ever corrected the row.
 *
 * Rules:
 * - Scanned area WITH an outcome: full, truthful lastProbe — count written,
 *   error set on failure and CLEARED on success — plus a history point.
 * - Scanned area WITHOUT an outcome (defensive; should not happen): stamp
 *   `checkedAt` only, exactly the old behaviour, so rotation still advances.
 * - Area not scanned this run: untouched.
 */

export type SeedOutcome = {
  label: string;
  postcode: string;
  listingCount: number;
  error: string | null;
};

type Areaish = Record<string, unknown>;

function normalisePc(pc: unknown): string {
  return typeof pc === 'string' ? pc.toUpperCase().replace(/\s+/g, '') : '';
}

function appendHistory(
  current: unknown,
  count: number,
  dateIso: string
): Array<{ date: string; count: number }> {
  const today = dateIso.slice(0, 10);
  const prev = Array.isArray(current)
    ? (current as Array<{ date: string; count: number }>).filter(
        (h) => h && typeof h === 'object' && h.date !== today
      )
    : [];
  return [...prev, { date: today, count }].slice(-30);
}

export function mergeAreaProbes(
  areasRaw: Areaish[],
  selectedAreaIds: string[],
  outcomes: SeedOutcome[],
  nowIso: string
): Areaish[] {
  const byPostcode = new Map<string, SeedOutcome>();
  for (const o of outcomes) {
    byPostcode.set(normalisePc(o.postcode), o);
  }

  return areasRaw.map((a) => {
    const id =
      typeof a.id === 'string'
        ? a.id
        : typeof a.seedPostcode === 'string'
          ? a.seedPostcode
          : null;
    if (!id || !selectedAreaIds.includes(id)) {
      return a;
    }

    const outcome = byPostcode.get(normalisePc(a.seedPostcode));
    if (!outcome) {
      // Rotation must still advance even if the pipeline never reached this
      // seed, but we have learned nothing about it — do not invent a result.
      const prevLp =
        a.lastProbe && typeof a.lastProbe === 'object'
          ? (a.lastProbe as Record<string, unknown>)
          : {};
      return { ...a, lastProbe: { ...prevLp, checkedAt: nowIso } };
    }

    return {
      ...a,
      lastProbe: {
        listingCount: outcome.listingCount,
        checkedAt: nowIso,
        error: outcome.error,
      },
      history: appendHistory(a.history, outcome.listingCount, nowIso),
    };
  });
}
