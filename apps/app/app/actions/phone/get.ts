'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';

export const getLinkedPhone = async (): Promise<
  { data: string | null } | { error: unknown }
> => {
  try {
    const { userId } = await auth();

    if (!userId) {
      throw new Error('Not authenticated');
    }

    const mapping = await database.phoneMapping.findUnique({
      where: { userId },
    });

    return { data: mapping?.phoneNumber ?? null };
  } catch (error) {
    return { error };
  }
};
