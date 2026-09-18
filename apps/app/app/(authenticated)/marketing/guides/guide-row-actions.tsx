'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { useTransition } from 'react';
import {
  approveGuide,
  archiveGuide,
  publishGuide,
  unpublishGuide,
} from '@/app/actions/guides/publish';

type Status = 'draft' | 'approved' | 'published' | 'archived';

/**
 * The four transitions a guide can make, rendered per row. Publish is the
 * only one that reaches the public site, and it is a person's click.
 */
export function GuideRowActions({
  id,
  status,
}: {
  id: string;
  status: Status;
}) {
  const [isPending, startTransition] = useTransition();
  const run = (fn: (id: string) => Promise<unknown>) =>
    startTransition(async () => {
      await fn(id);
    });

  return (
    <div className="flex items-center justify-end gap-2">
      {status === 'draft' && (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => run(approveGuide)}
        >
          Approve
        </Button>
      )}
      {(status === 'draft' || status === 'approved') && (
        <Button
          size="sm"
          disabled={isPending}
          onClick={() => run(publishGuide)}
        >
          Publish
        </Button>
      )}
      {status === 'published' && (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => run(unpublishGuide)}
        >
          Unpublish
        </Button>
      )}
      {status !== 'archived' && (
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => run(archiveGuide)}
        >
          Archive
        </Button>
      )}
    </div>
  );
}
