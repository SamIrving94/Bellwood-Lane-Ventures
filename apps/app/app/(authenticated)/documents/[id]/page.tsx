import { database } from '@repo/database';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExtractDetail } from '../components/extract-detail';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const row = await database.documentExtract.findUnique({
    where: { id },
    select: {
      id: true,
      filename: true,
      docType: true,
      dealId: true,
      uploadedBy: true,
      createdAt: true,
      confidence: true,
      errorReason: true,
    },
  });

  if (!row) notFound();

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="space-y-2">
        <Link
          href="/documents"
          className="text-sm text-slate-500 underline-offset-2 hover:underline"
        >
          ← All documents
        </Link>
        <h1 className="text-2xl font-semibold">{row.filename}</h1>
        <div className="flex flex-wrap gap-3 text-sm text-slate-500">
          <span>
            Uploaded {row.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
          </span>
          <span>·</span>
          <span>Type: {row.docType}</span>
          <span>·</span>
          <span>Confidence: {Math.round(row.confidence * 100)}%</span>
          {row.dealId && (
            <>
              <span>·</span>
              <Link
                href={`/deals/${row.dealId}`}
                className="text-slate-700 underline-offset-2 hover:underline"
              >
                View linked deal
              </Link>
            </>
          )}
          {row.errorReason && (
            <span className="text-rose-700">· {row.errorReason}</span>
          )}
        </div>
      </header>

      <ExtractDetail extractId={row.id} />
    </div>
  );
}
