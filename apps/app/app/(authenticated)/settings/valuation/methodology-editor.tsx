'use client';

import { saveValuationConfig } from '@/app/actions/valuation-config/save';
import type { ValuationConfig } from '@repo/valuation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

const CONDITION_LEVELS: { key: string; label: string }[] = [
  { key: 'turnkey', label: 'Turnkey' },
  { key: 'dated', label: 'Dated' },
  { key: 'tired', label: 'Tired' },
  { key: 'unmodernised', label: 'Unmodernised' },
  { key: 'derelict', label: 'Derelict' },
];

const VISION_CONDITIONS: { key: string; label: string }[] = [
  { key: 'pristine', label: 'Pristine' },
  { key: 'fair', label: 'Fair' },
  { key: 'tired', label: 'Tired' },
  { key: 'distressed', label: 'Distressed' },
  { key: 'derelict', label: 'Derelict' },
];

const FLAGS: { key: string; label: string }[] = [
  { key: 'no_kitchen', label: 'Missing kitchen' },
  { key: 'no_bathroom', label: 'Missing bathroom' },
  { key: 'roof_damage', label: 'Roof damage' },
  { key: 'damp_visible', label: 'Damp treatment' },
  { key: 'structural_concern', label: 'Structural works' },
  { key: 'fire_damage', label: 'Fire damage' },
  { key: 'boarded_windows', label: 'Boarded windows' },
  { key: 'broken_windows', label: 'Broken windows' },
  { key: 'squatting_signs', label: 'Clearance / security' },
  { key: 'overgrown_garden', label: 'Garden clearance' },
];

function NumberField({
  label,
  suffix,
  value,
  onChange,
}: {
  label: string;
  suffix?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="flex items-center gap-1">
        <input
          className="w-28 rounded-md border bg-background px-2 py-1 text-right text-sm tabular-nums"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix ? (
          <span className="w-8 text-muted-foreground text-xs">{suffix}</span>
        ) : null}
      </span>
    </label>
  );
}

export function MethodologyEditor({ config }: { config: ValuationConfig }) {
  // Edit in friendly units: discounts as %, £/m² and £ as pounds, ROI as %.
  const [discounts, setDiscounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      CONDITION_LEVELS.map((c) => [
        c.key,
        String(
          Math.round(
            (config.conditionDiscounts[
              c.key as keyof typeof config.conditionDiscounts
            ] ?? 0) * 100
          )
        ),
      ])
    )
  );
  const [perSqm, setPerSqm] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      VISION_CONDITIONS.map((c) => [
        c.key,
        String(Math.round((config.refurbPerSqm[c.key] ?? 0) / 100)),
      ])
    )
  );
  const [flagCosts, setFlagCosts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      FLAGS.map((f) => [
        f.key,
        String(Math.round((config.refurbFlagCosts[f.key] ?? 0) / 100)),
      ])
    )
  );
  const [defaultArea, setDefaultArea] = useState(
    String(config.defaultFloorAreaSqm)
  );
  const [targetRoi, setTargetRoi] = useState(
    String(Math.round(config.targetCashRoi * 100))
  );
  const [isPending, startTransition] = useTransition();

  const numOr = (s: string, fallback = 0) => {
    const n = Number(s);
    return Number.isFinite(n) ? n : fallback;
  };

  const handleSave = () => {
    const partial = {
      conditionDiscounts: Object.fromEntries(
        CONDITION_LEVELS.map((c) => [
          c.key,
          numOr(discounts[c.key] ?? '') / 100,
        ])
      ),
      refurbPerSqm: Object.fromEntries(
        VISION_CONDITIONS.map((c) => [
          c.key,
          Math.round(numOr(perSqm[c.key] ?? '') * 100),
        ])
      ),
      refurbFlagCosts: Object.fromEntries(
        FLAGS.map((f) => [
          f.key,
          Math.round(numOr(flagCosts[f.key] ?? '') * 100),
        ])
      ),
      defaultFloorAreaSqm: numOr(defaultArea, 75),
      targetCashRoi: numOr(targetRoi) / 100,
    };
    startTransition(async () => {
      const res = await saveValuationConfig(partial);
      if (res.ok) toast.success('Valuation settings saved');
      else toast.error(res.error ?? 'Save failed');
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-4">
        <h3 className="font-semibold">As-is discount by condition</h3>
        <p className="mb-2 text-muted-foreground text-sm">
          How far below the comp value a property sits today, before refurb.
        </p>
        <div className="divide-y">
          {CONDITION_LEVELS.map((c) => (
            <NumberField
              key={c.key}
              label={c.label}
              suffix="%"
              value={discounts[c.key] ?? ''}
              onChange={(v) => setDiscounts((s) => ({ ...s, [c.key]: v }))}
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h3 className="font-semibold">Refurb base cost (£ per m²)</h3>
        <p className="mb-2 text-muted-foreground text-sm">
          Whole-property works by photo condition, multiplied by floor area.
        </p>
        <div className="divide-y">
          {VISION_CONDITIONS.map((c) => (
            <NumberField
              key={c.key}
              label={c.label}
              suffix="£/m²"
              value={perSqm[c.key] ?? ''}
              onChange={(v) => setPerSqm((s) => ({ ...s, [c.key]: v }))}
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h3 className="font-semibold">Defect add-ons (£)</h3>
        <p className="mb-2 text-muted-foreground text-sm">
          Extra cost when the photos flag a specific problem.
        </p>
        <div className="divide-y">
          {FLAGS.map((f) => (
            <NumberField
              key={f.key}
              label={f.label}
              suffix="£"
              value={flagCosts[f.key] ?? ''}
              onChange={(v) => setFlagCosts((s) => ({ ...s, [f.key]: v }))}
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h3 className="font-semibold">Other levers</h3>
        <div className="divide-y">
          <NumberField
            label="Assumed floor area (no EPC)"
            suffix="m²"
            value={defaultArea}
            onChange={setDefaultArea}
          />
          <NumberField
            label="Target cash ROI"
            suffix="%"
            value={targetRoi}
            onChange={setTargetRoi}
          />
        </div>
      </section>

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="rounded-md bg-slate-900 px-4 py-2 font-medium text-sm text-white disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Save valuation settings'}
      </button>
    </div>
  );
}
