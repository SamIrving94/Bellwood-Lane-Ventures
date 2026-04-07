'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { UserPreference } from '@repo/database';

export const getPreferences = async (): Promise<
  { data: UserPreference | null } | { error: unknown }
> => {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error('Not authenticated');

    const prefs = await database.userPreference.findUnique({
      where: { userId },
    });

    return { data: prefs };
  } catch (error) {
    return { error };
  }
};
