'use server';

import { requireFounder } from '@repo/auth/server';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';

/**
 * Guide lifecycle, founder-only. The public site (apps/web) renders
 * `published` rows at /guides/<slug> on a 5-minute ISR window, so a publish
 * here is live within five minutes without a deploy. Nothing in the cron
 * path can reach these transitions: publishing is a person's click.
 */

const revalidate = () => {
  revalidatePath('/marketing/queue');
  revalidatePath('/marketing/guides');
  revalidatePath('/actions');
  revalidatePath('/');
};

async function resolveLinkedAction(
  founderActionId: string | null,
  userId: string,
  status: 'completed' | 'dismissed'
) {
  if (!founderActionId) return;
  await database.founderAction
    .update({
      where: { id: founderActionId },
      data: { status, resolvedBy: userId, resolvedAt: new Date() },
    })
    .catch(() => undefined);
}

export async function approveGuide(guidePostId: string) {
  const { userId } = await requireFounder();
  const row = await database.guidePost.update({
    where: { id: guidePostId },
    data: { status: 'approved', approvedAt: new Date() },
    select: { founderActionId: true },
  });
  await resolveLinkedAction(row.founderActionId, userId, 'completed');
  revalidate();
}

export async function publishGuide(guidePostId: string) {
  const { userId } = await requireFounder();
  const row = await database.guidePost.update({
    where: { id: guidePostId },
    data: {
      status: 'published',
      publishedAt: new Date(),
      publishedBy: userId,
      approvedAt: new Date(),
    },
    select: { founderActionId: true, slug: true },
  });
  await resolveLinkedAction(row.founderActionId, userId, 'completed');
  revalidate();
  return { slug: row.slug };
}

export async function unpublishGuide(guidePostId: string) {
  await requireFounder();
  await database.guidePost.update({
    where: { id: guidePostId },
    data: { status: 'approved', publishedAt: null, publishedBy: null },
  });
  revalidate();
}

export async function archiveGuide(guidePostId: string) {
  const { userId } = await requireFounder();
  const row = await database.guidePost.update({
    where: { id: guidePostId },
    data: { status: 'archived', publishedAt: null },
    select: { founderActionId: true },
  });
  await resolveLinkedAction(row.founderActionId, userId, 'dismissed');
  revalidate();
}
