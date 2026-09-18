import { Button, Eyebrow } from '@/components/brand';
import { SiteHeader } from '@/components/site-header';
import { database } from '@repo/database';
import { brand } from '@repo/brand';
import type { Metadata } from 'next';
import Link from 'next/link';

// Published guides change when the founder clicks Publish, not on deploy.
// Five minutes is the same window the situation pages use.
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Guides for sellers, executors and agents · Kept',
  description:
    'Plain answers to the questions people ask before they sell: probate, a broken chain, a property that needs work, a date that cannot move.',
  alternates: { canonical: `${brand.url}/guides` },
};

const SEGMENT_LABEL: Record<string, string> = {
  probate: 'Probate',
  chain_break: 'Broken chain',
  separation: 'Separation',
  relocation: 'Relocation',
  distress: 'Financial difficulty',
  problem_property: 'Problem property',
  agent: 'For agents',
};

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * /guides — the index of published guides. One evergreen question per
 * guide; the list is short on purpose and grows by one a week at most.
 */
export default async function GuidesIndexPage() {
  const guides = await database.guidePost
    .findMany({
      where: { status: 'published' },
      orderBy: { publishedAt: 'desc' },
      select: {
        slug: true,
        title: true,
        metaDescription: true,
        segment: true,
        publishedAt: true,
      },
    })
    .catch(() => []);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-5 pb-24 md:px-10">
        <section className="max-w-3xl pt-9 md:pt-[52px]">
          <Eyebrow>guides</Eyebrow>
          <h1
            className="mt-5 text-balance font-bold font-serif text-forest leading-[1.04] tracking-[-0.03em]"
            style={{ fontSize: 'clamp(34px, 4.6vw, 56px)' }}
          >
            The questions people ask before they sell.
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] text-stone-600 leading-relaxed">
            Plain answers, written to be read on a phone at eleven at night.
            Where a cash sale is not the right call, we say so.
          </p>
        </section>

        {guides.length === 0 ? (
          <p className="mt-12 text-stone-500">
            The first guide is on its way. In the meantime, the{' '}
            <Link href="/probate" className="underline">
              probate guide
            </Link>{' '}
            answers the most common one.
          </p>
        ) : (
          <ul className="mt-12 divide-y divide-hair border-hair border-y">
            {guides.map((g) => (
              <li key={g.slug} className="py-6">
                <Link href={`/guides/${g.slug}`} className="group block">
                  <p className="font-mono text-[11px] text-stone-500 uppercase tracking-[0.14em]">
                    {SEGMENT_LABEL[g.segment] ?? g.segment}
                    {g.publishedAt ? ` · ${dateFmt.format(g.publishedAt)}` : ''}
                  </p>
                  <h2 className="mt-2 font-serif text-[24px] text-forest leading-snug group-hover:text-leaf">
                    {g.title}
                  </h2>
                  <p className="mt-2 max-w-2xl text-[15.5px] text-stone-600">
                    {g.metaDescription}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <section className="mt-16 max-w-2xl">
          <p className="text-[15.5px] text-stone-600">
            None of these fit? Tell us your situation and a person will reply
            the same working day.
          </p>
          <Button href="/sell#offer" className="mt-4 px-5 py-2 text-sm">
            Send us your details
          </Button>
        </section>
      </main>
    </>
  );
}
