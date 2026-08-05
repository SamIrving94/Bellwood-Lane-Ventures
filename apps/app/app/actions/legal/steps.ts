'use server';

import { requireFounder } from '@repo/auth/server';
import { database } from '@repo/database';
import { LEGAL_STEPS } from '@repo/database/legal-steps';
import { sendEmail } from '@repo/email';
import { revalidatePath } from 'next/cache';

/**
 * Seed the canonical conveyancing checklist onto a deal. Idempotent —
 * (dealId, stepKey) is unique, so re-seeding never duplicates. Called
 * automatically when a deal goes under offer, and manually from the panel
 * for deals that predate the checklist.
 */
export async function seedLegalSteps(dealId: string) {
  await requireFounder();

  await database.legalStep.createMany({
    data: LEGAL_STEPS.map((s) => ({ dealId, stepKey: s.key })),
    skipDuplicates: true,
  });

  revalidatePath(`/deals/${dealId}`);
}

export async function toggleLegalStep(stepId: string) {
  const { userId } = await requireFounder();

  const step = await database.legalStep.findUnique({
    where: { id: stepId },
    select: { dealId: true, completed: true, stepKey: true },
  });
  if (!step) throw new Error('Legal step not found');

  const completed = !step.completed;
  await database.legalStep.update({
    where: { id: stepId },
    data: { completed, completedAt: completed ? new Date() : null },
  });

  await database.dealActivity.create({
    data: {
      dealId: step.dealId,
      action: completed ? 'legal_step_completed' : 'legal_step_reopened',
      detail: step.stepKey.replace(/_/g, ' '),
      userId,
    },
  });

  revalidatePath(`/deals/${step.dealId}`);
}

export async function saveLegalStepNote(stepId: string, notes: string) {
  await requireFounder();

  const step = await database.legalStep.update({
    where: { id: stepId },
    data: { notes: notes.trim() || null },
    select: { dealId: true },
  });

  revalidatePath(`/deals/${step.dealId}`);
}

export async function saveSolicitor(
  dealId: string,
  input: {
    solicitorFirm: string | null;
    solicitorName: string | null;
    solicitorEmail: string | null;
    solicitorPhone: string | null;
    solicitorRef: string | null;
  }
) {
  const { userId } = await requireFounder();

  await database.deal.update({
    where: { id: dealId },
    data: {
      solicitorFirm: input.solicitorFirm?.trim() || null,
      solicitorName: input.solicitorName?.trim() || null,
      solicitorEmail: input.solicitorEmail?.trim().toLowerCase() || null,
      solicitorPhone: input.solicitorPhone?.trim() || null,
      solicitorRef: input.solicitorRef?.trim() || null,
    },
  });

  await database.dealActivity.create({
    data: {
      dealId,
      action: 'solicitor_updated',
      detail: input.solicitorFirm
        ? `Panel firm: ${input.solicitorFirm}`
        : 'Solicitor details updated',
      userId,
    },
  });

  revalidatePath(`/deals/${dealId}`);
}

/**
 * Send a chaser the founder has approved (drafted by the legal-chaser cron,
 * editable before send). Solicitors are B2B professional contacts, but the
 * send still goes through founder review — same posture as OutreachHold.
 */
export async function sendSolicitorChaser(
  dealId: string,
  input: { subject: string; body: string; actionId?: string }
) {
  const { userId } = await requireFounder();

  const deal = await database.deal.findUnique({
    where: { id: dealId },
    select: { solicitorEmail: true, solicitorName: true, address: true },
  });
  if (!deal) throw new Error('Deal not found');
  if (!deal.solicitorEmail) {
    throw new Error(
      'No solicitor email on this deal — add the panel firm first.'
    );
  }

  const result = await sendEmail({
    to: deal.solicitorEmail,
    subject: input.subject.trim(),
    text: input.body.trim(),
  });
  if (result.skipped) {
    throw new Error(`Email not sent: ${result.reason}`);
  }

  await database.deal.update({
    where: { id: dealId },
    data: { legalChasedAt: new Date() },
  });

  await database.dealActivity.create({
    data: {
      dealId,
      action: 'solicitor_chased',
      detail: `Chaser sent to ${deal.solicitorEmail}: ${input.subject.trim()}`,
      userId,
    },
  });

  if (input.actionId) {
    await database.founderAction
      .update({
        where: { id: input.actionId },
        data: {
          status: 'completed',
          resolvedBy: userId,
          resolvedAt: new Date(),
        },
      })
      .catch(() => {});
  }

  revalidatePath(`/deals/${dealId}`);
  revalidatePath('/');
}
