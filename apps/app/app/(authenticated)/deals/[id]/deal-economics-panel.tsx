'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { recordDealEconomics } from '@/app/actions/deals/record-economics';

type Economics = {
  acquisitionPricePence: number | null;
  acquiredAt: Date | null;
  refurbCostPence: number | null;
  legalFeesPence: number | null;
  otherCostsPence: number | null;
  exitPricePence: number | null;
  exitedAt: Date | null;
  realisedProfitPence: number | null;
};

// pence → pounds string for an input value ('' when null)
function toPounds(pence: number | null): string {
  return pence === null ? '' : String(Math.round(pence) / 100);
}
// pounds string → pence (null when blank/invalid)
function toPence(pounds: string): number | null {
  const t = pounds.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isNaN(n) ? null : Math.round(n * 100);
}
// Date → yyyy-mm-dd for a date input
function toDateInput(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : '';
}

function formatGBP(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

function MoneyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring">
        <span className="pl-2 text-sm text-muted-foreground">£</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="w-full bg-transparent px-2 py-1.5 text-sm outline-none"
        />
      </div>
    </label>
  );
}

export function DealEconomicsPanel({
  dealId,
  economics,
  estimatedMarketValuePence,
  ourOfferPence,
}: {
  dealId: string;
  economics: Economics;
  estimatedMarketValuePence: number | null;
  ourOfferPence: number | null;
}) {
  const [isPending, startTransition] = useTransition();

  const [acquisition, setAcquisition] = useState(
    toPounds(economics.acquisitionPricePence),
  );
  const [acquiredAt, setAcquiredAt] = useState(toDateInput(economics.acquiredAt));
  const [refurb, setRefurb] = useState(toPounds(economics.refurbCostPence));
  const [legal, setLegal] = useState(toPounds(economics.legalFeesPence));
  const [other, setOther] = useState(toPounds(economics.otherCostsPence));
  const [exit, setExit] = useState(toPounds(economics.exitPricePence));
  const [exitedAt, setExitedAt] = useState(toDateInput(economics.exitedAt));

  // Live preview — mirrors the server's profit calc so the founder sees the
  // number before saving.
  const preview = useMemo(() => {
    const acq = toPence(acquisition);
    const ex = toPence(exit);
    const costs =
      (toPence(refurb) ?? 0) + (toPence(legal) ?? 0) + (toPence(other) ?? 0);
    const totalIn = acq === null ? null : acq + costs;
    const profit = acq !== null && ex !== null ? ex - acq - costs : null;
    const roi =
      profit !== null && totalIn !== null && totalIn > 0
        ? (profit / totalIn) * 100
        : null;
    // Discount we bought at vs market (how good was the acquisition)
    const buyDiscount =
      acq !== null &&
      estimatedMarketValuePence !== null &&
      estimatedMarketValuePence > 0
        ? ((estimatedMarketValuePence - acq) / estimatedMarketValuePence) * 100
        : null;
    return { profit, roi, totalIn, buyDiscount };
  }, [acquisition, exit, refurb, legal, other, estimatedMarketValuePence]);

  const handleSave = () => {
    startTransition(async () => {
      try {
        const { realisedProfitPence } = await recordDealEconomics(dealId, {
          acquisitionPricePence: toPence(acquisition),
          acquiredAt: acquiredAt || null,
          refurbCostPence: toPence(refurb),
          legalFeesPence: toPence(legal),
          otherCostsPence: toPence(other),
          exitPricePence: toPence(exit),
          exitedAt: exitedAt || null,
        });
        toast.success(
          realisedProfitPence !== null
            ? `Saved. Realised profit ${formatGBP(realisedProfitPence)}.`
            : 'Trade economics saved.',
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save.');
      }
    });
  };

  const profitPositive = preview.profit !== null && preview.profit >= 0;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Trade economics
        </h2>
        {ourOfferPence !== null && (
          <span className="text-xs text-muted-foreground">
            We offered {formatGBP(ourOfferPence)}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Actuals for a deal we buy for our own book. Fill in both purchase and
        sale to see realised profit.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MoneyInput
          label="Acquisition price (paid)"
          value={acquisition}
          onChange={setAcquisition}
        />
        <label className="block">
          <span className="text-xs text-muted-foreground">Acquired on</span>
          <input
            type="date"
            value={acquiredAt}
            onChange={(e) => setAcquiredAt(e.target.value)}
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <MoneyInput label="Refurb cost" value={refurb} onChange={setRefurb} />
        <MoneyInput
          label="Legal / SDLT"
          value={legal}
          onChange={setLegal}
        />
        <MoneyInput
          label="Other costs (holding, finance)"
          value={other}
          onChange={setOther}
        />
        <div />
        <MoneyInput
          label="Exit price (sold for)"
          value={exit}
          onChange={setExit}
        />
        <label className="block">
          <span className="text-xs text-muted-foreground">Exited on</span>
          <input
            type="date"
            value={exitedAt}
            onChange={(e) => setExitedAt(e.target.value)}
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>

      {/* Live P&L preview */}
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-md border bg-muted/40 p-3 sm:grid-cols-4">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Total in
          </p>
          <p className="font-mono text-sm font-semibold tabular-nums">
            {preview.totalIn !== null ? formatGBP(preview.totalIn) : '—'}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Bought at
          </p>
          <p className="font-mono text-sm font-semibold tabular-nums">
            {preview.buyDiscount !== null
              ? `${preview.buyDiscount.toFixed(1)}% below EMV`
              : '—'}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Realised profit
          </p>
          <p
            className={`font-mono text-sm font-semibold tabular-nums ${
              preview.profit === null
                ? ''
                : profitPositive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
            }`}
          >
            {preview.profit !== null ? formatGBP(preview.profit) : '—'}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            ROI
          </p>
          <p className="font-mono text-sm font-semibold tabular-nums">
            {preview.roi !== null ? `${preview.roi.toFixed(1)}%` : '—'}
          </p>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save economics'}
        </Button>
      </div>
    </div>
  );
}
