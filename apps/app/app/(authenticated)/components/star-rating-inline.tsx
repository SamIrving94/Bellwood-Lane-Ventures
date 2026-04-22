'use client';

import { StarIcon, ChevronDownIcon, SendIcon } from 'lucide-react';
import { useState, useTransition, useCallback, useEffect, useRef } from 'react';
import { submitFeedback } from '@/app/actions/feedback/submit';

type FeedbackTargetType = 'scout_lead' | 'avm_result' | 'outreach_template' | 'outreach_campaign' | 'legal_step' | 'deal' | 'founder_action';

type StarRatingInlineProps = {
  targetType: FeedbackTargetType;
  targetId: string;
  existingRating?: number;
  compact?: boolean;
  onRated?: (rating: number) => void;
};

export function StarRatingInline({
  targetType,
  targetId,
  existingRating = 0,
  compact = false,
  onRated,
}: StarRatingInlineProps) {
  const [rating, setRating] = useState(existingRating);
  const [hoverRating, setHoverRating] = useState(0);
  const [submitted, setSubmitted] = useState(existingRating > 0);
  const [confirmed, setConfirmed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState('');
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleRate = useCallback(
    (star: number) => {
      setRating(star);

      // Auto-submit if not expanded (no override fields being filled)
      if (!expanded) {
        startTransition(async () => {
          await submitFeedback({
            targetType,
            targetId,
            rating: star,
          });
          setSubmitted(true);
          setConfirmed(true);
          onRated?.(star);
          // Clear the confirmation badge after 2s
          setTimeout(() => setConfirmed(false), 2000);
        });
      }
    },
    [expanded, targetType, targetId, onRated]
  );

  const handleExpandedSubmit = () => {
    if (rating === 0) return;
    startTransition(async () => {
      await submitFeedback({
        targetType,
        targetId,
        rating,
        notes: notes.trim() || undefined,
      });
      setSubmitted(true);
      setExpanded(false);
      setConfirmed(true);
      onRated?.(rating);
      setTimeout(() => setConfirmed(false), 2000);
    });
  };

  // Keyboard shortcuts: 1-5 to set rating, Enter to submit
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (key >= '1' && key <= '5') {
        handleRate(Number(key));
      } else if (key === 'Enter' && rating > 0 && expanded) {
        handleExpandedSubmit();
      }
    };

    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, [handleRate, rating, expanded]);

  const starSize = compact ? 'h-4 w-4' : 'h-5 w-5';
  const starPadding = compact ? 'p-0.5' : 'p-1';

  return (
    <div ref={containerRef} className="flex items-center gap-1" tabIndex={0}>
      {/* Stars */}
      <div
        role="radiogroup"
        aria-label="Lead rating"
        className="flex items-center gap-0.5"
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={rating === star}
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
            className={`${starPadding} transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center`}
            style={{ minWidth: compact ? '28px' : '44px', minHeight: compact ? '28px' : '44px' }}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => handleRate(star)}
            disabled={isPending}
          >
            <StarIcon
              className={`${starSize} transition-colors ${
                star <= (hoverRating || rating)
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-muted-foreground/30'
              }`}
            />
          </button>
        ))}
      </div>

      {/* Confirmed badge */}
      {confirmed && (
        <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400 animate-in fade-in">
          Rated {rating}/5
        </span>
      )}

      {/* Already rated indicator (when not freshly confirmed) */}
      {submitted && !confirmed && (
        <span className="ml-1 text-xs text-muted-foreground">
          {rating}/5
        </span>
      )}

      {/* Expand toggle for notes */}
      {!confirmed && (
        <button
          type="button"
          aria-label="Add notes or overrides"
          className="ml-1 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronDownIcon
            className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      )}

      {/* Expanded notes panel */}
      {expanded && (
        <div className="absolute z-10 mt-1 rounded-lg border bg-card p-3 shadow-lg min-w-[240px]">
          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            autoFocus
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
              onClick={handleExpandedSubmit}
              disabled={rating === 0 || isPending}
            >
              <SendIcon className="h-3 w-3" />
              {isPending ? 'Saving...' : 'Submit'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
