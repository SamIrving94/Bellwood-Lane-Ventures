'use client';

import { findOlderDealEmails } from '@/app/actions/deals/import-email-history';
import { Button } from '@repo/design-system/components/ui/button';
import { useTransition } from 'react';
import { toast } from 'sonner';

/**
 * "Find older emails": search Gmail for this deal's seller and solicitor
 * over the last six months. The regular sync only looks forward, so this is
 * how a deal gets its history, or catches up after a contact is added.
 */
export function FindOlderEmails({ dealId }: { dealId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            toast.message(await findOlderDealEmails(dealId));
          } catch (err) {
            toast.error(
              err instanceof Error ? err.message : 'Could not search Gmail.'
            );
          }
        })
      }
      size="sm"
      type="button"
      variant="outline"
    >
      {pending ? 'Searching Gmail…' : 'Find older emails'}
    </Button>
  );
}
