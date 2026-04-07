'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { UserPreference } from '@repo/database';

type UpdatePrefsInput = {
  promptHour: number;
  timezone: string;
};

export const updatePreferences = async (
  input: UpdatePrefsInput
): Promise<{ data: UserPreference } | { error: unknown }> => {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error('Not authenticated');

    if (input.promptHour < 0 || input.promptHour > 23) {
      throw new Error('promptHour must be between 0 and 23');
    }

    const prefs = await database.userPreference.upsert({
      where: { userId },
      create: { userId, promptHour: input.promptHour, timezone: input.timezone },
      update: { promptHour: input.promptHour, timezone: input.timezone },
    });

    return { data: prefs };
  } catch (error) {
    return { error };
  }
};
