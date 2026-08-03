'use client';

import { updateFieldPartner } from '@/app/actions/network/field-partners';
import { Button } from '@repo/design-system/components/ui/button';
import { useTransition } from 'react';
import { toast } from 'sonner';

type Partner = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  background: string | null;
  postcodeAreas: string[];
  active: boolean;
  viewingsCompleted: number;
  workOrderCount: number;
};

export function PartnerRow({ partner }: { partner: Partner }) {
  const [isPending, startTransition] = useTransition();

  const toggleActive = () => {
    startTransition(async () => {
      try {
        await updateFieldPartner(partner.id, { active: !partner.active });
        toast.success(partner.active ? 'Partner paused.' : 'Partner active.');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update.');
      }
    });
  };

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between ${
        partner.active ? '' : 'opacity-60'
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium">{partner.name}</p>
          {!partner.active && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              Paused
            </span>
          )}
        </div>
        <p className="text-muted-foreground text-xs">
          {partner.background ? `${partner.background} · ` : ''}
          {partner.email}
          {partner.phone ? ` · ${partner.phone}` : ''}
        </p>
        {partner.postcodeAreas.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {partner.postcodeAreas.map((a) => (
              <span
                key={a}
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]"
              >
                {a}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <div className="text-right text-muted-foreground text-xs">
          <p>
            <span className="font-semibold text-foreground">
              {partner.viewingsCompleted}
            </span>{' '}
            viewings
          </p>
          <p>
            <span className="font-semibold text-foreground">
              {partner.workOrderCount}
            </span>{' '}
            work orders
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={toggleActive}
          disabled={isPending}
        >
          {partner.active ? 'Pause' : 'Activate'}
        </Button>
      </div>
    </div>
  );
}
