'use client';

import type { ScorerSuggestion } from '@repo/scouting';
import { CheckIcon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react';
import { useState, useTransition } from 'react';
import { applyScorerSuggestion } from '@/app/actions/scorer-config/apply-suggestion';

/**
 * One-click scorer tuning. Each card is a specific, evidenced weight change
 * derived from the calibration bias table — Apply creates and activates a
 * new scorer-config version with just that change. Tomorrow's scout scores
 * with it.
 */
export function SuggestionCards({
  suggestions,
}: {
  suggestions: ScorerSuggestion[];
}) {
  const [applied, setApplied] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (suggestions.length === 0) return null;

  const keyOf = (s: ScorerSuggestion) => s.title;

  const handleApply = (s: ScorerSuggestion) => {
    setError(null);
    setPendingKey(keyOf(s));
    startTransition(async () => {
      try {
        const { version } = await applyScorerSuggestion({
          change: s.change,
          value: s.suggestedValue,
          title: s.title,
        });
        setApplied((prev) => ({ ...prev, [keyOf(s)]: version }));
      } catch {
        setError('Could not apply — try again or tune manually.');
      } finally {
        setPendingKey(null);
      }
    });
  };

  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Suggested tweaks
        </p>
        <p className="mt-1 text-sm text-slate-700">
          Specific weight changes the evidence supports. <strong>Apply</strong>{' '}
          activates a new scorer version with that one change —
          tomorrow&apos;s leads score with it. Reverting is one click on the
          version history.
        </p>
      </div>
      <div className="divide-y">
        {suggestions.map((s) => {
          const key = keyOf(s);
          const appliedVersion = applied[key];
          return (
            <div
              key={key}
              className="flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div className="flex items-start gap-3">
                {s.direction === 'trim' ? (
                  <TrendingDownIcon className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                ) : (
                  <TrendingUpIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                )}
                <div>
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.evidence}</p>
                </div>
              </div>
              {appliedVersion ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400">
                  <CheckIcon className="h-3 w-3" />
                  Applied — live as v{appliedVersion}
                </span>
              ) : (
                <button
                  type="button"
                  className="rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
                  onClick={() => handleApply(s)}
                  disabled={pendingKey !== null}
                >
                  {pendingKey === key ? 'Applying…' : 'Apply'}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {error && (
        <p className="border-t p-4 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
