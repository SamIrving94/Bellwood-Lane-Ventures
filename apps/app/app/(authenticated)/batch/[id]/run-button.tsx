'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Drives the chunked batch-appraise route from the browser: POST repeatedly
 * until `remaining` hits 0, surfacing a live progress count, then refresh the
 * server component so the ranked table re-renders with results.
 */
export function RunButton({
  batchId,
  totalItems,
  processedItems,
}: {
  batchId: string;
  totalItems: number;
  processedItems: number;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(processedItems);
  const [error, setError] = useState<string | null>(null);

  const allDone = done >= totalItems;

  async function run() {
    setRunning(true);
    setError(null);
    try {
      for (;;) {
        const res = await fetch(
          `/api/admin/batch-appraise?batchId=${batchId}&take=8`,
          { method: 'POST' },
        );
        if (!res.ok) {
          setError(`Processing failed (HTTP ${res.status})`);
          break;
        }
        const body = await res.json();
        setDone(body.processedItems ?? done);
        if ((body.remaining ?? 0) <= 0) break;
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={run} disabled={running}>
        {running
          ? `Appraising… ${done}/${totalItems}`
          : allDone
            ? 'Re-run appraisals'
            : `Run appraisals (${totalItems - done} left)`}
      </Button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
