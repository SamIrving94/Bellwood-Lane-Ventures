'use server';

import { getCronSecret } from '@/lib/cron-secret';
import { getFounderSession } from '@repo/auth/server';
import { revalidatePath } from 'next/cache';

export type DraftGuideNowResult =
  | {
      ok: true;
      /** Still running on the api side; the card lands when it finishes. */
      started: true;
    }
  | {
      ok: true;
      started: false;
      drafted: boolean;
      /** Null when drafted but the GuidePost row could not be saved. */
      guidePostId: string | null;
      questionKey: string | null;
      signals: number;
      pickFallback: boolean;
      draftError: string | null;
      failedSources: string[];
    }
  | { ok: false; error: string };

type CronResponse = {
  signals?: number;
  reports?: Array<{ source: string; ok: boolean; note?: string }>;
  picks?: Array<{ key: string }>;
  pickFallback?: boolean;
  drafted?: boolean;
  draftError?: string | null;
  guidePostId?: string | null;
};

/**
 * "Draft a guide now" — runs the Saturday guide-research cron on demand.
 *
 * Founder ask (10 Oct 2026): the pipeline shipped on 3 Oct two hours after
 * that Saturday's 06:00 slot, so there was no way to see a draft without
 * waiting a week. Same route, same CRON_SECRET auth as the schedule, and
 * it still NEVER publishes: the result is a draft card like any other.
 *
 * A run is feeds + one pick call + the drafter's two calls, usually one to
 * three minutes. The guides page sets maxDuration = 300 so this waits for
 * the answer; if it still times out the api function carries on and the
 * card lands in the Queue when it finishes.
 */
export async function draftGuideNow(): Promise<DraftGuideNowResult> {
  const session = await getFounderSession();
  if (!session) return { ok: false, error: 'Unauthorized' };

  const cronSecret = getCronSecret();
  if (!cronSecret) return { ok: false, error: 'CRON_SECRET not configured' };

  try {
    const res = await fetch(
      'https://bellwood-api.vercel.app/cron/guide-research',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${cronSecret}` },
        signal: AbortSignal.timeout(280_000),
      }
    );
    if (!res.ok) {
      return { ok: false, error: `Guide run returned HTTP ${res.status}` };
    }
    const r = (await res.json().catch(() => ({}))) as CronResponse;
    revalidatePath('/marketing/queue');
    revalidatePath('/marketing/guides');
    return {
      ok: true,
      started: false,
      drafted: r.drafted === true,
      guidePostId: r.guidePostId ?? null,
      questionKey: r.picks?.[0]?.key ?? null,
      signals: r.signals ?? 0,
      pickFallback: r.pickFallback === true,
      draftError: r.draftError ?? null,
      failedSources: (r.reports ?? [])
        .filter((s) => !s.ok)
        .map((s) => (s.note ? `${s.source} (${s.note})` : s.source)),
    };
  } catch (err) {
    if ((err as Error).name === 'TimeoutError') {
      return { ok: true, started: true };
    }
    return {
      ok: false,
      error: `Could not reach the guide run: ${(err as Error).message}`,
    };
  }
}
