'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { restoreOfferVersion } from '@/app/actions/offer-config/manage';

type VersionRow = {
  version: number;
  description: string | null;
  activatedAt: Date | null;
  activatedBy: string | null;
  createdAt: Date;
};

export function OfferVersionHistory({
  versions,
  liveVersion,
}: {
  versions: VersionRow[];
  liveVersion: number | null;
}) {
  const [isPending, startTransition] = useTransition();

  const handleRestore = (version: number) => {
    startTransition(async () => {
      try {
        const { version: newVersion } = await restoreOfferVersion(version);
        toast.success(`Restored v${version} as v${newVersion}. Now live.`);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to restore version.',
        );
      }
    });
  };

  if (versions.length === 0) {
    return (
      <section className="rounded-xl border border-dashed bg-slate-50 p-5 text-muted-foreground text-xs">
        No saved versions yet. The offer calculator is running on built-in
        defaults. Save a policy above to start a version history.
      </section>
    );
  }

  return (
    <section className="rounded-xl border bg-card">
      <div className="border-b p-4">
        <h2 className="font-medium text-sm">Version history</h2>
        <p className="mt-0.5 text-muted-foreground text-xs">
          Every save is kept. Restore any version to roll back instantly.
        </p>
      </div>
      <ul className="divide-y">
        {versions.map((v) => {
          const isLive = v.version === liveVersion;
          return (
            <li
              key={v.version}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm">
                  <span className="font-mono font-semibold">v{v.version}</span>
                  {isLive && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-[10px] text-emerald-700">
                      LIVE
                    </span>
                  )}
                </p>
                <p className="truncate text-muted-foreground text-xs">
                  {v.description ?? 'No description'}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(v.createdAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
              {!isLive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRestore(v.version)}
                  disabled={isPending}
                >
                  Restore
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
