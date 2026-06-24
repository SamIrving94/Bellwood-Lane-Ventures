'use client';

/**
 * Deal-model panel — the founder's bottom-up underwrite, pre-filled from the AVM.
 *
 * The AVM point estimate is the comp-typical ("done-up") market value, so it is
 * the anchor for the after-refurb GDV. From one AVM run we show:
 *   - AVM market value (the comp anchor)
 *   - As-is value today (AVM minus the current-condition discount)
 *   - GDV after refurb (the end value the deal is underwritten against)
 * …then the cash / financed ROI at a given offer and the walk-away max offer to
 * hit the target return. All maths is the pure @repo/valuation deal model, run
 * live client-side — no GDV to punch in by hand.
 */

import type { AcquisitionRoute } from '@repo/valuation/src/deal-model';
import {
  type ConditionLevel,
  appraiseDealFromAvm,
} from '@repo/valuation/src/gdv';
import { useMemo, useState } from 'react';

function formatGBP(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

function poundsToPence(pounds: string): number {
  const n = Number(pounds.trim());
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

const CONDITIONS: { value: ConditionLevel; label: string }[] = [
  { value: 'turnkey', label: 'Turnkey' },
  { value: 'dated', label: 'Dated' },
  { value: 'tired', label: 'Tired' },
  { value: 'unmodernised', label: 'Unmodernised' },
  { value: 'derelict', label: 'Derelict' },
];

const ROUTES: { value: AcquisitionRoute; label: string }[] = [
  { value: 'private_treaty', label: 'Private treaty' },
  { value: 'auction_traditional', label: 'Auction (traditional)' },
  { value: 'auction_modern', label: 'Auction (modern)' },
];

const VERDICT_TONE: Record<string, string> = {
  pass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  marginal: 'bg-amber-100 text-amber-800 border-amber-200',
  fail: 'bg-rose-100 text-rose-800 border-rose-200',
};

export function DealModelPanel({
  avmPointEstimatePence,
  askingPricePence,
}: {
  avmPointEstimatePence: number;
  askingPricePence: number | null;
}) {
  const [condition, setCondition] = useState<ConditionLevel>('tired');
  const [route, setRoute] = useState<AcquisitionRoute>('private_treaty');
  // Sensible refurb default scales with the property: ~12% of AVM.
  const [refurb, setRefurb] = useState<string>(
    String(Math.round((avmPointEstimatePence * 0.12) / 100))
  );
  const [premiumPct, setPremiumPct] = useState<string>('0');
  const [targetPct, setTargetPct] = useState<string>('20');
  // Pre-fill "our offer" with the asking price when we have it.
  const [offer, setOffer] = useState<string>(
    askingPricePence ? String(Math.round(askingPricePence / 100)) : ''
  );

  const result = useMemo(
    () =>
      appraiseDealFromAvm({
        avmPointEstimatePence,
        conditionLevel: condition,
        premiumUpliftFraction: (Number(premiumPct) || 0) / 100,
        refurbPence: poundsToPence(refurb),
        route,
        offerPence: offer ? poundsToPence(offer) : undefined,
        targetRoi: (Number(targetPct) || 20) / 100,
      }),
    [
      avmPointEstimatePence,
      condition,
      premiumPct,
      refurb,
      route,
      offer,
      targetPct,
    ]
  );

  const { gdv, appraisal, maxOfferPence, targetRoi } = result;

  return (
    <section className="rounded-2xl border-2 border-slate-900/10 bg-white p-5">
      <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.22em]">
        Deal model · bottom-up ROI
      </p>

      {/* Value ladder: AVM → as-is → GDV */}
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-[11px] text-muted-foreground">AVM market value</p>
          <p className="font-bold font-mono text-2xl tabular-nums leading-none">
            {formatGBP(gdv.avmPointEstimatePence)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            comp-typical (done up)
          </p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">As-is today</p>
          <p className="font-bold font-mono text-2xl tabular-nums leading-none">
            {formatGBP(gdv.asIsValuePence)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            current condition
          </p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">GDV after refurb</p>
          <p className="font-bold font-mono text-2xl text-emerald-700 tabular-nums leading-none">
            {formatGBP(gdv.gdvPence)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">end value</p>
        </div>
      </div>

      {/* Inputs */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-[11px] text-muted-foreground">Condition</span>
          <select
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            value={condition}
            onChange={(e) => setCondition(e.target.value as ConditionLevel)}
          >
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] text-muted-foreground">Refurb (£)</span>
          <input
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm tabular-nums"
            inputMode="numeric"
            value={refurb}
            onChange={(e) => setRefurb(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-[11px] text-muted-foreground">Route</span>
          <select
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            value={route}
            onChange={(e) => setRoute(e.target.value as AcquisitionRoute)}
          >
            {ROUTES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] text-muted-foreground">
            Refurb uplift (%)
          </span>
          <input
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm tabular-nums"
            inputMode="numeric"
            value={premiumPct}
            onChange={(e) => setPremiumPct(e.target.value)}
            title="How far above comp-typical the finished product lands. 0% = a standard refurb that restores it to the comp baseline."
          />
        </label>
        <label className="block">
          <span className="text-[11px] text-muted-foreground">
            Target cash ROI (%)
          </span>
          <input
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm tabular-nums"
            inputMode="numeric"
            value={targetPct}
            onChange={(e) => setTargetPct(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-[11px] text-muted-foreground">
            Our offer (£)
          </span>
          <input
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm tabular-nums"
            inputMode="numeric"
            placeholder="optional"
            value={offer}
            onChange={(e) => setOffer(e.target.value)}
          />
        </label>
      </div>

      {/* Outputs */}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-slate-50 p-3">
          <p className="text-[11px] text-muted-foreground">
            Max offer · {Math.round(targetRoi * 100)}% cash
          </p>
          <p className="font-bold font-mono text-2xl tabular-nums leading-none">
            {maxOfferPence > 0 ? formatGBP(maxOfferPence) : '—'}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            walk-away ceiling
          </p>
        </div>
        <div className="rounded-lg border bg-slate-50 p-3">
          <p className="text-[11px] text-muted-foreground">
            At our offer · cash ROI
          </p>
          <p className="font-bold font-mono text-2xl tabular-nums leading-none">
            {appraisal ? `${Math.round(appraisal.cash.roi * 100)}%` : '—'}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {appraisal
              ? `${formatGBP(appraisal.cash.profitPence)} profit`
              : 'enter an offer'}
          </p>
        </div>
        <div className="rounded-lg border bg-slate-50 p-3">
          <p className="text-[11px] text-muted-foreground">
            At our offer · financed ROI
          </p>
          <p className="font-bold font-mono text-2xl tabular-nums leading-none">
            {appraisal ? `${Math.round(appraisal.financed.roi * 100)}%` : '—'}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            bridging upside
          </p>
        </div>
      </div>

      {appraisal && (
        <div className="mt-4 flex items-center gap-2">
          <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 font-medium text-xs capitalize ${VERDICT_TONE[appraisal.verdict] ?? ''}`}
          >
            {appraisal.verdict}
          </span>
          <span className="text-[11px] text-muted-foreground">
            All-in outlay {formatGBP(appraisal.cash.totalOutlayPence)} · hurdle{' '}
            {Math.round(appraisal.targetCashRoi * 100)}%
          </span>
        </div>
      )}

      <p className="mt-4 text-[11px] text-muted-foreground">
        {gdv.basis} The margin is made buying below the as-is value — not from
        the refurb alone.
      </p>
    </section>
  );
}
