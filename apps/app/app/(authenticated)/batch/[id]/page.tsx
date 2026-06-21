import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Header } from '../../components/header';
import { RunButton } from './run-button';

export const metadata: Metadata = {
  title: 'Batch review — Bellwoods Lane',
};

export const dynamic = 'force-dynamic';

function formatGBP(pence?: number | null): string {
  if (pence == null) return '—';
  return `£${Math.round(pence / 100).toLocaleString('en-GB')}`;
}

const CONF_STYLE: Record<string, string> = {
  high: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400',
  medium: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400',
  low: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400',
};

const BatchReviewPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const { id } = await params;

  const batch = await database.propertyBatch.findUnique({
    where: { id },
    select: {
      id: true,
      label: true,
      createdAt: true,
      status: true,
      totalItems: true,
      processedItems: true,
      priorBatchId: true,
    },
  });
  if (!batch) notFound();

  const items = await database.propertyBatchItem.findMany({
    where: { batchId: id },
    orderBy: { rowIndex: 'asc' },
  });

  // "Gone out" — properties in the prior batch that are absent from this one.
  let goneOut: { address: string; postcode: string | null }[] = [];
  if (batch.priorBatchId) {
    const currentKeys = new Set(items.map((i) => i.dedupeKey));
    const prior = await database.propertyBatchItem.findMany({
      where: { batchId: batch.priorBatchId },
      select: { dedupeKey: true, address: true, postcode: true },
    });
    goneOut = prior
      .filter((p) => !currentKeys.has(p.dedupeKey))
      .map((p) => ({ address: p.address, postcode: p.postcode }));
  }

  // Rank: priced rows by discount desc; unpriced/flagged rows held separately.
  const priced = items
    .filter((i) => i.discountPercent != null)
    .sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0));
  const flagged = items.filter(
    (i) => i.discountPercent == null && i.status === 'done',
  );
  const unprocessed = items.filter(
    (i) => i.status === 'pending' || i.status === 'error' || i.status === 'skipped',
  );

  const newCount = items.filter((i) => i.changeStatus === 'new').length;
  const carriedCount = items.filter((i) => i.changeStatus === 'carried').length;
  const allDone = batch.processedItems >= batch.totalItems;

  return (
    <>
      <Header
        pages={[{ title: 'Batch Appraisals', url: '/batch' }]}
        page={batch.label}
      />
      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Header + actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold">{batch.label}</h1>
            <p className="text-sm text-muted-foreground">
              {batch.totalItems} properties · uploaded{' '}
              {new Date(batch.createdAt).toLocaleDateString('en-GB')} ·{' '}
              <span className="capitalize">{batch.status}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <RunButton
              batchId={batch.id}
              totalItems={batch.totalItems}
              processedItems={batch.processedItems}
            />
            {allDone && (
              <a
                href={`/api/admin/batch-export/${batch.id}`}
                className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Download Excel
              </a>
            )}
          </div>
        </div>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-muted px-3 py-1">
            Appraised <strong>{batch.processedItems}/{batch.totalItems}</strong>
          </span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
            New <strong>{newCount}</strong>
          </span>
          <span className="rounded-full bg-muted px-3 py-1">
            Carried over <strong>{carriedCount}</strong>
          </span>
          {goneOut.length > 0 && (
            <span className="rounded-full bg-red-100 px-3 py-1 text-red-800 dark:bg-red-950 dark:text-red-400">
              Gone out <strong>{goneOut.length}</strong>
            </span>
          )}
          {flagged.length > 0 && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800 dark:bg-amber-950 dark:text-amber-400">
              No benchmark <strong>{flagged.length}</strong>
            </span>
          )}
        </div>

        {!allDone && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-800 dark:bg-blue-950">
            Click <strong>Run appraisals</strong> to value every property. It
            processes in batches and can take a minute or two for a full sheet.
          </div>
        )}

        {/* Ranked table */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Ranked by discount to market
          </h2>
          {priced.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No appraised properties yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Property</th>
                    <th className="px-3 py-2">Type · Beds</th>
                    <th className="px-3 py-2">Condition</th>
                    <th className="px-3 py-2 text-right">Est. market value</th>
                    <th className="px-3 py-2 text-right">Benchmark</th>
                    <th className="px-3 py-2 text-right">Discount</th>
                    <th className="px-3 py-2">Conf.</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {priced.map((i, idx) => {
                    const benchmark =
                      i.benchmarkUsed === 'sign_off'
                        ? i.signOffPricePence
                        : i.acceptableTradeOfferPence;
                    const moved =
                      i.priorTradeOfferPence != null &&
                      i.acceptableTradeOfferPence != null &&
                      i.priorTradeOfferPence !== i.acceptableTradeOfferPence;
                    return (
                      <tr key={i.id} className="border-t align-top">
                        <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{i.address}</div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {i.postcode}
                            {i.changeStatus === 'new' && (
                              <span className="rounded bg-emerald-100 px-1 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                                new
                              </span>
                            )}
                            {moved && (
                              <span className="rounded bg-amber-100 px-1 text-amber-800 dark:bg-amber-950 dark:text-amber-400">
                                price moved
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 capitalize text-muted-foreground">
                          {i.mappedType ?? i.propertyType}
                          {i.bedrooms != null ? ` · ${i.bedrooms} bed` : ''}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {i.condition ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {formatGBP(i.estimatedMarketValuePence)}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          {formatGBP(benchmark)}
                          {i.benchmarkUsed === 'sign_off' && (
                            <span className="ml-1 text-[10px] uppercase">(sign-off)</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-bold">
                          {i.discountPercent != null
                            ? `${i.discountPercent.toFixed(1)}%`
                            : '—'}
                        </td>
                        <td className="px-3 py-2">
                          {i.avmConfidence && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs ${CONF_STYLE[i.avmConfidence] ?? 'bg-muted'}`}
                            >
                              {i.avmConfidence}
                              {i.comparableCount != null ? ` · ${i.comparableCount}` : ''}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Link
                            href={`/research?q=${encodeURIComponent(
                              `Comparable sold prices near ${i.postcode} for ${i.mappedType ?? ''}`,
                            )}`}
                            className="text-xs text-primary hover:underline"
                          >
                            Research
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Flagged: appraised but no underwriting benchmark to compare against */}
        {flagged.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
              No benchmark — discount not calculated
            </h2>
            <p className="text-xs text-muted-foreground">
              These rows have no Acceptable Trade Offer (and no Sign-off price).
              Add a figure in the sheet and re-upload to rank them.
            </p>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <tbody>
                  {flagged.map((i) => (
                    <tr key={i.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{i.address}</td>
                      <td className="px-3 py-2 text-muted-foreground">{i.postcode}</td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {formatGBP(i.estimatedMarketValuePence)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Could not appraise */}
        {unprocessed.filter((i) => i.status !== 'pending').length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Could not appraise
            </h2>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <tbody>
                  {unprocessed
                    .filter((i) => i.status !== 'pending')
                    .map((i) => (
                      <tr key={i.id} className="border-t">
                        <td className="px-3 py-2 font-medium">{i.address}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {i.error ?? i.status}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Gone out vs last upload */}
        {goneOut.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Gone out since last upload
            </h2>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <tbody>
                  {goneOut.map((g) => (
                    <tr key={`${g.address}-${g.postcode}`} className="border-t">
                      <td className="px-3 py-2">{g.address}</td>
                      <td className="px-3 py-2 text-muted-foreground">{g.postcode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default BatchReviewPage;
