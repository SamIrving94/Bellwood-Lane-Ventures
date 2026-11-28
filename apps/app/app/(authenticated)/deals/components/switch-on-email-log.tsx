'use client';

import { switchOnDealEmailLog } from '@/app/actions/deals/switch-on-email-log';
import { Button } from '@repo/design-system/components/ui/button';
import { useTransition } from 'react';
import { toast } from 'sonner';

const COPY = {
  missing: {
    lead: 'The email log is not switched on yet.',
    rest: 'It needs one new table in the database.',
    button: 'Switch on the email log',
    note: 'Adds one empty table. Nothing else in the database changes.',
  },
  outdated: {
    lead: 'The email log needs a quick update.',
    rest: 'One new column, so it knows which mailbox each email came from.',
    button: 'Update the email log',
    note: 'Adds to the email log’s table. Nothing is removed.',
  },
} as const;

/**
 * Shown where the email log would be, while its table is missing or older
 * than the code. One click creates or updates it (`switchOnDealEmailLog`),
 * so nobody needs a terminal or the database password. The page reloads
 * itself when it is done.
 */
export function SwitchOnEmailLog({
  state = 'missing',
}: {
  state?: 'missing' | 'outdated';
}) {
  const [pending, startTransition] = useTransition();
  const copy = COPY[state];

  return (
    <div className="space-y-2 text-sm">
      <p>
        <strong>{copy.lead}</strong> {copy.rest}
      </p>
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              const result = await switchOnDealEmailLog();
              if (result.ok) {
                toast.success(result.message);
              } else {
                toast.error(result.message);
              }
            } catch {
              // Not signed in as a founder, or the request never arrived.
              toast.error(
                'Could not switch on the email log. Nothing was changed.'
              );
            }
          })
        }
        size="sm"
        type="button"
      >
        {pending ? 'Working…' : copy.button}
      </Button>
      <p className="text-muted-foreground text-xs">{copy.note}</p>
    </div>
  );
}
