'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { uploadBatch } from '../actions/upload';

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
    startTransition(async () => {
      const result = await uploadBatch(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Straight to the review page, where appraisals are run.
      router.push(`/batch/${result.batchId}`);
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
