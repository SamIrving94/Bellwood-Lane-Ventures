'use client';

import { useState, useTransition } from 'react';
import { AreaTypeahead } from './area-typeahead';
import {
  type Area,
  type AreaLeadStats,
  type AreaTrack,
  type Suggestion,
  addArea,
  addAreaFromSuggestion,
  clearAllLeads,
  reProbeArea,
  removeArea,
  setAreaTrack,
  triggerScoutNow,
  widenArea,
} from './areas-actions';

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
  const stroke = last === 0 ? '#cbd5e1' : last < 5 ? '#f59e0b' : '#10b981';

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

function AreaRow({
  area: a,
  stats,
  pendingAction,
  onWiden,
  onReProbe,
  onRemove,
  onToggleTrack,
}: {
  area: Area;
  stats: AreaLeadStats | undefined;
  pendingAction: boolean;
  onWiden: (id: string) => void;
  onReProbe: (id: string) => void;
  onRemove: (area: Area) => void;
  onToggleTrack: (area: Area) => void;
}) {
  const count = a.lastProbe?.listingCount ?? 0;
  const error = a.lastProbe?.error ?? null;
  const checked = a.lastProbe?.checkedAt;
  const isPrime = a.track === 'prime';
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
      <span className="text-lg leading-none">
        <StatusDot count={count} error={error} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold text-slate-900">{a.label}</span>
          {isPrime && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-[10px] text-amber-800">
              ★ Prime
            </span>
          )}
          <span className="font-mono text-[11px] text-slate-500">
            {a.district} · seed {a.seedPostcode} · {a.radiusMiles}mi
          </span>
        </div>
        <div
          className="mt-0.5 text-[12px] text-muted-foreground"
          title={error ?? undefined}
        >
          {error
            ? `Error: ${error.slice(0, 160)}`
            : `${count} listing${count === 1 ? '' : 's'}${checked ? ` · checked ${formatRelative(checked)}` : ''}`}
        </div>
        <LeadBreakdown stats={stats} />
      </div>
      <Sparkline history={a.history} />
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onToggleTrack(a)}
          disabled={pendingAction}
          title={
            isPrime
              ? 'Scanned every day. Click to move back into the volume rotation.'
              : 'Click to scan this area every day, regardless of rotation.'
          }
          className={`rounded-lg border px-3 py-1 font-medium text-xs transition disabled:opacity-50 ${
            isPrime
              ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          {isPrime ? '★ Prime' : 'Make prime'}
        </button>
        {a.radiusMiles < 10 && (
          <button
            type="button"
            onClick={() => onWiden(a.id)}
            disabled={pendingAction}
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1 font-medium text-amber-900 text-xs transition hover:bg-amber-100 disabled:opacity-50"
          >
            Widen +1.5mi
          </button>
        )}
        <button
          type="button"
          onClick={() => onReProbe(a.id)}
          disabled={pendingAction}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1 font-medium text-slate-700 text-xs transition hover:bg-slate-50 disabled:opacity-50"
          title="Re-check this area"
        >
          ↻
        </button>
        <button
          type="button"
          onClick={() => onRemove(a)}
          disabled={pendingAction}
          className="rounded-lg border border-transparent px-2 py-1 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
          aria-label={`Remove ${a.label}`}
        >
          ✕
        </button>
      </div>
    </li>
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
        <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 font-medium text-[10px] text-emerald-900">
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
  const [addTrack, setAddTrack] = useState<AreaTrack>('volume');
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
    const optimisticLabel = picked?.label || input.trim() || 'Adding area…';
    setPendingRows((cur) => [...cur, { tempId, label: optimisticLabel }]);
    setInput('');

    startAdd(async () => {
      const r = picked
        ? await addAreaFromSuggestion(
            {
              label: picked.label,
              seedPostcode: picked.seedPostcode,
              district: picked.district,
            },
            addTrack
          )
        : await addArea(optimisticLabel, addTrack);

      setPendingRows((cur) => cur.filter((p) => p.tempId !== tempId));

      if (r.ok) {
        setAreas((cur) => [...cur, r.area]);
        const c = r.area.lastProbe?.listingCount ?? 0;
        const probeError = r.area.lastProbe?.error ?? null;
        const primeNote =
          r.area.track === 'prime' ? ' · scanned every day' : '';
        // Three genuinely different outcomes, three different messages. The
        // old code folded "the probe FAILED" into "no listings yet — try
        // widening the radius", which is how a dead seed postcode once spent
        // days on this page disguised as an empty area.
        if (probeError) {
          showToast({
            kind: 'error',
            message: `${r.area.label} added, but the first check failed: ${probeError} Use "Re-check" to retry.`,
          });
        } else {
          showToast({
            kind: c > 0 ? 'success' : 'info',
            message:
              c > 0
                ? `✓ ${r.area.label} added — ${c} listings found${primeNote}.`
                : `${r.area.label} added${primeNote}. No listings yet — try widening the radius.`,
          });
        }
      } else {
        showToast({ kind: 'error', message: r.error });
      }
    });
  }

  function handleAdd() {
    if (!input.trim()) return;
    commitAdd();
  }

  function handleToggleTrack(area: Area) {
    const next: AreaTrack = area.track === 'prime' ? 'volume' : 'prime';
    setAreas((cur) =>
      cur.map((a) => (a.id === area.id ? { ...a, track: next } : a))
    );
    startAction(async () => {
      const r = await setAreaTrack(area.id, next);
      if (r.ok) {
        setAreas((cur) => cur.map((a) => (a.id === area.id ? r.area : a)));
        showToast({
          kind: 'info',
          message:
            next === 'prime'
              ? `★ ${area.label} is now a prime focus — scanned every day.`
              : `${area.label} moved back into the volume rotation.`,
        });
      } else {
        // Revert optimistic flip on failure.
        setAreas((cur) => cur.map((a) => (a.id === area.id ? area : a)));
        showToast({ kind: 'error', message: r.error });
      }
    });
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
      6000
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
        const stillFailing = r.area.lastProbe?.error ?? null;
        showToast(
          stillFailing
            ? {
                kind: 'error',
                message: `${r.area.label} is still failing: ${stillFailing}`,
              }
            : {
                kind: 'info',
                message: `Re-checked ${r.area.label} — ${c} listings.`,
              }
        );
      } else {
        showToast({ kind: 'error', message: r.error });
      }
    });
  }

  function handleClearAll() {
    const confirm = window.confirm(
      'Delete ALL scouted leads from the database?\n\nThis wipes every ScoutLead row + their feedback. Use this when the schema has been upgraded and existing leads are sparse. After clearing, click "Run scout now" to repopulate.\n\nThis cannot be undone.'
    );
    if (!confirm) return;
    showToast(null, 0);
    startScout(async () => {
      const r = await clearAllLeads();
      if (r.ok) {
        showToast(
          {
            kind: 'success',
            message: `✓ Cleared ${r.deletedLeads} lead${r.deletedLeads === 1 ? '' : 's'} (${r.deletedFeedback} feedback rows). Click 'Run scout now' to repopulate.`,
          },
          10000
        );
      } else {
        showToast({
          kind: 'error',
          message: r.error ?? 'Clear failed.',
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
          8000
        );
      } else {
        showToast({ kind: 'error', message: r.error ?? 'Scout failed.' });
      }
    });
  }

  const totalListings = areas.reduce(
    (s, a) => s + (a.lastProbe?.listingCount ?? 0),
    0
  );
  const primeAreas = areas.filter((a) => a.track === 'prime');
  const volumeAreas = areas.filter((a) => a.track !== 'prime');

  return (
    <div className="space-y-6">
      {/* Add row */}
      <div className="rounded-2xl border bg-card p-6">
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.22em]">
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
            className="rounded-xl bg-slate-900 px-6 py-3 font-medium text-sm text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            + Add area
          </button>
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Scan as:</span>
          <button
            type="button"
            onClick={() => setAddTrack('volume')}
            className={`rounded-full px-3 py-1 font-medium text-xs transition-colors ${
              addTrack === 'volume'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Volume
          </button>
          <button
            type="button"
            onClick={() => setAddTrack('prime')}
            title="Scanned every day, not subject to the 6-area rotation — for scarce, high-value patches worth checking daily."
            className={`rounded-full px-3 py-1 font-medium text-xs transition-colors ${
              addTrack === 'prime'
                ? 'bg-amber-500 text-white'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            ★ Prime focus
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
              className="rounded-lg border border-current/30 bg-white/40 px-3 py-1 font-medium text-xs hover:bg-white"
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
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.22em]">
              Your areas
            </p>
            <h2 className="mt-1 font-semibold text-xl tracking-tight">
              {areas.length === 0 && pendingRows.length === 0
                ? 'No areas yet'
                : `${areas.length} area${areas.length === 1 ? '' : 's'} · ${totalListings} listings`}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleClearAll}
              disabled={pendingScout}
              className="rounded-xl border border-rose-300 bg-white px-4 py-2.5 font-medium text-rose-700 text-xs transition hover:bg-rose-50 disabled:opacity-50"
              title="Wipe every scouted lead from the database. Use before a fresh scout when the schema has changed."
            >
              Clear all leads
            </button>
            {areas.length > 0 && (
              <button
                type="button"
                onClick={handleScout}
                disabled={pendingScout}
                className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-medium text-slate-700 text-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                {pendingScout ? 'Scouting…' : 'Run scout now'}
              </button>
            )}
          </div>
        </div>

        {areas.length === 0 && pendingRows.length === 0 ? (
          <p className="mt-6 rounded-xl border border-slate-300 border-dashed bg-slate-50 p-6 text-center text-muted-foreground text-sm">
            Add your first area above. Most founders start with 3&ndash;5
            cities. Try &ldquo;Manchester&rdquo;, &ldquo;Stockport&rdquo;,
            &ldquo;Leeds&rdquo;.
          </p>
        ) : (
          <>
            {primeAreas.length > 0 && (
              <>
                <p className="mt-5 font-mono text-[10px] text-amber-700 uppercase tracking-[0.18em]">
                  ★ Prime focus — scanned every day
                </p>
                <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-amber-200">
                  {primeAreas.map((a) => (
                    <AreaRow
                      key={a.id}
                      area={a}
                      stats={leadStats[a.district]}
                      pendingAction={pendingAction}
                      onWiden={handleWiden}
                      onReProbe={handleReProbe}
                      onRemove={handleRemove}
                      onToggleTrack={handleToggleTrack}
                    />
                  ))}
                </ul>
              </>
            )}

            {(volumeAreas.length > 0 || pendingRows.length > 0) && (
              <>
                {primeAreas.length > 0 && (
                  <p className="mt-5 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
                    Volume rotation — 6 areas/day
                  </p>
                )}
                <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200">
                  {volumeAreas.map((a) => (
                    <AreaRow
                      key={a.id}
                      area={a}
                      stats={leadStats[a.district]}
                      pendingAction={pendingAction}
                      onWiden={handleWiden}
                      onReProbe={handleReProbe}
                      onRemove={handleRemove}
                      onToggleTrack={handleToggleTrack}
                    />
                  ))}
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
              </>
            )}
          </>
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
            }
          )}{' '}
          (UK time). High-scoring leads land on the Today page.
        </p>
      </div>
    </div>
  );
}
