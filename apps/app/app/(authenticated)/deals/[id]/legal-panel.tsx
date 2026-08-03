'use client';

import {
  saveSolicitor,
  seedLegalSteps,
  sendSolicitorChaser,
  toggleLegalStep,
} from '@/app/actions/legal/steps';
import { LEGAL_STEP_BY_KEY } from '@repo/database/legal-steps';
import { Button } from '@repo/design-system/components/ui/button';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

type Step = {
  id: string;
  stepKey: string;
  completed: boolean;
  completedAt: string | null;
  notes: string | null;
};

type Solicitor = {
  solicitorFirm: string | null;
  solicitorName: string | null;
  solicitorEmail: string | null;
  solicitorPhone: string | null;
  solicitorRef: string | null;
};

type ChaserDraft = {
  actionId: string;
  subject: string;
  body: string;
};

export function LegalPanel({
  dealId,
  inConveyancing,
  steps,
  solicitor,
  chaserDraft,
}: {
  dealId: string;
  inConveyancing: boolean;
  steps: Step[];
  solicitor: Solicitor;
  chaserDraft: ChaserDraft | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [solicitorOpen, setSolicitorOpen] = useState(false);
  const [firm, setFirm] = useState(solicitor.solicitorFirm ?? '');
  const [name, setName] = useState(solicitor.solicitorName ?? '');
  const [email, setEmail] = useState(solicitor.solicitorEmail ?? '');
  const [phone, setPhone] = useState(solicitor.solicitorPhone ?? '');
  const [ref, setRef] = useState(solicitor.solicitorRef ?? '');
  const [chaserOpen, setChaserOpen] = useState(false);
  const [chaserSubject, setChaserSubject] = useState(
    chaserDraft?.subject ?? ''
  );
  const [chaserBody, setChaserBody] = useState(chaserDraft?.body ?? '');

  const done = steps.filter((s) => s.completed).length;

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

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
          Legal Progress
          {steps.length > 0 && (
            <span className="ml-2 font-normal normal-case">
              {done}/{steps.length}
            </span>
          )}
        </h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setSolicitorOpen((v) => !v)}
        >
          {solicitor.solicitorFirm ? 'Panel firm' : 'Add panel firm'}
        </Button>
      </div>
      {solicitor.solicitorFirm && !solicitorOpen && (
        <p className="mt-1 text-muted-foreground text-xs">
          {solicitor.solicitorFirm}
          {solicitor.solicitorName ? ` · ${solicitor.solicitorName}` : ''}
          {solicitor.solicitorEmail ? ` · ${solicitor.solicitorEmail}` : ''}
          {solicitor.solicitorRef ? ` · ref ${solicitor.solicitorRef}` : ''}
        </p>
      )}

      {solicitorOpen && (
        <div className="mt-3 rounded-md border bg-background p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-muted-foreground text-xs">Firm</span>
              <input
                type="text"
                value={firm}
                onChange={(e) => setFirm(e.target.value)}
                placeholder="e.g. an Orbital-powered firm — see legal-orbital.md"
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block">
              <span className="text-muted-foreground text-xs">
                Contact name
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block">
              <span className="text-muted-foreground text-xs">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block">
              <span className="text-muted-foreground text-xs">Phone</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block">
              <span className="text-muted-foreground text-xs">
                Matter reference
              </span>
              <input
                type="text"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              disabled={isPending}
              onClick={() =>
                run(
                  () =>
                    saveSolicitor(dealId, {
                      solicitorFirm: firm || null,
                      solicitorName: name || null,
                      solicitorEmail: email || null,
                      solicitorPhone: phone || null,
                      solicitorRef: ref || null,
                    }),
                  'Panel firm saved.'
                )
              }
            >
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {steps.length === 0 ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-dashed p-4">
          <p className="text-muted-foreground text-sm">
            No legal steps tracked yet.
            {inConveyancing
              ? ' Seed the checklist so the chaser can drive the panel firm.'
              : ' The checklist seeds automatically when the deal goes under offer.'}
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() =>
              run(() => seedLegalSteps(dealId), 'Checklist seeded.')
            }
          >
            Seed checklist
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-1.5">
          {steps.map((step) => {
            const template = LEGAL_STEP_BY_KEY[step.stepKey];
            return (
              <button
                key={step.id}
                type="button"
                disabled={isPending}
                onClick={() =>
                  run(
                    () => toggleLegalStep(step.id),
                    step.completed ? 'Step reopened.' : 'Step completed.'
                  )
                }
                className="flex w-full items-start gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/50"
              >
                <div
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    step.completed
                      ? 'border-green-600 bg-green-600 text-white'
                      : 'border-muted-foreground/40'
                  }`}
                >
                  {step.completed && <span className="text-[10px]">✓</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        step.completed ? 'line-through opacity-60' : ''
                      }
                    >
                      {template?.label ?? step.stepKey.replace(/_/g, ' ')}
                    </span>
                    {template && !step.completed && (
                      <span className="text-[10px] text-muted-foreground">
                        target day {template.targetDay}
                        {template.owner === 'bellwood' ? ' · ours' : ''}
                      </span>
                    )}
                    {step.completedAt && (
                      <span className="text-muted-foreground text-xs">
                        {new Date(step.completedAt).toLocaleDateString('en-GB')}
                      </span>
                    )}
                  </div>
                  {step.notes && (
                    <p className="mt-0.5 text-muted-foreground text-xs">
                      {step.notes}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {chaserDraft && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-sm">
              ✉️ Solicitor chaser drafted — review and send
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setChaserOpen((v) => !v)}
            >
              {chaserOpen ? 'Hide' : 'Review'}
            </Button>
          </div>
          {chaserOpen && (
            <div className="mt-3 space-y-2">
              <input
                type="text"
                value={chaserSubject}
                onChange={(e) => setChaserSubject(e.target.value)}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <textarea
                value={chaserBody}
                onChange={(e) => setChaserBody(e.target.value)}
                rows={10}
                className="w-full rounded-md border bg-background px-2 py-1.5 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={isPending || !solicitor.solicitorEmail}
                  onClick={() =>
                    run(
                      () =>
                        sendSolicitorChaser(dealId, {
                          subject: chaserSubject,
                          body: chaserBody,
                          actionId: chaserDraft.actionId,
                        }),
                      'Chaser sent to the panel firm.'
                    )
                  }
                >
                  {isPending ? 'Sending…' : 'Send to solicitor'}
                </Button>
              </div>
              {!solicitor.solicitorEmail && (
                <p className="text-muted-foreground text-xs">
                  Add the panel firm&apos;s email above to send.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
