'use client';

import type { OfferConfig } from '@repo/valuation';
import { Button } from '@repo/design-system/components/ui/button';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { saveAndActivateOfferConfig } from '@/app/actions/offer-config/manage';

const SELLER_TYPE_LABELS: Record<string, string> = {
  probate: 'Probate',
  chain_break: 'Chain break',
  short_lease: 'Short lease',
  repossession: 'Repossession',
  relocation: 'Relocation',
  standard: 'Standard',
};

// We edit margins/guard rails as whole-number percentages for readability, but
// the config stores fractions (0.20). These helpers convert at the boundary.
const toPct = (f: number) => Math.round(f * 1000) / 10;
const toFraction = (p: number) => Math.round((p / 100) * 1000) / 1000;

type EditableState = {
  sellerTypeMargin: Record<string, number>; // percentages
  floorPct: number;
  ceilingPct: number;
  discountCapPct: number;
  minMarginPct: number;
  offerValidityDays: number;
};

function extract(c: OfferConfig): EditableState {
  const sellerTypeMargin: Record<string, number> = {};
  for (const [k, v] of Object.entries(c.sellerTypeMargin)) {
    sellerTypeMargin[k] = toPct(v);
  }
  return {
    sellerTypeMargin,
    floorPct: toPct(c.floorFraction),
    ceilingPct: toPct(c.ceilingFraction),
    discountCapPct: toPct(c.totalDiscountCap),
    minMarginPct: toPct(c.minEffectiveMargin),
    offerValidityDays: c.offerValidityDays,
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

export function OfferConfigEditor({
  live,
  defaults,
  liveVersion,
}: {
  live: OfferConfig;
  defaults: OfferConfig;
  liveVersion: number | null;
}) {
  const liveEditable = extract(live);
  const [state, setState] = useState<EditableState>(liveEditable);
  const [description, setDescription] = useState('');
  const [isPending, startTransition] = useTransition();

  const dirty = JSON.stringify(state) !== JSON.stringify(liveEditable);

  const resetToLive = () => setState(extract(live));
  const resetToDefaults = () => setState(extract(defaults));

  const setMargin = (key: string, n: number) =>
    setState((s) => ({
      ...s,
      sellerTypeMargin: { ...s.sellerTypeMargin, [key]: n },
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
        // Rebuild a full OfferConfig from the live config with our edited
        // groups converted back to fractions, so any advanced knobs are kept.
        const sellerTypeMargin: Record<string, number> = {};
        for (const [k, v] of Object.entries(state.sellerTypeMargin)) {
          sellerTypeMargin[k] = toFraction(v);
        }
        const next = {
          ...live,
          sellerTypeMargin,
          floorFraction: toFraction(state.floorPct),
          ceilingFraction: toFraction(state.ceilingPct),
          totalDiscountCap: toFraction(state.discountCapPct),
          minEffectiveMargin: toFraction(state.minMarginPct),
          offerValidityDays: state.offerValidityDays,
        };
        const { version } = await saveAndActivateOfferConfig(next, description);
        toast.success(`Activated v${version}. Next valuation will use it.`);
        setDescription('');
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to save offer policy.',
        );
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* Seller-type acquisition margins */}
      <section className="rounded-xl border bg-card">
        <div className="border-b p-4">
          <h2 className="font-medium text-sm">Acquisition margin by seller type</h2>
          <p className="mt-0.5 text-muted-foreground text-xs">
            How far below market value (AVM) we buy, before any risk discounts.
            Your rule of thumb is 20–25% below market.
          </p>
        </div>
        <div className="divide-y px-4">
          {Object.keys(state.sellerTypeMargin)
            .sort(
              (a, b) =>
                state.sellerTypeMargin[b]! - state.sellerTypeMargin[a]!,
            )
            .map((key) => (
              <NumberField
                key={key}
                label={SELLER_TYPE_LABELS[key] ?? key}
                hint="% below AVM"
                value={state.sellerTypeMargin[key]!}
                liveValue={liveEditable.sellerTypeMargin[key] ?? 0}
                onChange={(n) => setMargin(key, n)}
              />
            ))}
        </div>
      </section>

      {/* Guard rails */}
      <section className="rounded-xl border bg-card">
        <div className="border-b p-4">
          <h2 className="font-medium text-sm">Guard rails</h2>
          <p className="mt-0.5 text-muted-foreground text-xs">
            Hard limits the calculator can never cross. An offer below the floor
            is flagged for your review (CEO escalation).
          </p>
        </div>
        <div className="divide-y px-4">
          <NumberField
            label="Offer floor"
            hint="% of AVM — below this, escalate"
            value={state.floorPct}
            liveValue={liveEditable.floorPct}
            onChange={(n) => setState((s) => ({ ...s, floorPct: n }))}
          />
          <NumberField
            label="Offer ceiling"
            hint="% of AVM — never offer above"
            value={state.ceilingPct}
            liveValue={liveEditable.ceilingPct}
            onChange={(n) => setState((s) => ({ ...s, ceilingPct: n }))}
          />
          <NumberField
            label="Total discount cap"
            hint="max sum of risk discounts (% of AVM)"
            value={state.discountCapPct}
            liveValue={liveEditable.discountCapPct}
            onChange={(n) => setState((s) => ({ ...s, discountCapPct: n }))}
          />
          <NumberField
            label="Minimum margin"
            hint="floor on base margin after grade nudge (%)"
            value={state.minMarginPct}
            liveValue={liveEditable.minMarginPct}
            onChange={(n) => setState((s) => ({ ...s, minMarginPct: n }))}
          />
          <NumberField
            label="Offer validity"
            hint="days an issued offer stays live"
            value={state.offerValidityDays}
            liveValue={liveEditable.offerValidityDays}
            onChange={(n) =>
              setState((s) => ({ ...s, offerValidityDays: n }))
            }
          />
        </div>
      </section>

      {/* Save bar */}
      <div className="sticky bottom-4 rounded-xl border bg-card/95 p-4 shadow-lg backdrop-blur">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What did you change and why? (e.g. 'Widen repossession margin to 27%')"
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
