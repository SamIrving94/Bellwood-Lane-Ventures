import { SiteHeader } from '@/components/site-header';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'The team · Kept',
  // One card is honest but thin — unlisted until the page grows into the
  // "named and accountable" promise properly.
  robots: { index: false },
};

export default function TeamPage() {
  return (
    <>
      <SiteHeader />

      <section className="mx-auto max-w-5xl px-6 py-20">
        <p className="mb-3 text-leaf text-xs uppercase tracking-widest">
          The team
        </p>
        <h1 className="font-semibold font-serif text-5xl leading-tight">
          Real people. Named. Accountable.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-stone-600">
          Every deal has a named owner from first contact to completion, and
          nothing is sent to a seller until a person has read it and put
          their name to it.
        </p>

        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
            <div className="overflow-hidden rounded-2xl">
              <Image
                src="/team/anthony-taylor.jpg"
                alt="Anthony Taylor of Kept"
                width={900}
                height={1349}
                className="h-auto w-full"
              />
            </div>
            <h3 className="mt-6 font-semibold font-serif text-2xl">
              Anthony Taylor
            </h3>
            <p className="text-leaf text-sm">Founder</p>
            <p className="mt-4 text-stone-600">
              Runs the Kept deal engine end-to-end — sourcing, appraisals,
              offers, completions, and capital. Reads every enquiry that
              comes in.
            </p>
          </div>
        </div>

        <p className="mt-12 text-[15px] text-stone-600">
          Want to talk before you share anything?{' '}
          <Link
            href="/sell#offer"
            className="text-leaf underline decoration-leaf/50 underline-offset-4 hover:decoration-leaf"
          >
            Start with the address
          </Link>{' '}
          and Anthony will come back to you the same day, Monday to Friday.
        </p>
      </section>
    </>
  );
}
