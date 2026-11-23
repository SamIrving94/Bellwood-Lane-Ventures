'use server';

import { requireFounder } from '@repo/auth/server';
import { importDealHistory } from '@repo/google';
import { revalidatePath } from 'next/cache';

/**
 * Search Gmail for one deal's older emails and add the ones that belong to
 * it. Returns a sentence for the founder, because "0 found" needs a reason:
 * no Google, no addresses on the deal, or genuinely nothing there.
 */
export async function findOlderDealEmails(dealId: string): Promise<string> {
  await requireFounder();

  const result = await importDealHistory(dealId);
  if (result.skipped) {
    return 'Google is not connected. Connect it in Settings → Google first.';
  }
  if (result.noAddresses) {
    return 'There is no seller or solicitor email on this deal to search for.';
  }

  revalidatePath(`/deals/${dealId}`);
  revalidatePath('/deals/email-log');

  const added =
    result.kept === 0
      ? 'No new emails found for this deal in the last six months.'
      : `Added ${result.kept} email${result.kept === 1 ? '' : 's'}.`;
  const notes = [
    result.ignored > 0
      ? `${result.ignored} could belong to another deal and were left.`
      : null,
    result.errors > 0 ? `${result.errors} could not be read.` : null,
    result.capped ? 'There may be more: run it again.' : null,
  ].filter((n) => n !== null);
  return [added, ...notes].join(' ');
}
