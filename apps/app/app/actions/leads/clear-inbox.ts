'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';

/**
 * Bulk-clears the New-leads inbox — for when the founder's been away and it's
 * overwhelming. Deletes (doesn't archive) status='new' leads, deliberately:
 * marking them 'passed' would feed a false rejection signal into the
 * dealbreaker screen and scorer calibration, and — because ScoutLead is keyed
 * unique on (address, postcode) with `skipDuplicates` on the daily insert —
 * any status short of deletion leaves the row in place forever, so a property
 * that's still solid could never resurface on a later scout run. Deleting the
 * row is what lets it come back fresh if found again.
 *
 * Scoped to status='new' only. Shortlisted/watching/passed/converted leads
 * are real founder decisions and are left untouched.
 */
export async function clearNewLeadsInbox() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const { count } = await database.scoutLead.deleteMany({
    where: { status: 'new' },
  });

  // The daily review card points at leads that no longer exist — close it
  // rather than leave it referencing a now-empty inbox.
  await database.founderAction
    .updateMany({
      where: {
        dedupKey: 'scout-review-leads',
        status: { in: ['pending', 'in_progress'] },
      },
      data: { status: 'completed', resolvedAt: new Date() },
    })
    .catch(() => undefined);

  revalidatePath('/leads');
  revalidatePath('/');

  return { deleted: count };
}
