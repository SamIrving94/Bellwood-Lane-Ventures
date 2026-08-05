'use client';

import {
  assignViewing,
  cancelViewing,
  markViewingReviewed,
} from '@/app/actions/network/viewings';
import {
  CONDITION_AREAS,
  VENDOR_MOTIVATION_OPTIONS,
} from '@repo/database/viewing-report';
import { Button } from '@repo/design-system/components/ui/button';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

type PartnerOption = {
  id: string;
  name: string;
  postcodeAreas: string[];
};

type ViewingItem = {
  id: string;
  status: string;
  link: string;
  partnerName: string | null;
  scheduledAt: string | null;
  submittedAt: string | null;
  conditionScores: Record<string, number> | null;
  refurbEstimatePence: number | null;
  photos: string[];
  vendorMotivation: string | null;
  summary: string | null;
  redFlags: string | null;
};

const STATUS_TONE: Record<string, string> = {
  requested: 'bg-muted text-muted-foreground',
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  submitted:
    'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  reviewed:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  cancelled: 'bg-muted text-muted-foreground line-through',
};

export function ViewingsPanel({
  dealId,
  dealOutwardCode,
  partners,
  viewings,
}: {
  dealId: string;
  dealOutwardCode: string;
  partners: PartnerOption[];
  viewings: ViewingItem[];
}) {
  const [isPending, startTransition] = useTransition();
  const [assignOpen, setAssignOpen] = useState(false);

  // Partners covering this deal's outward code float to the top.
  const sorted = [...partners].sort((a, b) => {
    const aCovers = a.postcodeAreas.includes(dealOutwardCode) ? 0 : 1;
    const bCovers = b.postcodeAreas.includes(dealOutwardCode) ? 0 : 1;
    return aCovers - bCovers;
  });

  const [partnerId, setPartnerId] = useState<string>(sorted[0]?.id ?? '');
  const [scheduledAt, setScheduledAt] = useState('');
  const [accessNotes, setAccessNotes] = useState('');

  const handleAssign = () => {
    startTransition(async () => {
      try {
        const { link } = await assignViewing(dealId, {
          partnerId: partnerId || null,
          scheduledAt: scheduledAt || null,
          accessNotes: accessNotes || null,
        });
        await navigator.clipboard.writeText(link).catch(() => {});
        toast.success('Viewing assigned — link emailed and copied.');
        setAssignOpen(false);
        setScheduledAt('');
        setAccessNotes('');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to assign.');
      }
    });
  };

  const handleCancel = (viewingId: string) => {
    startTransition(async () => {
      try {
        await cancelViewing(viewingId);
        toast.success('Viewing cancelled.');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to cancel.');
      }
    });
  };

  const handleReviewed = (viewingId: string) => {
    startTransition(async () => {
      try {
        await markViewingReviewed(viewingId);
        toast.success('Marked reviewed.');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update.');
      }
    });
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
          Viewings
        </h2>
        <Button size="sm" onClick={() => setAssignOpen((v) => !v)}>
          {assignOpen ? 'Close' : 'Assign viewing'}
        </Button>
      </div>
      <p className="mt-0.5 text-muted-foreground text-xs">
        A field partner walks the property with a magic-link report form — their
        eyes, your judgement.
      </p>

      {assignOpen && (
        <div className="mt-3 rounded-md border bg-background p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-muted-foreground text-xs">Partner</span>
              <select
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">No partner yet (just create link)</option>
                {sorted.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.postcodeAreas.includes(dealOutwardCode)
                      ? ` — covers ${dealOutwardCode}`
                      : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-muted-foreground text-xs">
                Time (optional)
              </span>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-muted-foreground text-xs">
                Access notes (keys, vendor contact, parking)
              </span>
              <textarea
                value={accessNotes}
                onChange={(e) => setAccessNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={handleAssign} disabled={isPending}>
              {isPending ? 'Assigning…' : 'Assign & send link'}
            </Button>
          </div>
        </div>
      )}

      {viewings.length === 0 ? (
        <p className="mt-3 text-muted-foreground text-sm">
          No viewings yet.
          {partners.length === 0 && (
            <>
              {' '}
              Add builders to your{' '}
              <a href="/network" className="underline">
                field network
              </a>{' '}
              first.
            </>
          )}
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {viewings.map((v) => (
            <div key={v.id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium text-[10px] capitalize ${STATUS_TONE[v.status] ?? ''}`}
                  >
                    {v.status}
                  </span>
                  <span className="font-medium text-sm">
                    {v.partnerName ?? 'Unassigned'}
                  </span>
                  {v.scheduledAt && (
                    <span className="text-muted-foreground text-xs">
                      {new Date(v.scheduledAt).toLocaleString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {(v.status === 'requested' || v.status === 'scheduled') && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(v.link);
                          toast.success('Report link copied.');
                        }}
                      >
                        Copy link
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCancel(v.id)}
                        disabled={isPending}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                  {v.status === 'submitted' && (
                    <Button
                      size="sm"
                      onClick={() => handleReviewed(v.id)}
                      disabled={isPending}
                    >
                      Mark reviewed
                    </Button>
                  )}
                </div>
              </div>

              {(v.status === 'submitted' || v.status === 'reviewed') && (
                <div className="mt-3 space-y-3 border-t pt-3">
                  {v.conditionScores && (
                    <div className="flex flex-wrap gap-1.5">
                      {CONDITION_AREAS.map((area) => {
                        const score = v.conditionScores?.[area.key];
                        if (!score) return null;
                        const tone =
                          score <= 2
                            ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                            : score === 3
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
                        return (
                          <span
                            key={area.key}
                            className={`rounded px-1.5 py-0.5 font-medium text-[10px] ${tone}`}
                          >
                            {area.label} {score}/5
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-4 text-muted-foreground text-xs">
                    {v.refurbEstimatePence !== null && (
                      <span>
                        Refurb gut-feel:{' '}
                        <strong className="text-foreground">
                          £
                          {Math.round(
                            v.refurbEstimatePence / 100
                          ).toLocaleString('en-GB')}
                        </strong>
                      </span>
                    )}
                    {v.vendorMotivation && (
                      <span>
                        Vendor:{' '}
                        <strong className="text-foreground">
                          {VENDOR_MOTIVATION_OPTIONS.find(
                            (o) => o.value === v.vendorMotivation
                          )?.label ?? v.vendorMotivation}
                        </strong>
                      </span>
                    )}
                  </div>
                  {v.summary && (
                    <p className="whitespace-pre-wrap text-sm">{v.summary}</p>
                  )}
                  {v.redFlags && (
                    <p className="rounded-md border border-red-200 bg-red-50 p-2 text-red-800 text-sm dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                      🚩 {v.redFlags}
                    </p>
                  )}
                  {v.photos.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {v.photos.map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt="Viewing"
                            className="h-20 w-20 rounded-md border object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
