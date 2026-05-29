'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  releaseForResale,
  unreleaseForResale,
} from '@/app/actions/deals/release-for-resale';

export function ReleaseControl({
  dealId,
  released,
  reason,
}: {
  dealId: string;
  released: boolean;
  reason: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');

  const handleRelease = () => {
    if (!note.trim()) {
      toast.error('Add a reason — why are we passing?');
      return;
    }
    startTransition(async () => {
      try {
        await releaseForResale(dealId, note);
        toast.success('Released to the investor feed. Deal marked rejected.');
        setOpen(false);
        setNote('');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to release.');
      }
    });
  };

  const handleUnrelease = () => {
    startTransition(async () => {
      try {
        await unreleaseForResale(dealId);
        toast.success('Pulled back off the investor feed.');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to pull back.');
      }
    });
  };

  if (released) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-emerald-800 dark:text-emerald-400">
              Released to investor feed
            </h2>
            {reason && (
              <p className="mt-1 text-xs text-muted-foreground">
                Reason: {reason}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleUnrelease}
            disabled={isPending}
          >
            Pull back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Pass & release to investors</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Only do this once we&apos;ve passed on the deal for our own book. It
            marks the deal rejected and adds it to the investor feed.
          </p>
        </div>
        {!open && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            disabled={isPending}
          >
            Pass & release
          </Button>
        )}
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why are we passing? (e.g. 'Margin too thin for our book')"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false);
                setNote('');
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleRelease} disabled={isPending}>
              {isPending ? 'Releasing…' : 'Confirm pass & release'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
