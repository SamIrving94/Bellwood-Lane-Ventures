'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { HelpCircleIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { runTourForPath } from '../guide/tour-launcher';

/**
 * Persistent "Start tour" affordance in the topbar. Available on every
 * authenticated page — there is no per-user completion state. Clicking
 * runs the tour that matches the current pathname (see tourIdForPath).
 */
export function StartTourButton() {
  const pathname = usePathname();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label="Start guided tour"
      onClick={() => runTourForPath(pathname)}
      className="mr-4"
    >
      <HelpCircleIcon className="h-4 w-4" />
      Tour
    </Button>
  );
}
