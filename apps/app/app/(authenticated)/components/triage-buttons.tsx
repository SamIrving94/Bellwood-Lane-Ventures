'use client';

import { useState, useTransition } from 'react';
import {
  setLeadTriage,
  type TriageStatus,
} from '../../actions/leads/triage';

/**
 * Founder triage control: Shortlist / Watch / Pass.
 *
 * Deliberately NOT stars — stars are scorer-calibration feedback
 * (FounderFeedback); triage is the shared "what are we doing with this
 * lead" decision. Clicking the active status again clears it back to new.
 */

const OPTIONS: {
  status: Exclude<TriageStatus, 'new'>;
  label: string;
  activeLabel: string;
  activeCls: string;
  idleCls: string;
}[] = [
  {
    status: 'shortlisted',
    label: 'Shortlist',
    activeLabel: '✓ Shortlisted',
    activeCls:
      'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700',
    idleCls:
      'border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50',
  },
  {
    status: 'watching',
    label: 'Watch',
    activeLabel: '👁 Watching',
    activeCls: 'border-sky-600 bg-sky-600 text-white hover:bg-sky-700',
    idleCls: 'border-sky-300 bg-white text-sky-700 hover:bg-sky-50',
  },
  {
    status: 'passed',
    label: 'Pass',
    activeLabel: 'Passed',
    activeCls: 'border-slate-500 bg-slate-500 text-white hover:bg-slate-600',
    idleCls: 'border-slate-300 bg-white text-slate-500 hover:bg-slate-100',
  },
];

export function TriageButtons({
  leadId,
  status,
  onChanged,
  size = 'sm',
}: {
  leadId: string;
  status: string;
  /** Optimistic callback so list views can re-filter without a server round-trip */
  onChanged?: (status: TriageStatus) => void;
  size?: 'sm' | 'md';
}) {
  const [current, setCurrent] = useState<string>(status);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (current === 'converted') return null;

  const apply = (next: TriageStatus) => {
    const previous = current as TriageStatus;
    setError(null);
    setCurrent(next);
    onChanged?.(next);
    startTransition(async () => {
      try {
        await setLeadTriage(leadId, next);
      } catch {
        setCurrent(previous);
        onChanged?.(previous);
        setError('Failed — try again');
      }
    });
  };

  const pad = size === 'md' ? 'px-3.5 py-1.5 text-sm' : 'px-2.5 py-1 text-xs';

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {OPTIONS.map((o) => {
        const active = current === o.status;
        return (
          <button
            key={o.status}
            type="button"
            disabled={isPending}
            onClick={() => apply(active ? 'new' : o.status)}
            title={
              active
                ? 'Click again to undo'
                : o.status === 'shortlisted'
                  ? 'Add to our shortlist'
                  : o.status === 'watching'
                    ? 'Keep an eye on it — not ready to act'
                    : 'Not for us — hide from the shortlist'
            }
            className={`rounded-full border font-medium transition-colors disabled:opacity-60 ${pad} ${
              active ? o.activeCls : o.idleCls
            }`}
          >
            {active ? o.activeLabel : o.label}
          </button>
        );
      })}
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
}
