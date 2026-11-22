'use server';

import { requireFounder } from '@repo/auth/server';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { approveGuide, publishGuide } from './publish';

/**
 * Edit a guide's text before it goes out — how the founders fold Counsel's
 * suggested fixes into the draft. Founder-only, and only while the guide is
 * a draft or approved: a published guide is pulled back (Unpublish) before
 * its words change, so the live page never shifts under a reader.
 *
 * The compliance report is not re-run. It describes the draft as written;
 * the founder's edit is the response to it.
 */

const GuideText = z.object({
  title: z.string().trim().min(5).max(120),
  h1: z.string().trim().min(5).max(160),
  metaDescription: z.string().trim().min(20).max(320),
  hook: z.string().trim().max(1200),
  bodyMarkdown: z.string().trim().min(200).max(40_000),
  ctaLine: z.string().trim().min(5).max(300),
});

export type GuideTextInput = z.infer<typeof GuideText>;

type Result = { ok: true } | { ok: false; error: string };

export async function saveGuideText(
  guidePostId: string,
  input: GuideTextInput
): Promise<Result> {
  await requireFounder();

  const parsed = GuideText.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: `${first?.path.join('.') || 'text'}: ${first?.message ?? 'invalid'}`,
    };
  }

  const current = await database.guidePost.findUnique({
    where: { id: guidePostId },
    select: { status: true },
  });
  if (!current) return { ok: false, error: 'Guide not found.' };
  if (current.status !== 'draft' && current.status !== 'approved') {
    return {
      ok: false,
      error: `A ${current.status} guide can't be edited. Unpublish it first.`,
    };
  }

  const d = parsed.data;
  await database.guidePost.update({
    where: { id: guidePostId },
    data: { ...d, hook: d.hook === '' ? null : d.hook },
  });

  revalidatePath('/marketing/guides');
  revalidatePath('/marketing/guides/[id]', 'page');
  return { ok: true };
}

/** Save, then approve — one click from the editor. */
export async function saveAndApproveGuide(
  guidePostId: string,
  input: GuideTextInput
): Promise<Result> {
  const saved = await saveGuideText(guidePostId, input);
  if (!saved.ok) return saved;
  await approveGuide(guidePostId);
  return { ok: true };
}

/** Save, then publish — one click from the editor. */
export async function saveAndPublishGuide(
  guidePostId: string,
  input: GuideTextInput
): Promise<Result> {
  const saved = await saveGuideText(guidePostId, input);
  if (!saved.ok) return saved;
  await publishGuide(guidePostId);
  return { ok: true };
}
