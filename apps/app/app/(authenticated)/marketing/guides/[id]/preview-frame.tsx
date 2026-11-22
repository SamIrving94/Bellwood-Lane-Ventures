'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { ExternalLinkIcon, MonitorIcon, SmartphoneIcon } from 'lucide-react';
import { useState } from 'react';

/**
 * The draft guide, framed from the public site so it renders with the real
 * header, fonts and footer. Phone width is 390px (a current iPhone), which
 * is how most readers arriving from a search will see it.
 */
export function PreviewFrame({ src }: { readonly src: string }) {
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={device === 'desktop' ? 'default' : 'outline'}
          onClick={() => setDevice('desktop')}
        >
          <MonitorIcon className="mr-1 h-3 w-3" />
          Desktop
        </Button>
        <Button
          size="sm"
          variant={device === 'phone' ? 'default' : 'outline'}
          onClick={() => setDevice('phone')}
        >
          <SmartphoneIcon className="mr-1 h-3 w-3" />
          Phone
        </Button>
        <div className="flex-1" />
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-muted-foreground text-xs underline"
        >
          Open in a new tab
          <ExternalLinkIcon className="h-3 w-3" />
        </a>
      </div>

      <div className="flex justify-center rounded-lg border bg-muted/40 p-3">
        <iframe
          key={device}
          src={src}
          title="Guide preview"
          className="h-[80vh] rounded-md border bg-white shadow-sm"
          style={{ width: device === 'phone' ? 390 : '100%' }}
        />
      </div>
    </div>
  );
}
