'use client';

import { launchCampaign } from '@/app/actions/campaigns/launch';
import {
  completeCampaign,
  pauseCampaign,
  resumeCampaign,
} from '@/app/actions/campaigns/update-status';
import { Button } from '@repo/design-system/components/ui/button';
import { useState, useTransition } from 'react';

type Props = {
  campaignId: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
};

export function StatusButtons({ campaignId, status }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      setError(null);
      try {
        await fn();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Action failed');
      }
    });

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {status === 'draft' && (
          <Button
            disabled={isPending}
            onClick={() => run(() => launchCampaign(campaignId))}
          >
            {isPending ? 'Launching...' : 'Launch Campaign'}
          </Button>
        )}
        {status === 'active' && (
          <>
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => run(() => pauseCampaign(campaignId))}
            >
              Pause
            </Button>
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => run(() => completeCampaign(campaignId))}
            >
              Complete
            </Button>
          </>
        )}
        {status === 'paused' && (
          <>
            <Button
              disabled={isPending}
              onClick={() => run(() => resumeCampaign(campaignId))}
            >
              Resume
            </Button>
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => run(() => completeCampaign(campaignId))}
            >
              Complete
            </Button>
          </>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
