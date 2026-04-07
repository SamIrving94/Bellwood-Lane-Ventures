'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { JournalEntry } from '@repo/database';

const ALLOWED_MOODS = ['🤩', '😊', '😐', '😔', '😤'];

export const updateEntry = async (
  id: string,
  content: string,
  mood?: string | null
): Promise<{ data: JournalEntry } | { error: unknown }> => {
  try {
    const { userId } = await auth();

    if (!userId) {
      throw new Error('Not authenticated');
    }

    if (!content.trim()) {
      throw new Error('Entry content cannot be empty');
    }

    // Ensure the entry belongs to this user
    const existing = await database.journalEntry.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new Error('Entry not found');
    }

    const validMood =
      mood && ALLOWED_MOODS.includes(mood) ? mood : mood === null ? null : existing.mood;

    const entry = await database.journalEntry.update({
      where: { id },
      data: { content: content.trim(), mood: validMood },
    });

    return { data: entry };
  } catch (error) {
    return { error };
  }
};
