import { auth } from '@repo/auth/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Header } from '../../components/header';
import { DocBody } from '../doc-body';
import { INTERNAL_DOCS, getDoc } from '../docs';

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return INTERNAL_DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDoc(slug);
  return { title: doc ? `${doc.title} — Bellwood Lane` : 'Internal docs' };
}

export default async function InternalDocPage({ params }: Params) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();

  return (
    <>
      <Header pages={[]} page={doc.title} />
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-6">
        <Link
          href="/internal-docs"
          className="text-muted-foreground text-sm hover:underline"
        >
          ← All docs
        </Link>
        <div className="rounded-2xl border bg-card p-6">
          <DocBody body={doc.body} />
        </div>
      </div>
    </>
  );
}
