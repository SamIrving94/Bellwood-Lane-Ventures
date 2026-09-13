'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { uploadBatch } from '../actions/upload';

/**
 * Keep in lockstep with `uploadBatch`'s server-side check AND with
 * `experimental.serverActions.bodySizeLimit` in apps/app/next.config.ts.
 * If the Next config limit is ever lower than this, oversized files fail
 * with the generic error page instead of a message the founder can act on.
 */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Signatures of a request body rejected before the action ever ran. */
const TOO_LARGE_RE = /body exceeded|413|payload too large/i;

export function UploadForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      setError('Pick an .xls or .xlsx file first.');
      return;
    }
    // Check the size here as well as on the server. The server action never
    // sees an over-sized upload — Next rejects the request body first — so
    // without this the founder waits for a full upload just to be told no.
    if (file.size > MAX_UPLOAD_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      setError(
        `That file is ${mb}MB and the limit is 10MB. Delete unused sheets or save as .xlsx to shrink it.`
      );
      return;
    }
    startTransition(async () => {
      try {
        const result = await uploadBatch(formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        // Straight to the review page, where appraisals are run.
        router.push(`/batch/${result.batchId}`);
      } catch (e) {
        // A throw here means the action never returned — a rejected request
        // body, a network drop, or a server crash. Without this catch the
        // rejection escapes the transition and blows up the whole page with
        // "something went wrong", which tells the founder nothing.
        const message = (e as Error)?.message ?? '';
        setError(
          TOO_LARGE_RE.test(message)
            ? 'The server rejected the file for being too large. Try saving it as .xlsx, or remove unused sheets.'
            : `Upload failed: ${message || 'the server did not respond'}. Try again — if it keeps happening, send the file to an engineer.`
        );
      }
    });
  }

  return (
    <form action={onSubmit} className="rounded-lg border bg-card p-4">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Upload pipeline spreadsheet
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        .xls or .xlsx with an <strong>Opportunity Name</strong> column. We read
        every row, run the AVM, and rank by discount to market.
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="file"
          name="file"
          accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
        />
        <Button type="submit" disabled={isPending} className="shrink-0">
          {isPending ? 'Reading…' : 'Upload & parse'}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </form>
  );
}
