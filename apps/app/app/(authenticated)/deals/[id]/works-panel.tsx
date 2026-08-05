'use client';

import {
  addWorkOrder,
  createWorksProject,
  updateWorkOrder,
  updateWorksProject,
} from '@/app/actions/works/works';
import type { WorkOrderStatus } from '@repo/database/generated/client';
import { Button } from '@repo/design-system/components/ui/button';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

type PartnerOption = { id: string; name: string };

type Order = {
  id: string;
  title: string;
  trade: string | null;
  partnerName: string | null;
  contractorName: string | null;
  quotedPence: number | null;
  actualPence: number | null;
  status: WorkOrderStatus;
  dueAt: string | null;
};

type Project = {
  id: string;
  status: string;
  budgetPence: number | null;
  targetEndAt: string | null;
  orders: Order[];
};

const ORDER_STATUSES: { value: WorkOrderStatus; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'paid', label: 'Paid' },
];

function gbp(pence: number | null): string {
  return pence === null
    ? '—'
    : `£${Math.round(pence / 100).toLocaleString('en-GB')}`;
}
function toPence(pounds: string): number | null {
  const t = pounds.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isNaN(n) || n < 0 ? null : Math.round(n * 100);
}

export function WorksPanel({
  dealId,
  project,
  partners,
}: {
  dealId: string;
  project: Project | null;
  partners: PartnerOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [budget, setBudget] = useState('');
  const [targetEnd, setTargetEnd] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [trade, setTrade] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [contractorName, setContractorName] = useState('');
  const [quoted, setQuoted] = useState('');
  const [dueAt, setDueAt] = useState('');

  const run = (fn: () => Promise<unknown>, ok: string) => {
    startTransition(async () => {
      try {
        await fn();
        toast.success(ok);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed.');
      }
    });
  };

  if (!project) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
          Works / Refurb
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-muted-foreground text-xs">Budget</span>
            <div className="mt-1 flex items-center rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring">
              <span className="pl-2 text-muted-foreground text-sm">£</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="20,000"
                className="w-full bg-transparent px-2 py-1.5 text-sm outline-none"
              />
            </div>
          </label>
          <label className="block">
            <span className="text-muted-foreground text-xs">Target finish</span>
            <input
              type="date"
              value={targetEnd}
              onChange={(e) => setTargetEnd(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <div className="flex items-end">
            <Button
              size="sm"
              disabled={isPending}
              onClick={() =>
                run(
                  () =>
                    createWorksProject(dealId, {
                      budgetPence: toPence(budget),
                      targetEndAt: targetEnd || null,
                    }),
                  'Refurb project opened.'
                )
              }
            >
              {isPending ? 'Opening…' : 'Open refurb project'}
            </Button>
          </div>
        </div>
        <p className="mt-2 text-muted-foreground text-xs">
          One project per deal; one work order per trade package. Your field
          network doubles as the contractor pool.
        </p>
      </div>
    );
  }

  const totalQuoted = project.orders.reduce(
    (sum, o) => sum + (o.quotedPence ?? 0),
    0
  );
  const totalActual = project.orders.reduce(
    (sum, o) => sum + (o.actualPence ?? 0),
    0
  );
  const overBudget =
    project.budgetPence !== null && totalActual > project.budgetPence;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
          Works / Refurb
          <span
            className={`ml-2 rounded-full px-2 py-0.5 font-medium text-[10px] normal-case ${
              project.status === 'complete'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
            }`}
          >
            {project.status}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAddOpen((v) => !v)}
          >
            {addOpen ? 'Close' : 'Add work order'}
          </Button>
          {project.status !== 'complete' && (
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() =>
                run(
                  () => updateWorksProject(project.id, { status: 'complete' }),
                  'Project complete — record the final numbers in Deal economics.'
                )
              }
            >
              Mark complete
            </Button>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md border p-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Budget
          </p>
          <p className="font-mono font-semibold text-sm tabular-nums">
            {gbp(project.budgetPence)}
          </p>
        </div>
        <div className="rounded-md border p-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Quoted
          </p>
          <p className="font-mono font-semibold text-sm tabular-nums">
            {gbp(totalQuoted)}
          </p>
        </div>
        <div
          className={`rounded-md border p-2 ${overBudget ? 'border-red-300 bg-red-50 dark:bg-red-950' : ''}`}
        >
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Actual
          </p>
          <p
            className={`font-mono font-semibold text-sm tabular-nums ${overBudget ? 'text-red-700 dark:text-red-300' : ''}`}
          >
            {gbp(totalActual)}
          </p>
        </div>
      </div>
      {project.targetEndAt && (
        <p className="mt-2 text-muted-foreground text-xs">
          Target finish:{' '}
          {new Date(project.targetEndAt).toLocaleDateString('en-GB')}
        </p>
      )}

      {addOpen && (
        <div className="mt-3 rounded-md border bg-background p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-muted-foreground text-xs">Title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Rewire ground floor"
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block">
              <span className="text-muted-foreground text-xs">Trade</span>
              <input
                type="text"
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
                placeholder="electrics"
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block">
              <span className="text-muted-foreground text-xs">
                Field partner
              </span>
              <select
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Outside contractor</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {!partnerId && (
              <label className="block">
                <span className="text-muted-foreground text-xs">
                  Contractor name
                </span>
                <input
                  type="text"
                  value={contractorName}
                  onChange={(e) => setContractorName(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            )}
            <label className="block">
              <span className="text-muted-foreground text-xs">Quote</span>
              <div className="mt-1 flex items-center rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring">
                <span className="pl-2 text-muted-foreground text-sm">£</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={quoted}
                  onChange={(e) => setQuoted(e.target.value)}
                  className="w-full bg-transparent px-2 py-1.5 text-sm outline-none"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-muted-foreground text-xs">Due</span>
              <input
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              disabled={isPending || !title.trim()}
              onClick={() =>
                run(async () => {
                  await addWorkOrder(project.id, {
                    title,
                    trade: trade || null,
                    partnerId: partnerId || null,
                    contractorName: contractorName || null,
                    quotedPence: toPence(quoted),
                    dueAt: dueAt || null,
                  });
                  setTitle('');
                  setTrade('');
                  setQuoted('');
                  setDueAt('');
                  setAddOpen(false);
                }, 'Work order added.')
              }
            >
              {isPending ? 'Adding…' : 'Add'}
            </Button>
          </div>
        </div>
      )}

      {project.orders.length === 0 ? (
        <p className="mt-3 text-muted-foreground text-sm">
          No work orders yet.
        </p>
      ) : (
        <div className="mt-3 space-y-1.5">
          {project.orders.map((o) => (
            <WorkOrderRow key={o.id} order={o} disabled={isPending} run={run} />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkOrderRow({
  order,
  disabled,
  run,
}: {
  order: Order;
  disabled: boolean;
  run: (fn: () => Promise<unknown>, ok: string) => void;
}) {
  const [actual, setActual] = useState(
    order.actualPence === null
      ? ''
      : String(Math.round(order.actualPence) / 100)
  );

  const late =
    order.dueAt &&
    order.status !== 'done' &&
    order.status !== 'paid' &&
    new Date(order.dueAt) < new Date();

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {order.title}
          {order.trade && (
            <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 font-normal text-[10px]">
              {order.trade}
            </span>
          )}
          {late && (
            <span className="ml-1.5 rounded bg-red-100 px-1.5 py-0.5 font-medium text-[10px] text-red-800 dark:bg-red-950 dark:text-red-300">
              late
            </span>
          )}
        </p>
        <p className="text-muted-foreground text-xs">
          {order.partnerName ?? order.contractorName ?? 'Unassigned'}
          {order.dueAt
            ? ` · due ${new Date(order.dueAt).toLocaleDateString('en-GB')}`
            : ''}
          {order.quotedPence !== null
            ? ` · quoted ${gbp(order.quotedPence)}`
            : ''}
        </p>
      </div>
      <div className="flex items-center rounded-md border bg-background">
        <span className="pl-1.5 text-muted-foreground text-xs">£</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          onBlur={() =>
            run(
              () => updateWorkOrder(order.id, { actualPence: toPence(actual) }),
              'Actual cost saved.'
            )
          }
          placeholder="actual"
          className="w-20 bg-transparent px-1.5 py-1 text-xs outline-none"
        />
      </div>
      <select
        value={order.status}
        disabled={disabled}
        onChange={(e) =>
          run(
            () =>
              updateWorkOrder(order.id, {
                status: e.target.value as WorkOrderStatus,
              }),
            'Status updated.'
          )
        }
        className="rounded-md border bg-background px-1.5 py-1 text-xs outline-none"
      >
        {ORDER_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
