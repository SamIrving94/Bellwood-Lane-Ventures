'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { PhoneMapping } from '@repo/database';

export const linkPhone = async (
  phoneNumber: string
): Promise<{ data: PhoneMapping } | { error: unknown }> => {
  try {
    const { userId } = await auth();

    if (!userId) {
      throw new Error('Not authenticated');
    }

    // Normalize: strip non-digit chars, keep leading +
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');

    if (cleaned.length < 7) {
      throw new Error('Invalid phone number');
    }

    const mapping = await database.phoneMapping.upsert({
      where: { userId },
      create: { userId, phoneNumber: cleaned },
      update: { phoneNumber: cleaned },
    });

    return { data: mapping };
  } catch (error) {
    return { error };
  }
};
