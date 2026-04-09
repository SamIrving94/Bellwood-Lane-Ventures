'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { StarIcon, SendIcon, BookmarkIcon } from 'lucide-react';
import { useState, useTransition } from 'react';
import { submitFeedback } from '@/app/actions/feedback/submit';

type FeedbackPanelProps = {
  targetType: 'scout_lead' | 'avm_result' | 'outreach_template' | 'outreach_campaign' | 'legal_step' | 'deal' | 'founder_action';
  targetId: string;
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
  currentValue?: unknown;
  options?: { label: string; value: string }[];
  suffix?: string;
};

export function FeedbackPanel({
  targetType,
  targetId,
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
  const [markedAsTemplate, setMarkedAsTemplate] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
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
  };

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
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        Rate this output
      </h4>

      {/* Star rating */}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className="p-1 transition-colors"
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => setRating(star)}
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
              <label className="text-sm w-32 shrink-0">{field.label}</label>
              {field.type === 'number' && (
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
      <div className="flex justify-end">
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
