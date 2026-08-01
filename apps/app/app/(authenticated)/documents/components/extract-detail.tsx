'use client';

import { useEffect, useState } from 'react';
import { fetchExtract } from '../actions/fetch';

type Citation = { pageIndex: number; excerpt: string };
type CitedValue<T> = { value: T; citation: Citation };
type CitedExecutor = { name: string; address?: string; citation: Citation };
type CitedProperty = { address: string; postcode?: string; citation: Citation };

type ProbateExtract = {
  deceasedName: CitedValue<string> | null;
  dateOfDeath: CitedValue<string> | null;
  dateOfGrant: CitedValue<string> | null;
  grantType: 'probate' | 'letters_of_administration' | 'unknown';
  executors: CitedExecutor[];
  solicitorFirm: CitedValue<string> | null;
  totalEstateGrossPence: CitedValue<number> | null;
  totalEstateNetPence: CitedValue<number> | null;
  propertyAddresses: CitedProperty[];
  ihtPaidIndicator: CitedValue<boolean> | null;
  confidence: number;
  errorReason?: string;
};

function formatPence(value: number | null | undefined): string {
  if (typeof value !== 'number') return '—';
  return `£${Math.round(value / 100).toLocaleString('en-GB')}`;
}

function CitationChip({ citation }: { citation: Citation }) {
  return (
    <details className="mt-1 inline-block">
      <summary className="cursor-pointer text-xs text-slate-500 underline-offset-2 hover:underline">
        Source · page {citation.pageIndex + 1}
      </summary>
      <blockquote className="mt-1 max-w-prose border-l-2 border-slate-300 bg-slate-50 p-2 text-xs italic text-slate-700">
        “{citation.excerpt}”
      </blockquote>
    </details>
  );
}

function Field({
  label,
  value,
  citation,
}: {
  label: string;
  value: string | number | null | undefined;
  citation?: Citation;
}) {
  return (
    <div className="rounded border border-slate-200 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm text-slate-900">
        {value !== null && value !== undefined && value !== '' ? value : '—'}
      </div>
      {citation && <CitationChip citation={citation} />}
    </div>
  );
}

export function ExtractDetail({ extractId }: { extractId: string }) {
  const [extract, setExtract] = useState<ProbateExtract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchExtract(extractId)
      .then((result) => {
        if (cancelled) return;
        if ('error' in result) {
          setError(result.error);
        } else {
          setExtract(result.extract as ProbateExtract);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [extractId]);

  if (loading) {
    return (
      <div className="rounded border border-slate-200 p-4 text-sm text-slate-500">
        Loading the extract…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  if (!extract) return null;

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">Extracted facts</h3>
        <div className="text-xs text-slate-500">
          Confidence: {Math.round(extract.confidence * 100)}%
          {extract.errorReason && (
            <span className="ml-2 text-rose-700">· {extract.errorReason}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field
          label="Deceased name"
          value={extract.deceasedName?.value}
          citation={extract.deceasedName?.citation}
        />
        <Field label="Grant type" value={extract.grantType.replace(/_/g, ' ')} />
        <Field
          label="Date of death"
          value={extract.dateOfDeath?.value}
          citation={extract.dateOfDeath?.citation}
        />
        <Field
          label="Date of grant"
          value={extract.dateOfGrant?.value}
          citation={extract.dateOfGrant?.citation}
        />
        <Field
          label="Solicitor firm"
          value={extract.solicitorFirm?.value}
          citation={extract.solicitorFirm?.citation}
        />
        <Field
          label="IHT paid"
          value={
            extract.ihtPaidIndicator
              ? extract.ihtPaidIndicator.value
                ? 'Yes'
                : 'No'
              : null
          }
          citation={extract.ihtPaidIndicator?.citation}
        />
        <Field
          label="Estate gross"
          value={formatPence(extract.totalEstateGrossPence?.value)}
          citation={extract.totalEstateGrossPence?.citation}
        />
        <Field
          label="Estate net"
          value={formatPence(extract.totalEstateNetPence?.value)}
          citation={extract.totalEstateNetPence?.citation}
        />
      </div>

      <div>
        <h4 className="mb-2 text-sm font-medium text-slate-700">
          Executors ({extract.executors.length})
        </h4>
        {extract.executors.length === 0 ? (
          <p className="text-xs text-slate-500">None extracted.</p>
        ) : (
          <ul className="space-y-2">
            {extract.executors.map((e, i) => (
              <li key={i} className="rounded border border-slate-200 p-3">
                <div className="text-sm font-medium">{e.name}</div>
                {e.address && (
                  <div className="text-xs text-slate-500">{e.address}</div>
                )}
                <CitationChip citation={e.citation} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-sm font-medium text-slate-700">
          Property addresses ({extract.propertyAddresses.length})
        </h4>
        {extract.propertyAddresses.length === 0 ? (
          <p className="text-xs text-slate-500">None extracted.</p>
        ) : (
          <ul className="space-y-2">
            {extract.propertyAddresses.map((p, i) => (
              <li key={i} className="rounded border border-slate-200 p-3">
                <div className="text-sm font-medium">{p.address}</div>
                {p.postcode && (
                  <div className="text-xs text-slate-500">{p.postcode}</div>
                )}
                <CitationChip citation={p.citation} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
