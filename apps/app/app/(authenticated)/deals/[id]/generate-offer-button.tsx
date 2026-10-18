'use client';

import { generateDealOffer } from '@/app/actions/deals/generate-offer';
import { Button } from '@repo/design-system/components/ui/button';
import { useTransition } from 'react';
import { toast } from 'sonner';

export function GenerateOfferButton({
  dealId,
  hasOffer,
}: {
  dealId: string;
  hasOffer: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const handleGenerate = () => {
    startTransition(async () => {
      try {
        const result = await generateDealOffer(dealId);
        const offer = (result.offerPence / 100).toLocaleString('en-GB', {
          style: 'currency',
          currency: 'GBP',
          maximumFractionDigits: 0,
        });
        if (result.assumedPropertyType) {
          toast.warning(
            `Offer ${offer} generated, but the property type is unknown so it was valued as ${result.assumedPropertyType}. Check the type before using this offer.`
          );
        } else if (result.requiresReview) {
          toast.warning(
            `Offer ${offer} generated — needs founder review (offer <60% AVM or discount capped).`
          );
        } else {
          toast.success(
            `Offer ${offer} generated${
              result.marginPercent
                ? ` · ${result.marginPercent.toFixed(1)}% below market`
                : ''
            }.`
          );
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to generate offer.'
        );
      }
    });
  };

  return (
    <Button
      variant={hasOffer ? 'outline' : 'default'}
      size="sm"
      onClick={handleGenerate}
      disabled={isPending}
    >
      {isPending
        ? 'Valuing…'
        : hasOffer
          ? 'Re-run valuation'
          : 'Generate suggested offer'}
    </Button>
  );
}
