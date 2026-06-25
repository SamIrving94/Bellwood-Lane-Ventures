'use client';

import { startSocialLinking } from '@/app/actions/social/connect';
import { Button } from '@repo/design-system/components/ui/button';
import { useTransition } from 'react';
import { toast } from 'sonner';

const AYRSHARE_DASHBOARD = 'https://app.ayrshare.com/social-accounts';

export function ConnectButton({
  configured,
  label,
}: {
  configured: boolean;
  label: string;
}) {
  const [isPending, startTransition] = useTransition();

  const handleConnect = () => {
    startTransition(async () => {
      const res = await startSocialLinking();
      if (res.ok) {
        // Hosted Ayrshare linking page — founder authorises each network there.
        window.open(res.url, '_blank', 'noopener,noreferrer');
        return;
      }
      if (res.reason === 'no_sso_keys') {
        // No JWT/SSO keys — fall back to the Ayrshare dashboard directly.
        window.open(AYRSHARE_DASHBOARD, '_blank', 'noopener,noreferrer');
        toast.message('Opened Ayrshare — connect your accounts there.');
        return;
      }
      toast.error(
        res.reason === 'no_api_key'
          ? 'Add AYRSHARE_API_KEY first (see setup note).'
          : `Couldn't start linking (${res.reason}).`
      );
    });
  };

  return (
    <Button onClick={handleConnect} disabled={!configured || isPending}>
      {isPending ? 'Opening…' : label}
    </Button>
  );
}
