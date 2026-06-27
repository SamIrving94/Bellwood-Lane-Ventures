'use client';

import { resolveAction } from '@/app/actions/founder-actions/resolve';
import { XIcon } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';

/**
 * A founder-action row on the Today page that can be dismissed in place.
 *
 * The Today page is where the founder actually lands each morning, so it needs
 * a way to clear a notification right there — and have it stay cleared.
 * Dismissing flips the action's status to `dismissed` (server action), which
 * removes it from every pending query permanently. We hide the row optimistically
 * so it disappears instantly rather than waiting on the round-trip.
 */
export function DismissibleAction({
  id,
  priorityClass,
  dotClass,
  typeLabel,
  ageLabel,
  title,
  description,
  link,
}: {
  id: string;
  priorityClass: string;
  dotClass: string;
  typeLabel: string;
  ageLabel: string;
  title: string;
  description: string | null;
  link: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (dismissed) return null;

  const handleDismiss = (e: React.MouseEvent) => {
    // The row is a Link — stop the click from navigating when we hit the ✕.
    e.preventDefault();
    e.stopPropagation();
    setDismissed(true);
    startTransition(async () => {
      try {
        await resolveAction(id, 'dismissed');
      } catch {
        // Revert if the server rejected it so the founder doesn't lose the item.
        setDismissed(false);
      }
    });
  };

  return (
    <div className="group relative">
      <Link
        href={link}
        className={`block rounded-2xl border-2 p-5 pr-12 transition hover:bg-white ${priorityClass}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.22em]">
              {typeLabel} · {ageLabel}
            </span>
          </div>
          <p className="mt-2 font-medium">{title}</p>
          {description && (
            <p className="mt-1 line-clamp-2 text-muted-foreground text-xs">
              {description}
            </p>
          )}
        </div>
      </Link>
      <button
        type="button"
        onClick={handleDismiss}
        disabled={isPending}
        aria-label="Dismiss"
        title="Dismiss — clears it for good"
        className="absolute top-3 right-3 rounded-full p-1.5 text-muted-foreground opacity-0 transition hover:bg-slate-200 hover:text-foreground focus:opacity-100 group-hover:opacity-100"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
