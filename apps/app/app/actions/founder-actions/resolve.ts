'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';

export async function resolveAction(
  actionId: string,
  resolution: 'completed' | 'dismissed',
  notes?: string
) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

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
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

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
