'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';

type FetchResult =
  | { extract: unknown }
  | { error: string };

export async function fetchExtract(id: string): Promise<FetchResult> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in.' };

  const row = await database.documentExtract.findUnique({
    where: { id },
    select: { extractJson: true },
  });

  if (!row) return { error: 'Extract not found.' };
  return { extract: row.extractJson };
}
