'use client';

import { useState, useTransition } from 'react';
import {
  addArea,
  addAreaFromSuggestion,
  removeArea,
  reProbeArea,
  triggerScoutNow,
  widenArea,
  type Area,
  type AreaLeadStats,
  type Suggestion,
} from './areas-actions';
import { AreaTypeahead } from './area-typeahead';

type Props = {
  initial: Area[];
  leadStats: Record<string, AreaLeadStats>;
};

type Toast = {
  kind: 'success' | 'error' | 'info';
  message: string;
  undo?: () => void;
} | null;

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

/**
 * Inline SVG sparkline of the listing-count history. Renders nothing if
 * fewer than 2 datapoints.
 */
function Sparkline({
  history,
  width = 80,
  height = 24,
}: {
  history: Area['history'];
  width?: number;
  height?: number;
}) {
  if (!history || history.length < 2) {
    return <span className="text-[10px] text-slate-300">no history yet</span>;
  }
  const values = history.map((h) => h.count);
  const max = Math.max(...values, 1);
  const min = 0;
  const range = max - min || 1;
  const step = width / (history.length - 1);
  const points = history
    .map((h, i) => {
      const x = i * step;
      const y = height - ((h.count - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const last = values[values.length - 1] ?? 0;
  const stroke =
    last === 0 ? '#cbd5e1' : last < 5 ? '#f59e0b' : '#10b981';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-label={`Sparkline showing ${history.length} days of listings`}
    >
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function LeadBreakdown({ stats }: { stats: AreaLeadStats | undefined }) {
  if (!stats || stats.total7d === 0) return null;
  const { byType, total7d, strong7d } = stats;
  return (
    <p className="text-[11px] text-emerald-700">
      <span className="font-semibold">
        {total7d} lead{total7d === 1 ? '' : 's'} in last 7d
      </span>
      {strong7d > 0 && (
        <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-900">
          {strong7d} STRONG
        </span>
      )}
      <span className="ml-2 text-[10px] text-slate-500">
        {Object.entries(byType)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${k}:${v}`)
          .join(' · ')}
      </span>
    </p>
  );
}

export function AreasForm({ initial, leadStats }: Props) {
  const [areas, setAreas] = useState<Area[]>(initial);
  const [input, setInput] = useState('');
  const [pendingAdd, startAdd] = useTransition();
  const [pendingAction, startAction] = useTransition();
  const [pendingScout, startScout] = useTransition();
  const [toast, setToast] = useState<Toast>(null);
  /**
   * Optimistic row tracking — when we kick off an add, we insert a
   * placeholder row immediately, then replace it once the server responds.
   */
  const [pendingRows, setPendingRows] = useState<
    Array<{ tempId: string; label: string }>
  >([]);

  function showToast(t: Toast, ms = 5000) {
    setToast(t);
    if (t && ms > 0) setTimeout(() => setToast(null), ms);
  }

  function commitAdd(picked?: Suggestion) {
    const tempId = `tmp_${Date.now()}`;
    const optimisticLabel =
      picked?.label || input.trim() || 'Adding area…';
    setPendingRows((cur) => [...cur, { tempId, label: optimisticLabel }]);
    setInput('');

    startAdd(async () => {
      const r = picked
        ? await addAreaFromSuggestion({
            label: picked.label,
            seedPostcode: picked.seedPostcode,
            district: picked.district,
          })
        : await addArea(optimisticLabel);

      setPendingRows((cur) => cur.filter((p) => p.tempId !== tempId));

      if (r.ok) {
        setAreas((cur) => [...cur, r.area]);
        const c = r.area.lastProbe?.listingCount ?? 0;
        showToast({
          kind: c > 0 ? 'success' : 'info',
          message:
            c > 0
              ? `✓ ${r.area.label} added — ${c} listings found.`
              : `${r.area.label} added. No listings yet — try widening the radius.`,
        });
      } else {
        showToast({ kind: 'error', message: r.error });
      }
    });
  }

  function handleAdd() {
    if (!input.trim()) return;
    commitAdd();
  }

  function handlePick(s: Suggestion) {
    commitAdd(s);
  }

  function handleRemove(area: Area) {
    const idx = areas.findIndex((a) => a.id === area.id);
    if (idx === -1) return;

    const removed = area;
    const previous = areas;
    setAreas((cur) => cur.filter((a) => a.id !== area.id));

    const undo = () => {
      setAreas(previous);
      setToast(null);
    };

    showToast(
      {
        kind: 'info',
        message: `Removed ${area.label}.`,
        undo,
      },
      6000,
    );

    startAction(async () => {
      await removeArea(removed.id);
    });
  }

  function handleWiden(id: string) {
    startAction(async () => {
      const r = await widenArea(id);
      if (r.ok) {
        setAreas((cur) => cur.map((a) => (a.id === id ? r.area : a)));
        const c = r.area.lastProbe?.listingCount ?? 0;
        showToast({
          kind: c > 0 ? 'success' : 'info',
          message:
            c > 0
              ? `✓ Widened to ${r.area.radiusMiles}mi — ${c} listings now.`
              : `Widened to ${r.area.radiusMiles}mi. Still no listings.`,
        });
      } else {
        showToast({ kind: 'error', message: r.error });
      }
    });
  }

  function handleReProbe(id: string) {
    startAction(async () => {
      const r = await reProbeArea(id);
      if (r.ok) {
        setAreas((cur) => cur.map((a) => (a.id === id ? r.area : a)));
        const c = r.area.lastProbe?.listingCount ?? 0;
        showToast({
          kind: 'info',
          message: `Re-checked ${r.area.label} — ${c} listings.`,
        });
      }
    });
  }

  function handleScout() {
    showToast(null, 0);
    startScout(async () => {
      const r = await triggerScoutNow();
      if (r.ok && r.result) {
        const res = r.result as {
          qualified?: number;
          highScoreLeads?: number;
          strongLeads?: number;
          fetched?: number;
        };
        const found = res.qualified ?? 0;
        const strong = res.strongLeads ?? 0;
        const high = res.highScoreLeads ?? 0;
        showToast(
          {
            kind: found > 0 ? 'success' : 'info',
            message:
              found > 0
                ? `✓ Scout complete — ${found} leads (${strong} STRONG, ${high} scored ≥70). View them on Today →`
                : `Scout complete. No new leads this run.`,
          },
          8000,
        );
      } else {
        showToast({ kind: 'error', message: r.error ?? 'Scout failed.' });
      }
    });
  }

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
          Type a UK town, district, or postcode. We&rsquo;ll suggest as you
          type, then check PropertyData for live listings the moment you add.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <AreaTypeahead
            value={input}
            onChange={setInput}
            onPick={handlePick}
            onSubmit={handleAdd}
            disabled={pendingAdd}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={pendingAdd || !input.trim()}
            className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            + Add area
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${
            toast.kind === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : toast.kind === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <p className="flex-1">{toast.message}</p>
          {toast.undo && (
            <button
              type="button"
              onClick={toast.undo}
              className="rounded-lg border border-current/30 bg-white/40 px-3 py-1 text-xs font-medium hover:bg-white"
            >
              Undo
            </button>
          )}
        </div>
      )}

      {/* Areas list */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Your areas
            </p>
            <h2 className="mt-1 font-semibold text-xl tracking-tight">
              {areas.length === 0 && pendingRows.length === 0
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

        {areas.length === 0 && pendingRows.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-muted-foreground text-sm">
            Add your first area above. Most founders start with 3&ndash;5
            cities. Try &ldquo;Manchester&rdquo;, &ldquo;Stockport&rdquo;,
            &ldquo;Leeds&rdquo;.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200">
            {areas.map((a) => {
              const count = a.lastProbe?.listingCount ?? 0;
              const error = a.lastProbe?.error ?? null;
              const checked = a.lastProbe?.checkedAt;
              const stats = leadStats[a.district];
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
                    <LeadBreakdown stats={stats} />
                  </div>
                  <Sparkline history={a.history} />
                  <div className="flex items-center gap-1">
                    {!error && a.radiusMiles < 10 && (
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
                      onClick={() => handleRemove(a)}
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
            {/* Optimistic placeholder rows for areas being added */}
            {pendingRows.map((p) => (
              <li
                key={p.tempId}
                className="flex items-center gap-3 px-4 py-3 text-sm opacity-70"
              >
                <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-amber-300" />
                <div className="flex-1">
                  <span className="font-semibold text-slate-900">
                    {p.label}
                  </span>
                  <span className="ml-2 font-mono text-[11px] text-slate-500">
                    Checking listings…
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-[12px] text-muted-foreground">
          Scout runs automatically every morning at{' '}
          {new Date(new Date().setUTCHours(7, 0, 0, 0)).toLocaleString(
            'en-GB',
            {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Europe/London',
              timeZoneName: 'short',
            },
          )}{' '}
          (UK time). High-scoring leads land on the Today page.
        </p>
      </div>
    </div>
  );
}
