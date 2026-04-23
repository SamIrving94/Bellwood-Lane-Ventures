'use server';

import { env } from '@/env';
import { auth } from '@repo/auth/server';
import { revalidatePath } from 'next/cache';

type PasteInput = {
  rawText: string;
  groupName?: string;
  senderName?: string;
  source?: 'paste' | 'share_sheet';
};

type PasteResult = {
  intakeId: string;
  scoutLeadId: string | null;
  founderActionId: string | null;
  parseStatus: string;
};

export async function pasteWhatsAppMessage(
  input: PasteInput
): Promise<PasteResult> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const rawText = input.rawText?.trim();
  if (!rawText) throw new Error('rawText is required');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const key = env.PAPERCLIP_API_KEY;
  if (!apiUrl) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured');
  }
  if (!key) {
    throw new Error('PAPERCLIP_API_KEY is not configured');
  }

  const res = await fetch(`${apiUrl}/agents/intake/whatsapp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      source: input.source ?? 'paste',
      rawText,
      groupName: input.groupName,
      senderName: input.senderName,
      receivedAt: new Date().toISOString(),
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Intake API ${res.status}: ${txt || res.statusText}`);
  }

  const data = (await res.json()) as PasteResult;

  revalidatePath('/intake');
  revalidatePath('/leads');
  revalidatePath('/actions');

  return data;
}
