'use client';

import { enrichLeadById } from '@/app/actions/leads/enrich';
import { useState, useTransition } from 'react';

export function EnrichLeadButton({
  leadId,
  label = '✨ Enrich this property',
}: {
  leadId: string;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handle() {
    setError(null);
    startTransition(async () => {
      const r = await enrichLeadById(leadId);
      if (!r.ok) {
        setError(r.error ?? 'Enrichment failed');
        return;
      }
      setDone(true);
      // Refresh to pick up the new snapshot
      window.location.reload();
    });
  }

  if (done) {
    return <p className="text-emerald-700 text-xs">✓ Enriched — refreshing…</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handle}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 font-medium text-sm text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? 'Appraising… (~25s)' : label}
      </button>
      {error && <p className="text-rose-700 text-xs">{error}</p>}
    </div>
  );
}
