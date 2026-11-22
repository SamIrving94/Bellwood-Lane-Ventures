'use server';

import { requireFounder } from '@repo/auth/server';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';

export async function resolveAction(
  actionId: string,
  resolution: 'completed' | 'dismissed',
  notes?: string
) {
  const { userId } = await requireFounder();

  await database.founderAction.update({
    where: { id: actionId },
    data: {
      status: resolution,
      resolvedBy: userId,
      resolvedAt: new Date(),
      description: notes
        ? `${notes}\n\n---\nOriginal: ${(await database.founderAction.findUnique({ where: { id: actionId }, select: { description: true } }))?.description ?? ''}`
        : undefined,
    },
  });

  revalidatePath('/actions');
  revalidatePath('/');
}

export async function bulkResolveActions(
  actionIds: string[],
  resolution: 'completed' | 'dismissed'
) {
  const { userId } = await requireFounder();

  await database.founderAction.updateMany({
    where: { id: { in: actionIds } },
    data: {
      status: resolution,
      resolvedBy: userId,
      resolvedAt: new Date(),
    },
  });

  revalidatePath('/actions');
  revalidatePath('/');
}

/**
 * Types the "Clear all" button never touches. Blog drafts need a real read
 * before they publish, so they survive a clear-out (founder, 22 Nov 2026).
 */
const CLEAR_ALL_KEEP_TYPES = ['approve_blog_draft'] as const;

/**
 * Dismiss every open action except blog reviews. Dismissed, not deleted:
 * rows stay in the DB with resolvedBy/resolvedAt, so a clear can be traced
 * and reversed. Returns how many were cleared.
 */
export async function clearAllActionsExceptBlog(): Promise<number> {
  const { userId } = await requireFounder();

  const result = await database.founderAction.updateMany({
    where: {
      status: { in: ['pending', 'in_progress'] },
      type: { notIn: [...CLEAR_ALL_KEEP_TYPES] },
    },
    data: {
      status: 'dismissed',
      resolvedBy: userId,
      resolvedAt: new Date(),
    },
  });

  revalidatePath('/actions');
  revalidatePath('/');
  return result.count;
}
