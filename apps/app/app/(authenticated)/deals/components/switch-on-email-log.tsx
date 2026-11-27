'use client';

import { switchOnDealEmailLog } from '@/app/actions/deals/switch-on-email-log';
import { Button } from '@repo/design-system/components/ui/button';
import { useTransition } from 'react';
import { toast } from 'sonner';

/**
 * Shown where the email log would be, while its table does not exist yet.
 * One click creates it (`switchOnDealEmailLog`), so nobody needs a terminal
 * or the database password. The page reloads itself when it is done.
 */
export function SwitchOnEmailLog() {
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2 text-sm">
      <p>
        <strong>The email log is not switched on yet.</strong> It needs one new
        table in the database.
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
        {pending ? 'Switching on…' : 'Switch on the email log'}
      </Button>
      <p className="text-muted-foreground text-xs">
        Adds one empty table. Nothing else in the database changes.
      </p>
    </div>
  );
}
