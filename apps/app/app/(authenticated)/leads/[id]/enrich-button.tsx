'use client';

import { useState, useTransition } from 'react';
import { enrichLeadById } from '@/app/actions/leads/enrich';

export function EnrichLeadButton({ leadId }: { leadId: string }) {
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
    return (
      <p className="text-xs text-emerald-700">✓ Enriched — refreshing…</p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handle}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? 'Fetching property data… (~25s)' : '✨ Enrich this property'}
      </button>
      {error && <p className="text-xs text-rose-700">{error}</p>}
    </div>
  );
}
