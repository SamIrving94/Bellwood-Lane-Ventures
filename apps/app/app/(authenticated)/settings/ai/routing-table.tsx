'use client';

import { useState, useTransition } from 'react';
import { type RouteInput, saveRoute } from '../../../actions/ai-routing/update';

/**
 * Editable model-routing table. One row per LLM feature. Leave Model
 * blank to keep the code default (Claude, via OpenRouter when keyed); set
 * it to override with any OpenRouter id, e.g. "z-ai/glm-5.2". Shadow
 * model runs the same prompts silently for comparison on the LLM usage
 * page.
 */

type Row = {
  feature: string;
  callsLast30d: number;
  codeDefault: string | null;
  route: RouteInput;
};

/**
 * Ids verified on openrouter.ai, 2026-09-12. A bare Claude id goes via
 * OpenRouter too (mapped to the dotted id) — the first two are the code
 * defaults. The open-weight rows are the ones worth shadow-testing:
 * cheap, permissive licences, and the same JSON discipline on our prompts
 * is what the shadow run measures. Photo features need a vision model
 * (Claude, kimi-k2.6, llama-4-maverick).
 */
const MODEL_SUGGESTIONS = [
  'claude-sonnet-4-5',
  'claude-haiku-4-5',
  'anthropic/claude-sonnet-4.5',
  'anthropic/claude-haiku-4.5',
  'qwen/qwen3-235b-a22b-2507',
  'deepseek/deepseek-v4-flash',
  'z-ai/glm-5.2',
  'moonshotai/kimi-k2.6',
  'meta-llama/llama-4-maverick',
  // Sep 2026 tactic (docs/LLM-ROUTING.md § Tactic): vision on a budget and
  // a dense open-weight JSON worker. Ids from the openrouter.ai model pages,
  // 13 Sep 2026 — shadow first, as always.
  'minimax/minimax-m3',
  'qwen/qwen3.8-27b',
];

export function RoutingTable({ initialRows }: { initialRows: Row[] }) {
  return (
    <div className="space-y-3">
      <datalist id="model-suggestions">
        {MODEL_SUGGESTIONS.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      {initialRows.map((row) => (
        <FeatureRow key={row.feature} row={row} />
      ))}
    </div>
  );
}

function FeatureRow({ row }: { row: Row }) {
  const [model, setModel] = useState(row.route.model ?? '');
  const [shadowModel, setShadowModel] = useState(row.route.shadowModel ?? '');
  const [piiSafe, setPiiSafe] = useState(!!row.route.piiSafe);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  const dirty =
    model !== (row.route.model ?? '') ||
    shadowModel !== (row.route.shadowModel ?? '') ||
    piiSafe !== !!row.route.piiSafe;

  const save = () => {
    setStatus(null);
    startTransition(async () => {
      try {
        await saveRoute(row.feature, {
          model,
          shadowModel,
          piiSafe,
        });
        setStatus('Saved — live within 60s');
      } catch {
        setStatus('Save failed — try again');
      }
    });
  };

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono font-semibold text-sm">{row.feature}</p>
          <p className="text-[11px] text-muted-foreground">
            {row.callsLast30d} call{row.callsLast30d === 1 ? '' : 's'} · 30d
            {row.codeDefault ? ` · code default: ${row.codeDefault}` : ''}
          </p>
        </div>
        {row.route.model && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-[11px] text-amber-700">
            Overridden
          </span>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
            Model (blank = code default)
          </span>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            list="model-suggestions"
            placeholder="e.g. moonshotai/kimi-k2.6"
            className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 font-mono text-sm"
          />
        </label>
        <label className="block">
          <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
            Shadow model (silent A/B)
          </span>
          <input
            value={shadowModel}
            onChange={(e) => setShadowModel(e.target.value)}
            list="model-suggestions"
            placeholder="e.g. google/gemini-3-flash"
            className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 font-mono text-sm"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={piiSafe}
            onChange={(e) => setPiiSafe(e.target.checked)}
          />
          <span>
            <span className="font-medium">PII-safe pinning</span>{' '}
            <span className="text-muted-foreground">
              — vetted US hosts only, zero retention, no training
            </span>
          </span>
        </label>
        <div className="flex items-center gap-3">
          {status && (
            <span className="text-[11px] text-muted-foreground">{status}</span>
          )}
          <button
            type="button"
            disabled={!dirty || isPending}
            onClick={save}
            className="rounded-md bg-primary px-4 py-1.5 font-medium text-primary-foreground text-sm disabled:opacity-40"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
