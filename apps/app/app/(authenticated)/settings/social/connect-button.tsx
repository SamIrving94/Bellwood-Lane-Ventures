'use client';

import { startSocialLinking } from '@/app/actions/social/connect';
import { Button } from '@repo/design-system/components/ui/button';
import { useTransition } from 'react';
import { toast } from 'sonner';

export function ConnectButton({
  hasUrl,
  label,
}: {
  hasUrl: boolean;
  label: string;
}) {
  const [isPending, startTransition] = useTransition();

  const handleConnect = () => {
    startTransition(async () => {
      const res = await startSocialLinking();
      if (res.ok) {
        // Opens the provider's connect page (Postiz dashboard, LinkedIn, or an
        // Ayrshare hosted linking URL) — the founder authorises there.
        window.open(res.url, '_blank', 'noopener,noreferrer');
        return;
      }
      toast.error('Finish setup first (see the note above).');
    });
  };

  return (
    <Button onClick={handleConnect} disabled={!hasUrl || isPending}>
      {isPending ? 'Opening…' : label}
    </Button>
  );
}
