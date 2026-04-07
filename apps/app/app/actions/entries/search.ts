'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { JournalEntry } from '@repo/database';

export const searchEntries = async (
  query: string
): Promise<{ data: JournalEntry[] } | { error: unknown }> => {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error('Not authenticated');

    if (!query.trim()) {
      // Empty query — return all entries
      const entries = await database.journalEntry.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      return { data: entries };
    }

    const entries = await database.journalEntry.findMany({
      where: {
        userId,
        content: { contains: query.trim(), mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: entries };
  } catch (error) {
    return { error };
  }
};
