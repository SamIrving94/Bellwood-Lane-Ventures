import { Button } from '@repo/design-system/components/ui/button';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
};

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center">
    <div className="rounded-full bg-muted p-3">
      <Icon className="h-6 w-6 text-muted-foreground" />
    </div>
    <h3 className="text-sm font-medium">{title}</h3>
    <p className="max-w-xs text-sm text-muted-foreground">{description}</p>
    {action && (
      <Button asChild variant="outline" size="sm" className="mt-1">
        <Link href={action.href}>{action.label}</Link>
      </Button>
    )}
  </div>
);
