import { Button, Eyebrow, LogoLockup, Seal } from '@/components/brand';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Kept’s story · Kept',
  description:
    'Why Kept exists: software does the maths, a person makes the promise. Who we are, how we work, and the promise we ask to be held to.',
};

/**
 * /about — "Kept's story". The homepage's founder section was removed on
 * editorial advice and replaced with a link here (Aug 2026 handoff), so this
 * page carries what that section carried: Anthony's photograph, the
 * "software does the maths, a person makes the promise" argument, and the
 * people-business framing. Copy is assembled from the signed-off homepage
 * strings; it makes no customer-outcome claims because there are none to
 * make yet.
 */
export default function AboutPage() {
  return (
    <>
      {/* ————— NAV ————— */}
      <header className="border-hair border-b bg-white">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-6 px-5 py-3.5 md:px-10">
          <LogoLockup href="/sell" animate />
          <div className="flex items-center gap-6">
            <Link
              href="/instant-offer/methodology"
              className="hidden text-[13.5px] text-stone-600 transition-colors hover:text-brand-deep sm:block"
            >
              How we price
            </Link>
            <Button href="/sell#offer" className="px-5 py-2 text-sm">
              Get my offer
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-5 pb-24 md:px-10">
        {/* ————— WHY KEPT EXISTS ————— */}
        <section className="max-w-3xl pt-9 md:pt-[52px]">
          <Eyebrow>kept&rsquo;s story</Eyebrow>
          <h1
            className="mt-5 text-balance font-bold font-serif text-forest leading-[1.04] tracking-[-0.03em]"
            style={{ fontSize: 'clamp(34px, 4.6vw, 56px)' }}
          >
            We don&rsquo;t just care about homes.
            <br />
            <span className="font-normal text-leaf">
              We care about people<span className="text-wax">.</span>
            </span>
          </h1>
          <p className="mt-[22px] max-w-[58ch] text-[#44403c] text-[17px] leading-[1.75]">
            We know there&rsquo;s more to a home than bricks and mortar. Every
            property comes with lives lived, memories made and reasons for
            moving on. That&rsquo;s why we built Kept: because we don&rsquo;t
            just care about homes, we care about people.
          </p>
          <p className="mt-4 max-w-[58ch] text-[#44403c] text-[17px] leading-[1.75]">
            When selling on the open market isn&rsquo;t right for you,
            we&rsquo;re here to make things simpler. We&rsquo;ll treat you with
            honesty and respect, give you a clear cash offer in writing and
            never reduce it at the last minute. That&rsquo;s our promise: a
            promise made is a promise Kept.
          </p>
        </section>

        {/* ————— A PERSON, NOT A PIPELINE ————— */}
        <section className="grid grid-cols-1 items-center gap-10 pt-[72px] md:grid-cols-[260px_1fr] md:gap-14">
          <figure className="mx-auto w-[220px] md:w-full">
            <div className="overflow-hidden rounded-[2px] border border-hair shadow-[0_24px_48px_-28px_rgba(36,28,26,0.45)]">
              <Image
                src="/team/anthony-taylor.jpg"
                alt="Anthony Taylor of Kept"
                width={900}
                height={1349}
                className="h-auto w-full"
              />
            </div>
            <figcaption className="mt-3 text-center font-serif text-[13px] text-stone-500 md:text-left">
              Anthony Taylor &middot; Kept
            </figcaption>
          </figure>
          <div>
            <Eyebrow tone="muted">a person, not a pipeline</Eyebrow>
            <h2
              className="mt-4 font-bold font-serif leading-[1.1] tracking-[-0.02em]"
              style={{ fontSize: 'clamp(28px, 3.4vw, 42px)' }}
            >
              Software does the maths.{' '}
              <span className="font-normal text-leaf">
                A person makes the promise.
              </span>
            </h2>
            <p className="mt-6 max-w-xl text-[15px] text-stone-600 leading-[1.7]">
              Comparable sales, title records, market trend: the desk research
              is automated, which is why it&rsquo;s fast. The judgment
              isn&rsquo;t. No figure reaches you until one of us has read it,
              checked it and put our name to it. Write to us and it&rsquo;s
              Anthony who reads it. Same-day response, Monday to Friday.
            </p>
            <p className="mt-4 max-w-xl text-[15px] text-stone-600 leading-[1.7]">
              We view every property before we price it, the price we send is
              the price we complete at, and how we get to that figure is{' '}
              <Link
                href="/instant-offer/methodology"
                className="underline decoration-leaf/50 underline-offset-4 hover:decoration-leaf"
              >
                published in full
              </Link>
              . If the open market is the better route for you, we&rsquo;ll say
              so. We&rsquo;d rather you sold well than sold to us.
            </p>
          </div>
        </section>

        {/* ————— CLOSING CTA ————— */}
        <section className="mt-[72px] grid grid-cols-1 items-end gap-8 border-hair border-t pt-[72px] lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          <h2
            className="m-0 font-bold font-serif leading-[1] tracking-[-0.025em]"
            style={{ fontSize: 'clamp(34px, 5vw, 58px)' }}
          >
            A real offer{' '}
            <span className="font-normal text-leaf">in writing.</span>
          </h2>
          <div>
            <Button href="/sell#offer">Get my offer</Button>
            <p className="mt-[18px] text-[14px] text-stone-600 leading-[1.6]">
              Same-day response, Monday to Friday. No figure until we&rsquo;ve
              stood in the house.
            </p>
          </div>
        </section>
      </main>

      {/* ————— FOOTER ————— */}
      <footer className="border-hair border-t bg-white px-5 py-9 md:px-10">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Seal className="h-14 w-14" />
            <p className="m-0 font-serif text-[13px] text-stone-500">
              Kept &middot; Direct-to-vendor property buyers &middot; UK
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-x-[22px] gap-y-2 text-[13.5px] text-stone-600">
            <Link href="/sell" className="hover:text-brand-deep">
              For sellers
            </Link>
            <Link
              href="/instant-offer/methodology"
              className="hover:text-brand-deep"
            >
              Methodology
            </Link>
            <Link href="/agents" className="hover:text-brand-deep">
              For agents
            </Link>
            <Link
              href="/legal/fca-disclosure"
              className="hover:text-brand-deep"
            >
              Regulatory
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
