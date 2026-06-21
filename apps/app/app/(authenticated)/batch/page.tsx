import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';
import { UploadForm } from './components/upload-form';

export const metadata: Metadata = {
  title: 'Batch Appraisals — Bellwoods Lane',
  description: 'Upload a pipeline spreadsheet and rank every property by discount to market.',
};

export const dynamic = 'force-dynamic';

const BatchPage = async () => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const batches = await database.propertyBatch.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: {
      id: true,
      createdAt: true,
      label: true,
      status: true,
      totalItems: true,
      processedItems: true,
    },
  });

  return (
    <>
      <Header pages={[]} page="Batch Appraisals" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-bold">Batch Appraisals</h1>
          <p className="text-sm text-muted-foreground">
            Upload the bi-weekly pipeline list. We value every property and rank
            by discount to market — biggest discount first.
          </p>
        </div>

        <UploadForm />

        <div className="space-y-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Previous uploads
          </h2>
          {batches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No batches yet. Upload your first spreadsheet above.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Uploaded</th>
                    <th className="px-3 py-2">Label</th>
                    <th className="px-3 py-2">Properties</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id} className="border-t">
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Date(b.createdAt).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-3 py-2 font-medium">{b.label}</td>
                      <td className="px-3 py-2">
                        {b.processedItems}/{b.totalItems}
                      </td>
                      <td className="px-3 py-2 capitalize">{b.status}</td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/batch/${b.id}`}
                          className="text-primary hover:underline"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default BatchPage;
