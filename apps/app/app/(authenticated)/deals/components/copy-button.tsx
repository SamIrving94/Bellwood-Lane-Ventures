'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { toast } from 'sonner';

/** Copies `value` to the clipboard. The value stays readable beside it. */
export function CopyButton({
  value,
  label = 'Copy',
}: {
  value: string;
  label?: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => {
        navigator.clipboard
          .writeText(value)
          .then(() => toast.success('Copied.'))
          .catch(() => toast.error('Could not copy. Select the text instead.'));
      }}
    >
      {label}
    </Button>
  );
}
