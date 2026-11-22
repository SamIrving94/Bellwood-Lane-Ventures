'use client';

import { refreshPartnerSheetNow } from '@/app/actions/google';
import { Button } from '@repo/design-system/components/ui/button';
import { useTransition } from 'react';
import { toast } from 'sonner';

export function PartnerSheetButton({ sheetUrl }: { sheetUrl: string | null }) {
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(async () => {
      const result = await refreshPartnerSheetNow();
      if (result.ok) {
        toast.success('Partner sheet is up to date.');
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={isPending}
      >
        {isPending ? 'Working…' : sheetUrl ? 'Refresh now' : 'Create the sheet'}
      </Button>
      {sheetUrl && (
        <Button asChild variant="ghost" size="sm">
          <a href={sheetUrl} target="_blank" rel="noreferrer">
            Open sheet
          </a>
        </Button>
      )}
    </div>
  );
}
