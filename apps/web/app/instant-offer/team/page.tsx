import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'The team · Bellwoods Lane',
};

export default function TeamPage() {
  return (
    <>
      <header className="border-stone-200/60 border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/instant-offer"
            className="font-semibold font-serif text-xl tracking-tight"
          >
            BELLWOODS
            <span className="mx-2 inline-block h-px w-8 bg-wax align-middle" />
            <span className="font-normal text-sm text-stone-500 tracking-widest">
              LANE
            </span>
          </Link>
          <Link
            href="/instant-offer#chat"
            className="rounded-md bg-leaf px-5 py-2 text-sm text-white transition hover:bg-leaf-dark"
          >
            Get an offer
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <p className="mb-3 text-leaf text-xs uppercase tracking-widest">
          The team
        </p>
        <h1 className="font-semibold font-serif text-5xl leading-tight">
          Real people. Named. Accountable.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-stone-600">
          You can pick up the phone and speak to the person who made your offer.
          Every deal has a named owner from first contact to completion.
        </p>

        <div className="mt-16 grid grid-cols-1 gap-8">
          {[
            {
              name: 'Anthony',
              role: 'Founder',
              bio: 'Runs the Bellwoods Lane deal engine end-to-end — sourcing, appraisals, offers, completions, and capital. Former [role] with experience across [sector].',
              linkedin: '#',
            },
          ].map((p) => (
            <div
              key={p.name}
              className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm"
            >
              <div className="aspect-square w-full rounded-2xl bg-gradient-to-br from-stone-100 to-soft" />
              <h3 className="mt-6 font-semibold font-serif text-2xl">
                {p.name}
              </h3>
              <p className="text-leaf text-sm">{p.role}</p>
              <p className="mt-4 text-stone-600">{p.bio}</p>
              <a
                href={p.linkedin}
                className="mt-4 inline-block font-medium text-leaf text-sm underline underline-offset-4 hover:text-leaf-dark"
              >
                LinkedIn →
              </a>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
