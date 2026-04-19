'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { StarIcon, SendIcon, BookmarkIcon } from 'lucide-react';
import { useState, useTransition, useEffect, useRef, useCallback } from 'react';
import { submitFeedback } from '@/app/actions/feedback/submit';

type FeedbackPanelProps = {
  targetType: 'scout_lead' | 'avm_result' | 'outreach_template' | 'outreach_campaign' | 'legal_step' | 'deal' | 'founder_action';
  targetId: string;
  title?: string;
  quickMode?: boolean;
  overrideFields?: OverrideField[];
  existingFeedback?: {
    rating: number;
    notes: string | null;
    overrides: Record<string, unknown> | null;
  } | null;
  onComplete?: () => void;
};

type OverrideField = {
  key: string;
  label: string;
  type: 'number' | 'select' | 'text';
  format?: 'gbp';
  currentValue?: unknown;
  options?: { label: string; value: string }[];
  suffix?: string;
};

function formatGBPInput(pence: number | undefined): string {
  if (!pence) return '';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

function parsePoundsInput(value: string): number | undefined {
  // Strip £, commas, spaces — accept plain number (pounds)
  const cleaned = value.replace(/[£,\s]/g, '');
  const pounds = parseFloat(cleaned);
  if (isNaN(pounds) || pounds < 0) return undefined;
  return Math.round(pounds * 100); // store as pence
}

export function FeedbackPanel({
  targetType,
  targetId,
  title = 'Rate this output',
  quickMode = false,
  overrideFields = [],
  existingFeedback,
  onComplete,
}: FeedbackPanelProps) {
  const [rating, setRating] = useState(existingFeedback?.rating ?? 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [notes, setNotes] = useState(existingFeedback?.notes ?? '');
  const [overrides, setOverrides] = useState<Record<string, unknown>>(
    (existingFeedback?.overrides as Record<string, unknown>) ?? {}
  );
  // For GBP fields, keep the raw display string separately
  const [gbpDisplayValues, setGbpDisplayValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of overrideFields) {
      if (field.format === 'gbp' && field.currentValue) {
        initial[field.key] = formatGBPInput(field.currentValue as number) || '';
      }
    }
    return initial;
  });
  const [markedAsTemplate, setMarkedAsTemplate] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasOverridesFilled = Object.values(overrides).some(
    (v) => v !== undefined && v !== ''
  );

  const handleSubmit = useCallback(() => {
    if (rating === 0) return;

    startTransition(async () => {
      const cleanOverrides = Object.fromEntries(
        Object.entries(overrides).filter(([_, v]) => v !== undefined && v !== '')
      );

      await submitFeedback({
        targetType,
        targetId,
        rating,
        overrides: Object.keys(cleanOverrides).length > 0 ? cleanOverrides : undefined,
        notes: notes.trim() || undefined,
        markedAsTemplate: markedAsTemplate || undefined,
      });

      setSubmitted(true);
      onComplete?.();
    });
  }, [rating, overrides, notes, markedAsTemplate, targetType, targetId, onComplete]);

  const handleStarClick = (star: number) => {
    setRating(star);
    // quickMode: auto-submit on star click if no override fields are filled
    if (quickMode && !hasOverridesFilled && overrideFields.length === 0) {
      startTransition(async () => {
        await submitFeedback({
          targetType,
          targetId,
          rating: star,
        });
        setSubmitted(true);
        onComplete?.();
      });
    }
  };

  // Keyboard shortcuts: 1-5 to set star rating, Enter to submit
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Only handle when focus is inside the panel
      if (!el.contains(document.activeElement)) return;
      const key = e.key;
      if (key >= '1' && key <= '5') {
        e.preventDefault();
        setRating(Number(key));
      } else if (key === 'Enter' && rating > 0 && !isPending) {
        e.preventDefault();
        handleSubmit();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [rating, isPending, handleSubmit]);

  if (submitted) {
    return (
      <div className="rounded-lg border bg-emerald-50 p-4 text-center dark:bg-emerald-950">
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Feedback submitted — {rating}/5 stars
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="rounded-lg border bg-card p-4 space-y-4" tabIndex={-1}>
      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        {title}
      </h4>

      {/* Star rating */}
      <div
        role="radiogroup"
        aria-label="Rating"
        className="flex items-center gap-1"
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={rating === star}
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
            className="p-1 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => handleStarClick(star)}
          >
            <StarIcon
              className={`h-6 w-6 ${
                star <= (hoverRating || rating)
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-muted-foreground/30'
              }`}
            />
          </button>
        ))}
        {rating > 0 && (
          <span className="ml-2 text-sm text-muted-foreground">
            {rating === 1 && 'Poor'}
            {rating === 2 && 'Below average'}
            {rating === 3 && 'Acceptable'}
            {rating === 4 && 'Good'}
            {rating === 5 && 'Excellent'}
          </span>
        )}
      </div>

      {/* Override fields */}
      {overrideFields.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Override values (leave blank to keep agent&apos;s values)
          </p>
          {overrideFields.map((field) => (
            <div key={field.key} className="flex items-center gap-3">
              <label className="text-sm w-36 shrink-0">{field.label}</label>
              {field.type === 'number' && field.format === 'gbp' && (
                <div className="flex items-center gap-1">
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-sm text-muted-foreground pointer-events-none">£</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="w-36 rounded-md border bg-background pl-6 pr-3 py-1.5 text-sm"
                      placeholder={
                        field.currentValue
                          ? new Intl.NumberFormat('en-GB').format(
                              Math.round((field.currentValue as number) / 100)
                            )
                          : '245,000'
                      }
                      value={gbpDisplayValues[field.key] ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setGbpDisplayValues((prev) => ({ ...prev, [field.key]: raw }));
                        const pence = parsePoundsInput(raw);
                        setOverrides((prev) => ({
                          ...prev,
                          [field.key]: pence,
                        }));
                      }}
                      onBlur={(e) => {
                        // Format nicely on blur
                        const pence = parsePoundsInput(e.target.value);
                        if (pence !== undefined) {
                          setGbpDisplayValues((prev) => ({
                            ...prev,
                            [field.key]: new Intl.NumberFormat('en-GB').format(pence / 100),
                          }));
                        }
                      }}
                    />
                  </div>
                  {/* AVM sanity warning */}
                  {field.currentValue != null && overrides[field.key] !== undefined ? (() => {
                      const enteredPence = overrides[field.key] as number;
                      const ratio = enteredPence / (field.currentValue as number);
                      if (ratio > 10 || ratio < 0.1) {
                        return (
                          <span className="text-xs text-amber-600 dark:text-amber-400">
                            Value looks unusual — check entry
                          </span>
                        );
                      }
                      return null;
                    })() : null}
                </div>
              )}
              {field.type === 'number' && field.format !== 'gbp' && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    className="w-28 rounded-md border bg-background px-3 py-1.5 text-sm"
                    placeholder={String(field.currentValue ?? '')}
                    value={(overrides[field.key] as string) ?? ''}
                    onChange={(e) =>
                      setOverrides((prev) => ({
                        ...prev,
                        [field.key]: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                  />
                  {field.suffix && (
                    <span className="text-xs text-muted-foreground">{field.suffix}</span>
                  )}
                </div>
              )}
              {field.type === 'select' && field.options && (
                <select
                  className="rounded-md border bg-background px-3 py-1.5 text-sm"
                  value={(overrides[field.key] as string) ?? ''}
                  onChange={(e) =>
                    setOverrides((prev) => ({
                      ...prev,
                      [field.key]: e.target.value || undefined,
                    }))
                  }
                >
                  <option value="">Keep current</option>
                  {field.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
              {field.type === 'text' && (
                <input
                  type="text"
                  className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
                  placeholder={String(field.currentValue ?? '')}
                  value={(overrides[field.key] as string) ?? ''}
                  onChange={(e) =>
                    setOverrides((prev) => ({
                      ...prev,
                      [field.key]: e.target.value || undefined,
                    }))
                  }
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      <div>
        <textarea
          className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none"
          rows={2}
          placeholder="Notes — what did the agent get right or wrong?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Template flag for outreach */}
      {(targetType === 'outreach_template' || targetType === 'outreach_campaign') && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={markedAsTemplate}
            onChange={(e) => setMarkedAsTemplate(e.target.checked)}
            className="rounded"
          />
          <BookmarkIcon className="h-4 w-4" />
          Mark as perfect template
        </label>
      )}

      {/* Submit */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Tip: press 1–5 to rate, Enter to submit
        </p>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={rating === 0 || isPending}
        >
          <SendIcon className="mr-1 h-3 w-3" />
          {isPending ? 'Submitting...' : 'Submit Feedback'}
        </Button>
      </div>
    </div>
  );
}
