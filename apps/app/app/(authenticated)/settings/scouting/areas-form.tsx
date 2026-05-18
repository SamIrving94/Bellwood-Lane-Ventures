'use client';

import { useState, useTransition } from 'react';
import {
  addArea,
  removeArea,
  reProbeArea,
  triggerScoutNow,
  widenArea,
  type Area,
} from './areas-actions';

type Props = {
  initial: Area[];
};

type Status = {
  kind: 'idle' | 'error' | 'info' | 'success';
  message?: string;
};

function StatusDot({ count, error }: { count: number; error: string | null }) {
  if (error) return <span className="text-rose-500">●</span>;
  if (count === 0) return <span className="text-slate-300">●</span>;
  if (count < 5) return <span className="text-amber-500">●</span>;
  return <span className="text-emerald-500">●</span>;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function AreasForm({ initial }: Props) {
  const [areas, setAreas] = useState<Area[]>(initial);
  const [input, setInput] = useState('');
  const [pendingAdd, startAdd] = useTransition();
  const [pendingAction, startAction] = useTransition();
  const [pendingScout, startScout] = useTransition();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [runResult, setRunResult] = useState<unknown>(null);

  const handleAdd = () => {
    if (!input.trim()) return;
    setStatus({ kind: 'idle' });
    startAdd(async () => {
      const r = await addArea(input.trim());
      if (r.ok) {
        setAreas((cur) => [...cur, r.area]);
        setInput('');
        const c = r.area.lastProbe?.listingCount ?? 0;
        setStatus({
          kind: c > 0 ? 'success' : 'info',
          message:
            c > 0
              ? `Added ${r.area.label} — ${c} listings.`
              : `Added ${r.area.label}. No listings yet — try widening the radius.`,
        });
      } else {
        setStatus({ kind: 'error', message: r.error });
      }
    });
  };

  const handleRemove = (id: string) => {
    startAction(async () => {
      await removeArea(id);
      setAreas((cur) => cur.filter((a) => a.id !== id));
    });
  };

  const handleWiden = (id: string) => {
    startAction(async () => {
      const r = await widenArea(id);
      if (r.ok) {
        setAreas((cur) =>
          cur.map((a) => (a.id === id ? r.area : a)),
        );
      } else {
        setStatus({ kind: 'error', message: r.error });
      }
    });
  };

  const handleReProbe = (id: string) => {
    startAction(async () => {
      const r = await reProbeArea(id);
      if (r.ok) {
        setAreas((cur) =>
          cur.map((a) => (a.id === id ? r.area : a)),
        );
      } else {
        setStatus({ kind: 'error', message: r.error });
      }
    });
  };

  const handleScout = () => {
    setRunResult(null);
    setStatus({ kind: 'idle' });
    startScout(async () => {
      const r = await triggerScoutNow();
      if (r.ok && r.result) {
        const res = r.result as {
          qualified?: number;
          highScoreLeads?: number;
          fetched?: number;
          sources?: Record<string, number>;
        };
        setRunResult(res);
        setStatus({
          kind: 'success',
          message: `Scout complete — fetched ${res.fetched ?? 0}, qualified ${res.qualified ?? 0}, ${res.highScoreLeads ?? 0} scored ≥70.`,
        });
      } else {
        setStatus({ kind: 'error', message: r.error ?? 'Scout failed.' });
      }
    });
  };

  const totalListings = areas.reduce(
    (s, a) => s + (a.lastProbe?.listingCount ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      {/* Add row */}
      <div className="rounded-2xl border bg-card p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Where do you buy?
        </p>
        <h2 className="mt-1 font-semibold text-xl tracking-tight">
          Add an area
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
          Type a UK town, a postcode district, or a full postcode. We&rsquo;ll
          check PropertyData for listings in that area right now.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="e.g. Manchester · M14 · SK4 4QR · Leeds"
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] outline-none focus:border-amber-400"
            disabled={pendingAdd}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={pendingAdd || !input.trim()}
            className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {pendingAdd ? 'Checking…' : '+ Add area'}
          </button>
        </div>

        {status.kind !== 'idle' && status.message && (
          <div
            className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
              status.kind === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : status.kind === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}
          >
            {status.message}
          </div>
        )}
      </div>

      {/* Areas list */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Your areas
            </p>
            <h2 className="mt-1 font-semibold text-xl tracking-tight">
              {areas.length === 0
                ? 'No areas yet'
                : `${areas.length} area${areas.length === 1 ? '' : 's'} · ${totalListings} listings`}
            </h2>
          </div>
          {areas.length > 0 && (
            <button
              type="button"
              onClick={handleScout}
              disabled={pendingScout}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {pendingScout ? 'Scouting…' : 'Run scout now'}
            </button>
          )}
        </div>

        {areas.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-muted-foreground text-sm">
            Add your first area above. Type a town like &ldquo;Manchester&rdquo;
            and we&rsquo;ll do the rest.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200">
            {areas.map((a) => {
              const count = a.lastProbe?.listingCount ?? 0;
              const error = a.lastProbe?.error ?? null;
              const checked = a.lastProbe?.checkedAt;
              return (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm"
                >
                  <span className="text-lg leading-none">
                    <StatusDot count={count} error={error} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-semibold text-slate-900">
                        {a.label}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {a.district} · seed {a.seedPostcode} · {a.radiusMiles}mi
                      </span>
                    </div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">
                      {error
                        ? `Error: ${error.slice(0, 80)}`
                        : `${count} listing${count === 1 ? '' : 's'}${checked ? ` · checked ${formatRelative(checked)}` : ''}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {count === 0 && !error && a.radiusMiles < 10 && (
                      <button
                        type="button"
                        onClick={() => handleWiden(a.id)}
                        disabled={pendingAction}
                        className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
                      >
                        Widen +1.5mi
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleReProbe(a.id)}
                      disabled={pendingAction}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      title="Re-check this area"
                    >
                      ↻
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(a.id)}
                      disabled={pendingAction}
                      className="rounded-lg border border-transparent px-2 py-1 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      aria-label={`Remove ${a.label}`}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-4 text-[12px] text-muted-foreground">
          Scout runs automatically every morning at 07:00 UTC. High-scoring
          leads land on the Today page.
        </p>

        {runResult !== null && (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              Last manual run details
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded bg-black/5 p-3 font-mono text-[11px]">
              {JSON.stringify(runResult, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
