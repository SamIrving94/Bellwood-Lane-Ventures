'use client';

import { Button } from '@repo/design-system/components/ui/button';
import type { SourcingFeeStatus } from '@repo/database/generated/client';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { recordSourcingFee } from '@/app/actions/deals/sourcing-fee';

type Fee = {
  sourcingFeePence: number | null;
  sourcingFeeStatus: SourcingFeeStatus;
  sourcedToName: string | null;
  sourcedToEmail: string | null;
};

type Interest = { investorName: string; investorEmail: string };

const STATUSES: { value: SourcingFeeStatus; label: string }[] = [
  { value: 'none', label: 'Not started' },
  { value: 'proposed', label: 'Proposed' },
  { value: 'agreed', label: 'Agreed' },
  { value: 'invoiced', label: 'Invoiced' },
  { value: 'paid', label: 'Paid' },
];

const STATUS_TONE: Record<SourcingFeeStatus, string> = {
  none: 'bg-muted text-muted-foreground',
  proposed: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  agreed: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  invoiced:
    'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
};

function toPounds(pence: number | null): string {
  return pence === null ? '' : String(Math.round(pence) / 100);
}
function toPence(pounds: string): number | null {
  const t = pounds.trim();
  if (t === '') return null;
  const n = Number(t);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function SourcingFeePanel({
  dealId,
  fee,
  interests,
}: {
  dealId: string;
  fee: Fee;
  interests: Interest[];
}) {
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState(toPounds(fee.sourcingFeePence));
  const [status, setStatus] = useState<SourcingFeeStatus>(
    fee.sourcingFeeStatus,
  );
  const [name, setName] = useState(fee.sourcedToName ?? '');
  const [email, setEmail] = useState(fee.sourcedToEmail ?? '');

  const handleSave = () => {
    startTransition(async () => {
      try {
        await recordSourcingFee(dealId, {
          feePence: toPence(amount),
          status,
          sourcedToName: name || null,
          sourcedToEmail: email || null,
        });
        toast.success('Sourcing fee updated.');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save.');
      }
    });
  };

  // Pre-fill the investor from a logged interest in one click.
  const pickInterest = (i: Interest) => {
    setName(i.investorName);
    setEmail(i.investorEmail);
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Sourcing fee
        </h2>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[status]}`}
        >
          {STATUSES.find((s) => s.value === status)?.label}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        The fee an investor pays to take this sourced deal. Move it through
        proposed → agreed → invoiced → paid.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-muted-foreground">Fee amount</span>
          <div className="mt-1 flex items-center rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring">
            <span className="pl-2 text-sm text-muted-foreground">£</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-transparent px-2 py-1.5 text-sm outline-none"
            />
          </div>
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as SourcingFeeStatus)}
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">
            Sourced to (investor name)
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Investor name"
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Investor email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Investor email"
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>

      {interests.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">
            From interest:
          </span>
          {interests.map((i) => (
            <button
              key={i.investorEmail}
              type="button"
              onClick={() => pickInterest(i)}
              className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-muted"
            >
              {i.investorName}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save fee'}
        </Button>
      </div>
    </div>
  );
}
