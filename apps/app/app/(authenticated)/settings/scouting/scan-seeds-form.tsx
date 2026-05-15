'use client';

import { useState, useTransition } from 'react';
import {
  diagnoseSourcedProperties,
  setScanSeeds,
  type ScanSeed,
} from './actions';

type Props = {
  initialSeeds: ScanSeed[];
};

type Status = {
  kind: 'idle' | 'saved' | 'error' | 'diag';
  message?: string;
  detail?: unknown;
};

export function ScanSeedsForm({ initialSeeds }: Props) {
  const [seeds, setSeeds] = useState<ScanSeed[]>(initialSeeds);
  const [label, setLabel] = useState('');
  const [postcode, setPostcode] = useState('');
  const [radius, setRadius] = useState('1');
  const [saving, startSaving] = useTransition();
  const [diagnosing, startDiagnosing] = useTransition();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const handleAdd = () => {
    if (!postcode.trim()) return;
    const r = Number(radius);
    setSeeds((cur) => [
      ...cur,
      {
        label: label.trim() || undefined,
        postcode: postcode.trim().toUpperCase(),
        radiusMiles: Number.isFinite(r) && r > 0 ? r : 1,
      },
    ]);
    setLabel('');
    setPostcode('');
    setRadius('1');
  };

  const handleRemove = (i: number) => {
    setSeeds((cur) => cur.filter((_, idx) => idx !== i));
  };

  const handleSave = () => {
    startSaving(async () => {
      const result = await setScanSeeds(seeds);
      if (result.success) {
        if (result.seeds) setSeeds(result.seeds);
        const rejected = result.rejected?.length
          ? ` Rejected: ${result.rejected.map((r) => `${r.postcode} (${r.reason})`).join('; ')}`
          : '';
        setStatus({
          kind: 'saved',
          message: `Saved ${result.seeds?.length ?? 0} scan seed${(result.seeds?.length ?? 0) === 1 ? '' : 's'}.${rejected}`,
        });
      } else {
        setStatus({ kind: 'error', message: result.error ?? 'Save failed.' });
      }
    });
  };

  const handleTest = (seed: ScanSeed) => {
    startDiagnosing(async () => {
      setStatus({ kind: 'idle' });
      const result = await diagnoseSourcedProperties(seed.postcode, {
        radiusMiles: seed.radiusMiles,
      });
      setStatus({
        kind: 'diag',
        message: result.summary ?? (result.error ? `Error: ${result.error}` : 'No summary'),
        detail: result,
      });
    });
  };

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-6">
      {/* Current seeds */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">
            Active seeds ({seeds.length})
          </p>
          {seeds.length > 0 && (
            <button
              type="button"
              onClick={() => setSeeds([])}
              className="text-muted-foreground text-xs hover:text-foreground"
            >
              Clear all
            </button>
          )}
        </div>
        {seeds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-muted-foreground text-sm">
            No seeds yet. Add a full postcode + radius below.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200">
            {seeds.map((s, i) => (
              <li
                key={`${s.postcode}-${i}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-amber-900">
                      {s.postcode}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      · {s.radiusMiles} mi
                    </span>
                    {s.label && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                        {s.label}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleTest(s)}
                    disabled={diagnosing || saving}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    {diagnosing ? 'Testing…' : 'Test'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(i)}
                    className="rounded-lg border border-transparent px-2 py-1 text-amber-600 hover:bg-amber-50 hover:text-amber-900"
                    aria-label={`Remove ${s.postcode}`}
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add seed row */}
      <div className="grid gap-2 sm:grid-cols-[1fr_1.2fr_0.6fr_auto]">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. Fallowfield)"
          maxLength={60}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-amber-400"
        />
        <input
          type="text"
          value={postcode}
          onChange={(e) => setPostcode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Full postcode (e.g. M14 5LL)"
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm uppercase outline-none focus:border-amber-400"
        />
        <input
          type="number"
          min="0.5"
          max="20"
          step="0.5"
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          placeholder="Radius (mi)"
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-amber-400"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium hover:bg-slate-50"
        >
          Add
        </button>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save seeds'}
        </button>
      </div>

      {/* Status message */}
      {status.kind !== 'idle' && status.message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            status.kind === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : status.kind === 'saved'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <p>{status.message}</p>
          {status.detail !== undefined && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs opacity-60">
                Raw response
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded bg-black/5 p-3 font-mono text-[11px]">
                {JSON.stringify(status.detail, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* Help */}
      <div className="rounded-xl border border-dashed bg-slate-50/50 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-slate-700">Picking a seed</p>
        <ul className="mt-1.5 space-y-1">
          <li>· Use a full postcode you know (any address in the area is fine).</li>
          <li>· 1 mile covers a single district pocket. 3 miles covers a small town.</li>
          <li>· One PropertyData call per seed per day ≈ 3 credits each.</li>
          <li>· Hit <strong>Test</strong> on a seed to confirm it returns listings before committing.</li>
        </ul>
      </div>
    </div>
  );
}
