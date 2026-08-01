'use client';

import { useState, useTransition } from 'react';
import { processUploadedPdf } from '../actions/process';
import { ExtractDetail } from './extract-detail';

type RecentDeal = {
  id: string;
  address: string;
  postcode: string | null;
  status: string;
};

type Props = {
  recentDeals: RecentDeal[];
};

export function DocumentUploadForm({ recentDeals }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [extractId, setExtractId] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('');

  function onSubmit(formData: FormData) {
    setError(null);
    setExtractId(null);

    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      setError('Pick a PDF first.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('PDF is larger than 25 MB — split it first.');
      return;
    }

    setFilename(file.name);

    startTransition(async () => {
      const result = await processUploadedPdf(formData);
      if ('error' in result) {
        setError(result.error);
      } else {
        setExtractId(result.id);
      }
    });
  }

  return (
    <div className="space-y-6">
      <form action={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            PDF file
          </label>
          <input
            type="file"
            name="file"
            accept="application/pdf"
            required
            disabled={pending}
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm hover:file:bg-slate-200"
          />
          <p className="mt-1 text-xs text-slate-500">
            Up to 25 MB. Probate grants work end-to-end today; lease + contract
            extractors land soon — meanwhile they still parse, just with
            looser field coverage.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Document type
            </label>
            <select
              name="docType"
              disabled={pending}
              defaultValue="probate"
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="probate">Probate grant</option>
              <option value="lease">Lease pack</option>
              <option value="contract">Contract / redline</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Link to deal (optional)
            </label>
            <select
              name="dealId"
              disabled={pending || recentDeals.length === 0}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="">(no deal — keep standalone)</option>
              {recentDeals.map((deal) => (
                <option key={deal.id} value={deal.id}>
                  {deal.address}
                  {deal.postcode ? `, ${deal.postcode}` : ''} ·{' '}
                  {deal.status.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-400"
          >
            {pending
              ? 'Reading the PDF — ~20 seconds…'
              : 'Run the extract'}
          </button>
          {filename && !pending && (
            <span className="text-xs text-slate-500">last: {filename}</span>
          )}
        </div>

        {error && (
          <p className="text-sm text-rose-600">{error}</p>
        )}
      </form>

      {extractId && <ExtractDetail extractId={extractId} />}
    </div>
  );
}
