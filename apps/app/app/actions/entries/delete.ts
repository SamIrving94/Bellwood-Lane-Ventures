'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';

export const deleteEntry = async (
  id: string
): Promise<{ data: true } | { error: unknown }> => {
  try {
    const { userId } = await auth();

    if (!userId) {
      throw new Error('Not authenticated');
    }

    // Ensure the entry belongs to this user before deleting
    const entry = await database.journalEntry.findFirst({
      where: { id, userId },
    });

    if (!entry) {
      throw new Error('Entry not found');
    }

    await database.journalEntry.delete({ where: { id } });

    return { data: true };
  } catch (error) {
    return { error };
  }
};
