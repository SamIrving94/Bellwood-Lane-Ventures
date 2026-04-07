'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { JournalEntry } from '@repo/database';

export const listEntries = async (
  limit = 50,
  offset = 0
): Promise<{ data: JournalEntry[] } | { error: unknown }> => {
  try {
    const { userId } = await auth();

    if (!userId) {
      throw new Error('Not authenticated');
    }

    const entries = await database.journalEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return { data: entries };
  } catch (error) {
    return { error };
  }
};
