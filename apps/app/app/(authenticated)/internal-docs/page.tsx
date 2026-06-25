import { auth } from '@repo/auth/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';
import { INTERNAL_DOCS } from './docs';

export const metadata: Metadata = {
  title: 'Internal docs — Bellwood Lane',
  description: 'Internal strategy, plans and research.',
};

export default async function InternalDocsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <>
      <Header pages={[]} page="Internal docs" />
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-6">
        <div>
          <h1 className="font-semibold text-2xl">Internal docs</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Strategy, plans and research — kept in the app so the team can read
            and reference them.
          </p>
        </div>

        <ul className="flex flex-col gap-3">
          {INTERNAL_DOCS.map((doc) => (
            <li key={doc.slug}>
              <Link
                href={`/internal-docs/${doc.slug}`}
                className="block rounded-xl border bg-card p-4 transition hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full border bg-slate-50 px-2 py-0.5 font-medium text-[11px] text-slate-600">
                    {doc.category}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    Updated {doc.updated}
                  </span>
                </div>
                <h2 className="mt-2 font-semibold">{doc.title}</h2>
                <p className="mt-1 text-muted-foreground text-sm">
                  {doc.summary}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
