'use server';

import {
  extractPostContent,
  platformsForActionType,
  publishToSocial,
} from '@/lib/social/ayrshare';
import { auth } from '@repo/auth/server';
import { type Prisma, database } from '@repo/database';
import { revalidatePath } from 'next/cache';

/**
 * Approve a marketing draft AND publish it.
 *
 * This is the missing "publish" leg: previously approving a marketing
 * FounderAction only flipped its status to completed and nothing went live.
 * Now it pushes the draft to the right social platform (via Ayrshare) and
 * stamps `metadata.publishedAt` so the Calendar / Performance views light up.
 *
 * Graceful: with no AYRSHARE_API_KEY the publish is skipped but the draft is
 * still marked completed + stamped, so the flow is identical and goes live for
 * real once the key is configured. Never auto-publishes — only on this explicit
 * founder action.
 *
 * @param scheduleDateIso optional ISO time to schedule instead of posting now.
 */
export async function publishMarketingDraft(
  actionId: string,
  scheduleDateIso?: string
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Unauthorized' };

  const action = await database.founderAction.findUnique({
    where: { id: actionId },
  });
  if (!action) return { ok: false, error: 'Action not found' };

  const platforms = platformsForActionType(action.type);
  if (!platforms) {
    return {
      ok: false,
      error: 'This draft type is not a social post — use Approve instead.',
    };
  }

  const content = extractPostContent(action.metadata);
  if (!content) {
    return { ok: false, error: 'No post text found on this draft.' };
  }

  const result = await publishToSocial({
    platforms,
    text: content.text,
    mediaUrls: content.mediaUrls,
    scheduleDate: scheduleDateIso,
  });

  if (result.status === 'error') {
    return { ok: false, status: result.status, error: result.error };
  }

  // Merge publish outcome onto the existing metadata and mark completed.
  const prevMeta =
    action.metadata && typeof action.metadata === 'object'
      ? (action.metadata as Record<string, unknown>)
      : {};
  const nowIso = new Date().toISOString();
  const updatedMeta = {
    ...prevMeta,
    publishedAt: scheduleDateIso ?? nowIso,
    publishResult: {
      status: result.status,
      platforms: result.platforms,
      id: result.id ?? null,
      at: nowIso,
    },
  };

  await database.founderAction.update({
    where: { id: actionId },
    data: {
      status: 'completed',
      resolvedBy: userId,
      resolvedAt: new Date(),
      metadata: updatedMeta as Prisma.InputJsonValue,
    },
  });

  // Log it so the activity feed + telemetry see publishes.
  await database.agentEvent
    .create({
      data: {
        agent: 'marketer',
        eventType: 'marketing_published',
        summary: `Published ${action.type} to ${result.platforms.join(', ')} (${result.status})`,
        count: 1,
        payload: {
          actionId,
          status: result.status,
          platforms: result.platforms,
        },
      },
    })
    .catch(() => {
      // Telemetry must never block the publish.
    });

  revalidatePath('/marketing');
  revalidatePath('/marketing/calendar');
  revalidatePath('/marketing/performance');
  revalidatePath('/actions');
  revalidatePath('/');
  return { ok: true, status: result.status };
}
