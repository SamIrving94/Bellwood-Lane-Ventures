'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { DatabaseIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { seedEvalConfigs } from '@/app/actions/evals/seed';

export function SeedButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      onClick={() =>
        startTransition(async () => {
          await seedEvalConfigs();
          router.refresh();
        })
      }
      disabled={isPending}
    >
      <DatabaseIcon className="mr-2 h-4 w-4" />
      {isPending ? 'Seeding...' : 'Seed Defaults'}
    </Button>
  );
}
