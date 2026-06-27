'use client';

import { bulkResolveActions } from '@/app/actions/founder-actions/resolve';
import { Button } from '@repo/design-system/components/ui/button';
import { CheckCheckIcon, XIcon } from 'lucide-react';
import { useState, useTransition } from 'react';

/**
 * Bulk-clear toolbar for the Action Centre.
 *
 * Daily crons (lead reviews, draft approvals, summaries) create a fresh action
 * every run, so the list accumulates into the dozens and feels unmanageable.
 * This lets the founder clear the low-value backlog in one click — "Clear
 * low + medium" for routine noise, or "Clear all" to start fresh — without
 * dismissing 75 items one at a time. Dismissed = gone for good (status flips to
 * `dismissed`, filtered out of every pending query).
 */
export function BulkActionsToolbar({
  routineIds,
  allIds,
}: {
  /** Low + medium priority action ids — the routine noise. */
  routineIds: string[];
  /** Every pending action id. */
  allIds: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmAll, setConfirmAll] = useState(false);

  if (allIds.length === 0) return null;

  const clear = (ids: string[]) => {
    if (ids.length === 0) return;
    startTransition(async () => {
      await bulkResolveActions(ids, 'dismissed');
      setConfirmAll(false);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
      <span className="text-muted-foreground text-xs">
        {allIds.length} pending
      </span>
      <div className="flex-1" />
      {routineIds.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => clear(routineIds)}
          disabled={isPending}
        >
          <CheckCheckIcon className="mr-1 h-3 w-3" />
          Clear low + medium ({routineIds.length})
        </Button>
      )}
      {confirmAll ? (
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground text-xs">Clear all?</span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => clear(allIds)}
            disabled={isPending}
          >
            Yes, clear {allIds.length}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmAll(false)}
            disabled={isPending}
          >
            <XIcon className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmAll(true)}
          disabled={isPending}
        >
          Clear all
        </Button>
      )}
    </div>
  );
}
