'use client';

import { updateDealStatus } from '@/app/actions/deals/update-status';
import type { DealStatus } from '@repo/database/generated/client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

/**
 * Move a deal to ANY stage — including the terminal ones (completed /
 * rejected / withdrawn) that the kanban's ±1 buttons can't reach.
 * Terminal moves ask for confirmation; they drop the deal into Archive.
 */

const ACTIVE_STAGES: { value: DealStatus; label: string }[] = [
  { value: 'new_lead', label: 'New lead' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'valuation', label: 'Valuation' },
  { value: 'offer_made', label: 'Offer made' },
  { value: 'under_offer', label: 'Under offer' },
  { value: 'exchanged', label: 'Exchanged' },
];

const TERMINAL_STAGES: { value: DealStatus; label: string }[] = [
  { value: 'completed', label: '✓ Completed' },
  { value: 'rejected', label: '✕ Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

const TERMINAL_VALUES = new Set(TERMINAL_STAGES.map((s) => s.value));

export function DealStatusControl({
  dealId,
  status,
}: {
  dealId: string;
  status: DealStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleChange = (next: DealStatus) => {
    if (next === status) return;
    if (
      TERMINAL_VALUES.has(next) &&
      !window.confirm(
        `Move this deal to "${next}"? It will leave the pipeline and go to the Archive.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      await updateDealStatus(dealId, next);
      router.refresh();
    });
  };

  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(e) => handleChange(e.target.value as DealStatus)}
      className="rounded-full border bg-background px-3 py-1 text-xs capitalize disabled:opacity-50"
      aria-label="Deal stage"
    >
      <optgroup label="Pipeline">
        {ACTIVE_STAGES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </optgroup>
      <optgroup label="Close out">
        {TERMINAL_STAGES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
