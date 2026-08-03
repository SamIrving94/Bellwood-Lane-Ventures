'use server';

import { requireFounder } from '@repo/auth/server';
import { database } from '@repo/database';
import type { WorkOrderStatus } from '@repo/database/generated/client';
import { revalidatePath } from 'next/cache';

/**
 * Thin refurb project management: one project per deal, one work order per
 * trade package. The final actual spend is rolled up into
 * Deal.refurbCostPence by recordDealEconomics when the deal exits — this
 * tracker is the live view while the job runs.
 */

export async function createWorksProject(
  dealId: string,
  input: { budgetPence: number | null; targetEndAt: string | null }
) {
  const { userId } = await requireFounder();

  await database.worksProject.create({
    data: {
      dealId,
      budgetPence: input.budgetPence,
      startedAt: new Date(),
      targetEndAt: input.targetEndAt ? new Date(input.targetEndAt) : null,
    },
  });

  await database.dealActivity.create({
    data: {
      dealId,
      action: 'works_started',
      detail: input.budgetPence
        ? `Refurb project opened — budget £${Math.round(input.budgetPence / 100).toLocaleString('en-GB')}`
        : 'Refurb project opened',
      userId,
    },
  });

  revalidatePath(`/deals/${dealId}`);
}

export async function updateWorksProject(
  projectId: string,
  input: {
    status?: string;
    budgetPence?: number | null;
    targetEndAt?: string | null;
    notes?: string | null;
  }
) {
  const { userId } = await requireFounder();

  const project = await database.worksProject.update({
    where: { id: projectId },
    data: {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.budgetPence !== undefined
        ? { budgetPence: input.budgetPence }
        : {}),
      ...(input.targetEndAt !== undefined
        ? {
            targetEndAt: input.targetEndAt ? new Date(input.targetEndAt) : null,
          }
        : {}),
      ...(input.notes !== undefined
        ? { notes: input.notes?.trim() || null }
        : {}),
      ...(input.status === 'complete' ? { completedAt: new Date() } : {}),
    },
    select: { dealId: true },
  });

  if (input.status === 'complete') {
    await database.dealActivity.create({
      data: {
        dealId: project.dealId,
        action: 'works_completed',
        detail: 'Refurb project marked complete',
        userId,
      },
    });
  }

  revalidatePath(`/deals/${project.dealId}`);
}

export async function addWorkOrder(
  projectId: string,
  input: {
    title: string;
    trade: string | null;
    partnerId: string | null;
    contractorName: string | null;
    quotedPence: number | null;
    dueAt: string | null;
  }
) {
  await requireFounder();

  const title = input.title.trim();
  if (!title) throw new Error('Work order needs a title');

  const project = await database.worksProject.findUnique({
    where: { id: projectId },
    select: { dealId: true },
  });
  if (!project) throw new Error('Works project not found');

  await database.workOrder.create({
    data: {
      projectId,
      title,
      trade: input.trade?.trim() || null,
      partnerId: input.partnerId,
      contractorName: input.contractorName?.trim() || null,
      quotedPence: input.quotedPence,
      status: input.quotedPence !== null ? 'quoted' : 'planned',
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
    },
  });

  revalidatePath(`/deals/${project.dealId}`);
}

export async function updateWorkOrder(
  orderId: string,
  input: {
    status?: WorkOrderStatus;
    quotedPence?: number | null;
    actualPence?: number | null;
    dueAt?: string | null;
    notes?: string | null;
  }
) {
  await requireFounder();

  const order = await database.workOrder.update({
    where: { id: orderId },
    data: {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.quotedPence !== undefined
        ? { quotedPence: input.quotedPence }
        : {}),
      ...(input.actualPence !== undefined
        ? { actualPence: input.actualPence }
        : {}),
      ...(input.dueAt !== undefined
        ? { dueAt: input.dueAt ? new Date(input.dueAt) : null }
        : {}),
      ...(input.notes !== undefined
        ? { notes: input.notes?.trim() || null }
        : {}),
    },
    select: { project: { select: { dealId: true } } },
  });

  revalidatePath(`/deals/${order.project.dealId}`);
}
