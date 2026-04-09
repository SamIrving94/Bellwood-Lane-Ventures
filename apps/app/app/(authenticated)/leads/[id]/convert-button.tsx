'use client';

import { convertLeadToDeal } from '@/app/actions/leads/convert';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export const ConvertButton = ({ leadId }: { leadId: string }) => {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleConvert = () => {
    startTransition(async () => {
      const deal = await convertLeadToDeal(leadId);
      router.push(`/deals/${deal.id}`);
    });
  };

  return (
    <button
      type="button"
      onClick={handleConvert}
      disabled={isPending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
    >
      {isPending ? 'Converting...' : 'Convert to Deal'}
    </button>
  );
};
