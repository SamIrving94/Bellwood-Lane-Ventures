'use client';

import { convertLeadToDeal } from '@/app/actions/leads/convert';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export const ConvertButton = ({ leadId }: { leadId: string }) => {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleConvert = () => {
    setError(null);
    startTransition(async () => {
      try {
        const deal = await convertLeadToDeal(leadId);
        router.push(`/deals/${deal.id}`);
      } catch {
        // Most common cause: the lead was converted in another tab / by the
        // other founder. Refresh so the page shows the converted state.
        setError('Could not convert — it may already be a deal. Refreshing…');
        router.refresh();
      }
    });
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleConvert}
        disabled={isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? 'Converting...' : 'Convert to Deal'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
};
