'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { JournalEntry } from '@repo/database';

const ALLOWED_MOODS = ['🤩', '😊', '😐', '😔', '😤'];

export const createEntry = async (
  content: string,
  mood?: string,
  imageUrl?: string
): Promise<{ data: JournalEntry } | { error: unknown }> => {
  try {
    const { userId } = await auth();

    if (!userId) {
      throw new Error('Not authenticated');
    }

    if (!content.trim() && !imageUrl) {
      throw new Error('Entry content cannot be empty');
    }

    // Validate mood if provided
    const validMood = mood && ALLOWED_MOODS.includes(mood) ? mood : null;

    const entry = await database.journalEntry.create({
      data: {
        userId,
        content: content.trim(),
        source: 'web',
        mood: validMood,
        imageUrl: imageUrl ?? null,
      },
    });

    return { data: entry };
  } catch (error) {
    return { error };
  }
};
