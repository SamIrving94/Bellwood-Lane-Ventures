'use client';

import type { ScorerConfig } from '@repo/scouting/src/scorer-config';
import { Button } from '@repo/design-system/components/ui/button';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { saveAndActivateConfig } from '@/app/actions/scorer-config/manage';

// Plain-English labels for the lead-type weights founders care about.
const LEAD_TYPE_LABELS: Record<string, string> = {
  probate: 'Probate',
  distressed_sale: 'Distressed sale',
  mortgage_default: 'Mortgage default',
  lease_expiry: 'Lease expiry',
  divorce: 'Divorce',
  repossession: 'Repossession',
  empty_property: 'Empty property',
  downsizing: 'Downsizing',
  chain_break: 'Chain break',
  relocation: 'Relocation',
  unknown: 'Unknown / other',
};

type EditableState = {
  leadTypeScores: Record<string, number>;
  verdictThresholds: { strong: number; viable: number; thin: number };
};

function extract(config: ScorerConfig): EditableState {
  return {
    leadTypeScores: { ...config.leadTypeScores },
    verdictThresholds: { ...config.verdictThresholds },
  };
}

function NumberField({
  label,
  hint,
  value,
  liveValue,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  liveValue: number;
  onChange: (n: number) => void;
}) {
  const changed = value !== liveValue;
  return (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="flex-1 text-sm">
        {label}
        {hint ? (
          <span className="ml-1 text-muted-foreground text-xs">{hint}</span>
        ) : null}
      </span>
      <span className="flex items-center gap-2">
        {changed && (
          <span className="font-mono text-[10px] text-amber-600">
            was {liveValue}
          </span>
        )}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`w-20 rounded-md border bg-background px-2 py-1 text-right font-mono text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring ${
            changed ? 'border-amber-400 bg-amber-50' : ''
          }`}
        />
      </span>
    </label>
  );
}

export function ConfigEditor({
  live,
  defaults,
  liveVersion,
}: {
  live: ScorerConfig;
  defaults: ScorerConfig;
  liveVersion: number | null;
}) {
  const liveEditable = extract(live);
  const [state, setState] = useState<EditableState>(liveEditable);
  const [description, setDescription] = useState('');
  const [isPending, startTransition] = useTransition();

  const dirty = JSON.stringify(state) !== JSON.stringify(liveEditable);

  const resetToLive = () => setState(extract(live));
  const resetToDefaults = () => setState(extract(defaults));

  const setLeadType = (key: string, n: number) =>
    setState((s) => ({
      ...s,
      leadTypeScores: { ...s.leadTypeScores, [key]: n },
    }));

  const handleSave = () => {
    if (!dirty) {
      toast.message('No changes to save.');
      return;
    }
    if (!description.trim()) {
      toast.error('Add a short note describing what you changed.');
      return;
    }
    startTransition(async () => {
      try {
        // Send the FULL live config with our three edited groups overridden,
        // so advanced knobs set elsewhere are never silently reset.
        const next = {
          ...live,
          leadTypeScores: state.leadTypeScores,
          verdictThresholds: state.verdictThresholds,
        };
        const { version } = await saveAndActivateConfig(next, description);
        toast.success(`Activated v${version}. Next scout will use it.`);
        setDescription('');
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to save config.',
        );
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* Verdict thresholds */}
      <section className="rounded-xl border bg-card">
        <div className="border-b p-4">
          <h2 className="font-medium text-sm">Verdict cut-offs</h2>
          <p className="mt-0.5 text-muted-foreground text-xs">
            A lead&apos;s 0–100 score becomes a verdict at these thresholds.
            Higher = stricter (fewer leads make the shortlist).
          </p>
        </div>
        <div className="divide-y px-4">
          <NumberField
            label="Strong"
            hint="≥ this score"
            value={state.verdictThresholds.strong}
            liveValue={liveEditable.verdictThresholds.strong}
            onChange={(n) =>
              setState((s) => ({
                ...s,
                verdictThresholds: { ...s.verdictThresholds, strong: n },
              }))
            }
          />
          <NumberField
            label="Viable"
            hint="≥ this score"
            value={state.verdictThresholds.viable}
            liveValue={liveEditable.verdictThresholds.viable}
            onChange={(n) =>
              setState((s) => ({
                ...s,
                verdictThresholds: { ...s.verdictThresholds, viable: n },
              }))
            }
          />
          <NumberField
            label="Thin"
            hint="≥ this score (below = Pass)"
            value={state.verdictThresholds.thin}
            liveValue={liveEditable.verdictThresholds.thin}
            onChange={(n) =>
              setState((s) => ({
                ...s,
                verdictThresholds: { ...s.verdictThresholds, thin: n },
              }))
            }
          />
        </div>
      </section>

      {/* Lead-type weights */}
      <section className="rounded-xl border bg-card">
        <div className="border-b p-4">
          <h2 className="font-medium text-sm">Lead-type weight</h2>
          <p className="mt-0.5 text-muted-foreground text-xs">
            How much urgency each lead type earns (out of 40 motivation
            points). Raise the types that convert well for you; trim the noisy
            ones.
          </p>
        </div>
        <div className="divide-y px-4">
          {Object.keys(state.leadTypeScores)
            .sort(
              (a, b) => state.leadTypeScores[b]! - state.leadTypeScores[a]!,
            )
            .map((key) => (
              <NumberField
                key={key}
                label={LEAD_TYPE_LABELS[key] ?? key}
                value={state.leadTypeScores[key]!}
                liveValue={liveEditable.leadTypeScores[key] ?? 0}
                onChange={(n) => setLeadType(key, n)}
              />
            ))}
        </div>
      </section>


      {/* Save bar */}
      <div className="sticky bottom-4 rounded-xl border bg-card/95 p-4 shadow-lg backdrop-blur">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What did you change and why? (e.g. 'Trim relocation — low converters')"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToLive}
              disabled={isPending || !dirty}
            >
              Reset to live
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToDefaults}
              disabled={isPending}
            >
              Load built-in defaults
            </Button>
          </div>
          <div className="flex items-center gap-3">
            {dirty && (
              <span className="text-amber-600 text-xs">Unsaved changes</span>
            )}
            <Button onClick={handleSave} disabled={isPending || !dirty}>
              {isPending
                ? 'Activating…'
                : liveVersion
                  ? 'Save & activate new version'
                  : 'Save & activate first version'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
