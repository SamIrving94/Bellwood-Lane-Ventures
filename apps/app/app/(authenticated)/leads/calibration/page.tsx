import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { buildScorerSuggestions, mergeScorerConfig } from '@repo/scouting';
import {
  THEME_LABELS,
  type FeedbackInsights,
  type InsightTheme,
} from '@/lib/feedback/insight-schema';
import { Header } from '../../components/header';
import { SuggestionCards } from './suggestion-cards';

export const metadata: Metadata = {
  title: 'Scorer calibration — Bellwood Ventures',
  description:
    'How well the lead scorer matches founder judgement, and where to tune.',
};

export const dynamic = 'force-dynamic';

type FactorRow = {
  label: string;
  appearances: number;
  avgRating: number;
  highRatings: number;
  lowRatings: number;
  bias: 'over-weighted' | 'under-weighted' | 'aligned';
};

const CalibrationPage = async () => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const feedback = await database.founderFeedback.findMany({
    where: {
      targetType: 'scout_lead',
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Which scorer config is live? The cron loads the highest active
  // lead_scoring EvalConfig and stamps its version on every lead it scores.
  const activeConfig = await database.evalConfig.findFirst({
    where: { evalType: 'lead_scoring', activatedAt: { not: null } },
    orderBy: { version: 'desc' },
    select: {
      version: true,
      description: true,
      activatedAt: true,
      config: true,
    },
  });

  // Aggregate: scorer vs founder agreement
  let agree = 0;
  let disagreeHigh = 0; // founder rated higher than scorer
  let disagreeLow = 0; // founder rated lower than scorer
  let deltaSum = 0; // founder-implied score - scorer total
  let deltaCount = 0;

  // Per-factor stats
  const factorStats = new Map<
    string,
    { appearances: number; ratingSum: number; highCount: number; lowCount: number }
  >();

  type ContextSnapshot = {
    scorerScore?: number;
    scorerVerdict?: string;
    source?: string;
    listingType?: string | null;
    scoreFactors?: Array<{ label: string; points: number; dimension?: string }>;
  };

  for (const f of feedback) {
    const overrides = (f.overrides ?? {}) as Record<string, unknown>;
    const ctx = (overrides._context ?? null) as ContextSnapshot | null;
    if (!ctx?.scorerScore && !Array.isArray(ctx?.scoreFactors)) continue;

    // Map 1-5 star rating to a notional 0-100 scale for delta
    const founderImplied = ((f.rating - 1) / 4) * 100;
    const scorerScore = ctx.scorerScore ?? 0;
    const delta = founderImplied - scorerScore;
    deltaSum += delta;
    deltaCount += 1;

    if (Math.abs(delta) < 15) agree += 1;
    else if (delta > 0) disagreeHigh += 1;
    else disagreeLow += 1;

    for (const factor of ctx.scoreFactors ?? []) {
      const slot = factorStats.get(factor.label) ?? {
        appearances: 0,
        ratingSum: 0,
        highCount: 0,
        lowCount: 0,
      };
      slot.appearances += 1;
      slot.ratingSum += f.rating;
      if (f.rating >= 4) slot.highCount += 1;
      if (f.rating <= 2) slot.lowCount += 1;
      factorStats.set(factor.label, slot);
    }
  }

  const factorRows: FactorRow[] = Array.from(factorStats.entries())
    .map(([label, s]) => {
      const avg = s.appearances ? s.ratingSum / s.appearances : 0;
      const bias =
        avg <= 2.5
          ? 'over-weighted' // scorer trusts this factor but founders rate the leads low
          : avg >= 4
            ? 'under-weighted' // scorer trusts this but founders rate even higher — could lean in
            : 'aligned';
      return {
        label,
        appearances: s.appearances,
        avgRating: avg,
        highRatings: s.highCount,
        lowRatings: s.lowCount,
        bias,
      } satisfies FactorRow;
    })
    .filter((r) => r.appearances >= 3) // statistical noise floor
    .sort((a, b) => b.appearances - a.appearances);

  const total = agree + disagreeHigh + disagreeLow;
  const agreementPct = total > 0 ? Math.round((agree / total) * 100) : 0;
  const avgDelta = deltaCount > 0 ? deltaSum / deltaCount : 0;

  // One-click tuning: map biased factors back to their config knobs and
  // propose specific new values (evidence + Apply button, never automatic).
  const suggestions = buildScorerSuggestions(
    factorRows,
    mergeScorerConfig(activeConfig?.config ?? null),
  );

  // ── Taste profile — aggregate the structured insights mined from notes
  // and voice-note transcripts (overrides._insights). Per theme: how often
  // it was liked vs disliked, with the freshest supporting quote. This is
  // the "why" behind the star ratings.
  const themeTally = new Map<
    InsightTheme,
    { liked: number; disliked: number; quote: string | null }
  >();
  const dealbreakers = new Map<string, number>();
  let insightCount = 0;
  let voiceNoteCount = 0;

  for (const f of feedback) {
    const overrides = (f.overrides ?? {}) as Record<string, unknown>;
    if (overrides._voice === true) voiceNoteCount += 1;
    const insights = overrides._insights as FeedbackInsights | undefined;
    if (!insights) continue;
    insightCount += 1;
    for (const like of insights.likes ?? []) {
      const slot = themeTally.get(like.theme) ?? {
        liked: 0,
        disliked: 0,
        quote: null,
      };
      slot.liked += 1;
      slot.quote ??= like.quote || null;
      themeTally.set(like.theme, slot);
    }
    for (const dislike of insights.dislikes ?? []) {
      const slot = themeTally.get(dislike.theme) ?? {
        liked: 0,
        disliked: 0,
        quote: null,
      };
      slot.disliked += 1;
      slot.quote ??= dislike.quote || null;
      themeTally.set(dislike.theme, slot);
    }
    for (const rule of insights.dealbreakers ?? []) {
      const key = rule.trim().toLowerCase();
      dealbreakers.set(key, (dealbreakers.get(key) ?? 0) + 1);
    }
  }

  const themeRows = Array.from(themeTally.entries())
    .map(([theme, t]) => ({
      theme,
      label: THEME_LABELS[theme] ?? theme,
      ...t,
      mentions: t.liked + t.disliked,
    }))
    .sort((a, b) => b.mentions - a.mentions);
  const dealbreakerRows = Array.from(dealbreakers.entries()).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <>
      <Header pages={[{ title: 'Leads', url: '/leads' }]} page="Calibration" />
      <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Leads · Calibration
          </p>
          <h1 className="mt-1 font-semibold text-2xl tracking-tight">
            Scorer calibration
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
            How well the automated lead score matches your judgement, drawn
            from {feedback.length} rating
            {feedback.length === 1 ? '' : 's'} in the last 90 days. Use this
            to spot which scoring factors are pulling the model off-target.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs">
              <span className="text-muted-foreground">Live scorer config:</span>
              {activeConfig ? (
                <span className="font-mono font-semibold text-emerald-700">
                  v{activeConfig.version}
                  {activeConfig.description
                    ? ` · ${activeConfig.description}`
                    : ''}
                </span>
              ) : (
                <span className="font-mono font-semibold text-slate-600">
                  built-in defaults
                </span>
              )}
            </span>
            <Link
              href="/leads/scorer-config"
              className="rounded-full bg-foreground px-3 py-1 font-medium text-background text-xs hover:opacity-90"
            >
              Tune the scorer →
            </Link>
          </div>
        </div>

        {/* Headline accuracy */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Agreement rate
            </p>
            <p className="mt-2 font-mono font-bold text-3xl tabular-nums">
              {agreementPct}%
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              founder rating within 15pts of scorer score
            </p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Average bias
            </p>
            <p
              className={`mt-2 font-mono font-bold text-3xl tabular-nums ${
                avgDelta > 5
                  ? 'text-emerald-700'
                  : avgDelta < -5
                    ? 'text-rose-700'
                    : ''
              }`}
            >
              {avgDelta > 0 ? '+' : ''}
              {Math.round(avgDelta)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {avgDelta > 5
                ? 'Scorer is under-rating leads — consider raising key factors.'
                : avgDelta < -5
                  ? 'Scorer is over-rating leads — consider trimming.'
                  : 'Scorer roughly tracks founder judgement.'}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Disagreement split
            </p>
            <p className="mt-2 text-sm">
              <span className="font-mono font-semibold text-emerald-700">
                {disagreeHigh}
              </span>{' '}
              <span className="text-muted-foreground">scorer too low</span>
            </p>
            <p className="text-sm">
              <span className="font-mono font-semibold text-rose-700">
                {disagreeLow}
              </span>{' '}
              <span className="text-muted-foreground">scorer too high</span>
            </p>
            <p className="text-sm">
              <span className="font-mono font-semibold">{agree}</span>{' '}
              <span className="text-muted-foreground">aligned</span>
            </p>
          </div>
        </div>

        {/* Per-factor bias table */}
        <div className="rounded-xl border bg-card">
          <div className="border-b p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Per-factor bias
            </p>
            <p className="mt-1 text-sm text-slate-700">
              For each scoring factor: how often it fires, and how the
              founder rates leads where it appears. Factors at the top fire
              most often — they have the biggest impact on the model.
            </p>
          </div>
          {factorRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Not enough feedback yet. Rate ≥3 leads where each factor
              appears to surface bias signals.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">
                      Factor
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      Appearances
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      Avg rating
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      ≥4★ / ≤2★
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      Suggested action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {factorRows.map((r) => (
                    <tr key={r.label} className="hover:bg-accent">
                      <td className="px-4 py-3 font-medium">{r.label}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {r.appearances}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {r.avgRating.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className="text-emerald-700">
                          {r.highRatings}
                        </span>
                        <span className="text-muted-foreground"> / </span>
                        <span className="text-rose-700">{r.lowRatings}</span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {r.bias === 'over-weighted' ? (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 font-medium text-rose-800">
                            Trim — over-weighted
                          </span>
                        ) : r.bias === 'under-weighted' ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                            Lean in — under-weighted
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                            Aligned
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* One-click weight suggestions from the bias table */}
        <SuggestionCards suggestions={suggestions} />

        {/* Taste profile — mined from notes + voice-note transcripts */}
        <div className="rounded-xl border bg-card">
          <div className="border-b p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Taste profile
            </p>
            <p className="mt-1 text-sm text-slate-700">
              What you consistently <strong>like</strong> and{' '}
              <strong>dislike</strong> about properties, mined from your
              notes and voice notes ({insightCount} note
              {insightCount === 1 ? '' : 's'} analysed
              {voiceNoteCount > 0
                ? `, ${voiceNoteCount} by voice`
                : ''}
              ). Every note makes this sharper.
            </p>
          </div>
          {themeRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No notes analysed yet. Add a note — or tap the mic and say what
              you like or dislike — when rating a lead.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Theme</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Liked
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      Disliked
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      In your words
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {themeRows.map((r) => (
                    <tr key={r.theme} className="hover:bg-accent">
                      <td className="px-4 py-3 font-medium">{r.label}</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-700">
                        {r.liked}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-rose-700">
                        {r.disliked}
                      </td>
                      <td className="px-4 py-3 text-xs italic text-muted-foreground">
                        {r.quote ? `“${r.quote}”` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {dealbreakerRows.length > 0 && (
            <div className="border-t p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-rose-700">
                Dealbreakers
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {dealbreakerRows.map(([rule, count]) => (
                  <li key={rule} className="flex items-start gap-2">
                    <span className="mt-0.5 text-rose-500">✕</span>
                    <span>
                      {rule}
                      {count > 1 && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (said {count}×)
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-dashed bg-slate-50 p-5 text-xs text-muted-foreground">
          <p className="font-medium text-slate-700">How this works</p>
          <ul className="mt-2 space-y-1">
            <li>
              · Every time you rate a lead (1–5 stars), we snapshot the
              scoring factors that were active when it was scored.
            </li>
            <li>
              · The star rating is mapped to a 0–100 implied score for the
              delta comparison.
            </li>
            <li>
              · A factor is flagged{' '}
              <span className="font-medium text-rose-700">over-weighted</span>{' '}
              when leads with it average ≤2.5★ —{' '}
              <span className="font-medium text-emerald-700">
                under-weighted
              </span>{' '}
              when they average ≥4★. Minimum 3 appearances before we flag
              anything.
            </li>
            <li>
              · Suggestions are a guide for human review — nothing auto-tunes.
              To apply new weights, activate an{' '}
              <span className="font-medium text-slate-700">
                EvalConfig (lead_scoring)
              </span>{' '}
              version: the daily scout then scores with it and stamps that
              version on each lead, so the numbers above always reflect the
              live config.
            </li>
          </ul>
        </div>

        <p className="text-center text-muted-foreground text-xs">
          <Link href="/leads" className="hover:underline">
            ← Back to leads
          </Link>
        </p>
      </main>
    </>
  );
};

export default CalibrationPage;
