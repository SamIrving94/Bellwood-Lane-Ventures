'use client';

import { Button } from '@repo/design-system/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { PlayIcon, type LucideIcon } from 'lucide-react';
import { runTour } from './tour-launcher';

type Props = {
  tourId: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

/**
 * A single launchable tour on the /guide index. Server component above
 * picks the icon and copy; this client wrapper just holds the click
 * handler so we can fire driver.js without making the whole page client.
 */
export function TourCard({ tourId, title, description, icon: Icon }: Props) {
  return (
    <Card className="flex h-full flex-col gap-3">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-foreground">
            <Icon className="h-4 w-4" />
          </span>
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto">
        <Button
          type="button"
          size="sm"
          onClick={() => runTour(tourId)}
          aria-label={`Start the ${title} tour`}
        >
          <PlayIcon className="h-3.5 w-3.5" />
          Start tour
        </Button>
      </CardContent>
    </Card>
  );
}
