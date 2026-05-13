'use client';

import { useState, useTransition } from 'react';
import { setTargetPostcodes, triggerScoutingCron } from './actions';

type Props = {
  initialPostcodes: string[];
};

export function ScoutingPostcodesForm({ initialPostcodes }: Props) {
  const [postcodes, setPostcodes] = useState<string[]>(initialPostcodes);
  const [input, setInput] = useState('');
  const [saving, startSaving] = useTransition();
  const [running, startRunning] = useTransition();
  const [status, setStatus] = useState<{
    kind: 'idle' | 'saved' | 'error' | 'cron';
    message?: string;
  }>({ kind: 'idle' });

  const handleAdd = () => {
    if (!input.trim()) return;
    // Allow comma or space-separated entry
    const parts = input.split(/[,\s]+/).map((p) => p.trim().toUpperCase()).filter(Boolean);
    setPostcodes((cur) => Array.from(new Set([...cur, ...parts])));
    setInput('');
  };

  const handleRemove = (pc: string) => {
    setPostcodes((cur) => cur.filter((p) => p !== pc));
  };

  const handleSave = () => {
    startSaving(async () => {
      const result = await setTargetPostcodes(postcodes);
      if (result.success) {
        if (result.postcodes) setPostcodes(result.postcodes);
        const rejected = result.rejected?.length
          ? ` (rejected: ${result.rejected.join(', ')})`
          : '';
        setStatus({
          kind: 'saved',
          message: `Saved ${result.postcodes?.length ?? 0} postcodes.${rejected}`,
        });
      } else {
        setStatus({ kind: 'error', message: result.error ?? 'Save failed.' });
      }
    });
  };

  const handleRunNow = () => {
    startRunning(async () => {
      setStatus({ kind: 'idle' });
      const result = await triggerScoutingCron();
      if (result.success && result.result) {
        const r = result.result as {
          fetched?: number;
          qualified?: number;
          highScoreLeads?: number;
          strongLeads?: number;
        };
        setStatus({
          kind: 'cron',
          message: `Run complete. Fetched ${r.fetched ?? 0}, qualified ${r.qualified ?? 0}, ${r.highScoreLeads ?? 0} scored ≥70 (${r.strongLeads ?? 0} STRONG).`,
        });
      } else {
        setStatus({ kind: 'error', message: result.error ?? 'Cron failed.' });
      }
    });
  };

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-6">
      {/* Pills of current postcodes */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">Active postcodes ({postcodes.length})</p>
          {postcodes.length > 0 && (
            <button
              type="button"
              onClick={() => setPostcodes([])}
              className="text-muted-foreground text-xs hover:text-foreground"
            >
              Clear all
            </button>
          )}
        </div>
        {postcodes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-muted-foreground text-sm">
            No postcodes set. Add one or more below.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {postcodes.map((pc) => (
              <span
                key={pc}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 font-mono text-[12px] text-amber-900"
              >
                {pc}
                <button
                  type="button"
                  onClick={() => handleRemove(pc)}
                  className="text-amber-600 hover:text-amber-900"
                  aria-label={`Remove ${pc}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Add input */}
      <div className="flex flex-col gap-2 sm:flex-row">
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
          placeholder="Add postcode(s) — e.g. M14, SK4, LS17"
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-amber-400"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium hover:bg-slate-50"
        >
          Add
        </button>
      </div>

      {/* Save + Run Now */}
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={handleRunNow}
          disabled={running || saving}
          className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {running ? 'Running scout…' : 'Run scout now'}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || running}
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {/* Status message */}
      {status.kind !== 'idle' && status.message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            status.kind === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : status.kind === 'cron'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}
        >
          {status.message}
        </div>
      )}
    </div>
  );
}
