'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  claimReferral,
  releaseForReferral,
  unreleaseForReferral,
} from '@/app/actions/leads/release-for-referral';

export function ReferralControl({
  leadId,
  released,
  reason,
  claimedBy,
}: {
  leadId: string;
  released: boolean;
  reason: string | null;
  claimedBy: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [partner, setPartner] = useState('');

  const handleRelease = () => {
    if (!note.trim()) {
      toast.error('Add a reason — why are we passing?');
      return;
    }
    startTransition(async () => {
      try {
        await releaseForReferral(leadId, note);
        toast.success('Listed on the referral feed. Lead marked passed.');
        setOpen(false);
        setNote('');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to list.');
      }
    });
  };

  const handleUnrelease = () => {
    startTransition(async () => {
      try {
        await unreleaseForReferral(leadId);
        toast.success('Pulled back off the referral feed.');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to pull back.');
      }
    });
  };

  const handleClaim = () => {
    if (!partner.trim()) {
      toast.error('Who is taking the lead?');
      return;
    }
    startTransition(async () => {
      try {
        await claimReferral(leadId, partner);
        toast.success(`Marked claimed by ${partner.trim()}.`);
        setPartner('');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to claim.');
      }
    });
  };

  if (released) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-emerald-800 dark:text-emerald-400">
              Listed on referral feed
            </h2>
            {reason && (
              <p className="mt-1 text-xs text-muted-foreground">
                Reason: {reason}
              </p>
            )}
            {claimedBy && (
              <p className="mt-1 text-xs text-muted-foreground">
                Claimed by <span className="font-medium">{claimedBy}</span>
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

        {!claimedBy && (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={partner}
              onChange={(e) => setPartner(e.target.value)}
              placeholder="Partner who took it (name / email)"
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <Button size="sm" onClick={handleClaim} disabled={isPending}>
              Mark claimed
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Pass & list for referral</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Only do this once we&apos;ve passed on the lead for our own book. It
            marks the lead passed and adds it to the referral feed.
          </p>
        </div>
        {!open && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            disabled={isPending}
          >
            Pass & list
          </Button>
        )}
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why are we passing? (e.g. 'Outside our patch')"
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
              {isPending ? 'Listing…' : 'Confirm pass & list'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
