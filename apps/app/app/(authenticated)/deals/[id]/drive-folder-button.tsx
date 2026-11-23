'use client';

import { createDealDriveFolder } from '@/app/actions/google';
import { Button } from '@repo/design-system/components/ui/button';
import { FolderIcon } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';

/**
 * The deal's Google Drive folder. Shows a link once it exists; before that,
 * a button to make it (it is also made automatically at the valuation
 * stage). Hidden entirely until the Kept Google account is connected.
 */
export function DriveFolderButton({
  dealId,
  folderUrl,
  connected,
}: {
  dealId: string;
  folderUrl: string | null;
  connected: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (folderUrl) {
    return (
      <Button asChild variant="outline" size="sm">
        <a href={folderUrl} target="_blank" rel="noreferrer">
          <FolderIcon className="mr-1 h-3 w-3" />
          Drive folder
        </a>
      </Button>
    );
  }
  if (!connected) {
    return null;
  }

  const handleCreate = () => {
    startTransition(async () => {
      const result = await createDealDriveFolder(dealId);
      if (result.ok) {
        toast.success('Drive folder created.');
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCreate}
      disabled={isPending}
    >
      <FolderIcon className="mr-1 h-3 w-3" />
      {isPending ? 'Creating…' : 'Create Drive folder'}
    </Button>
  );
}
