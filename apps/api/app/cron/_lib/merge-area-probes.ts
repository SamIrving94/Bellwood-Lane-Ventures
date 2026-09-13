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
 * - EVERY scanned area also gets `lastScannedAt`, the stamp the rotation
 *   sorts on. It is written here and nowhere else — see `lastScannedAtMs`.
 */

export type SeedOutcome = {
  label: string;
  postcode: string;
  listingCount: number;
  error: string | null;
};

type Areaish = Record<string, unknown>;

/**
 * When the SCOUT last scanned this area, as epoch ms — the rotation's sort
 * key. Never-scanned → 0, so a new area sorts to the FRONT of the queue and
 * is picked up by the very next run.
 *
 * Deliberately NOT `lastProbe.checkedAt`. The dashboard writes a lastProbe
 * the moment an area is added (the validation probe that catches a dead
 * seed before it reaches the cron), so sorting on it put every freshly
 * added area at the BACK of the 6-a-day rotation: the founder added a
 * patch, clicked "Run scout now", and that run skipped it. Only the cron
 * writes `lastScannedAt`, so the two stamps can no longer be confused.
 * Areas from before the field existed also read as 0 for one run, which
 * merely reshuffles that run's batch; the merge stamps them from then on.
 */
export function lastScannedAtMs(area: Areaish): number {
  const raw = area.lastScannedAt;
  if (typeof raw !== 'string') return 0;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

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
      return {
        ...a,
        lastScannedAt: nowIso,
        lastProbe: { ...prevLp, checkedAt: nowIso },
      };
    }

    return {
      ...a,
      lastScannedAt: nowIso,
      lastProbe: {
        listingCount: outcome.listingCount,
        checkedAt: nowIso,
        error: outcome.error,
      },
      history: appendHistory(a.history, outcome.listingCount, nowIso),
    };
  });
}
