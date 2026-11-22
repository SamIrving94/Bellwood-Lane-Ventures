'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { EraserIcon } from 'lucide-react';
import { useTransition } from 'react';
import { clearAllActionsExceptBlog } from '@/app/actions/founder-actions/resolve';

/**
 * Clears the Today queue in one go, keeping blog reviews. Asks first,
 * because it can sweep dozens of items. `count` is how many will go.
 */
export function ClearActionsButton({ count }: { readonly count: number }) {
  const [pending, startTransition] = useTransition();

  if (count === 0) {
    return null;
  }

  const onClick = () => {
    const ok = window.confirm(
      `Clear ${count} notification${count === 1 ? '' : 's'}?\n\nBlog reviews stay. Everything else is dismissed.`
    );
    if (!ok) {
      return;
    }
    startTransition(async () => {
      await clearAllActionsExceptBlog();
    });
  };

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={pending}>
      <EraserIcon className="h-4 w-4" />
      {pending ? 'Clearing…' : 'Clear all (keep blogs)'}
    </Button>
  );
}
