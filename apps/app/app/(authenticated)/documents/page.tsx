import { database } from '@repo/database';
import Link from 'next/link';
import { DocumentUploadForm } from './components/upload-form';
import { ExtractList } from './components/extract-list';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * /documents — founder-facing document review.
 *
 * v1 scope:
 *   - Upload PDF (probate grant for now; lease + contract types follow)
 *   - See the structured extract with citations back to the source
 *   - Recent extracts persisted to DocumentExtract; click into history
 *   - Optional `dealId` to link the doc against an active case
 *
 * The pipeline behind this is @repo/document-pipeline:
 *   PDF → Mistral OCR → Anthropic Files + Citations → ProbateExtract
 *
 * No PII shown unredacted in the listing (we render the deceased name +
 * property address since those are inherent to the document; deeper
 * personal data lives inside the extract record only).
 */

export default async function DocumentsPage() {
  const recent = await database.documentExtract.findMany({
    orderBy: { createdAt: 'desc' },
    take: 25,
    select: {
      id: true,
      createdAt: true,
      filename: true,
      docType: true,
      confidence: true,
      dealId: true,
      deceasedName: true,
      primaryAddress: true,
      errorReason: true,
    },
  });

  const recentDeals = await database.deal
    .findMany({
      where: { status: { notIn: ['completed', 'rejected', 'withdrawn'] } },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      select: { id: true, address: true, postcode: true, status: true },
    })
    .catch(() => []);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Documents</h1>
        <p className="text-sm text-slate-500">
          Upload a probate grant, lease pack, or contract. Mistral OCR reads it,
          Claude extracts the structured facts with citations back to the source
          page. Optionally link to an active deal so it lives with the case.
        </p>
      </header>

      <section className="rounded-lg border border-slate-200 p-6">
        <h2 className="mb-4 text-lg font-medium">Upload a document</h2>
        <DocumentUploadForm recentDeals={recentDeals} />
      </section>

      <section className="space-y-2">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-medium">Recent extracts</h2>
          <p className="text-xs text-slate-500">
            Most recent {recent.length} of all time
          </p>
        </div>
        <ExtractList items={recent} />
      </section>

      <footer className="border-t border-slate-200 pt-4 text-xs text-slate-500">
        Pipeline: <code>@repo/document-pipeline</code> →{' '}
        <code>/agents/scout/process-probate-pdf</code>. Source records:{' '}
        <code>DocumentExtract</code>. PDF type taxonomy expands as new extractors
        ship — see{' '}
        <Link href="/guide" className="underline">
          guide
        </Link>{' '}
        for the latest list.
      </footer>
    </div>
  );
}
