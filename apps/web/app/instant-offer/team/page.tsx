import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The team · Bellwood Ventures',
};

export default function TeamPage() {
  return (
    <>
      <header className="border-b border-slate-200/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/instant-offer"
            className="font-serif text-xl font-semibold tracking-tight"
          >
            BELLWOOD
            <span className="mx-2 inline-block h-px w-8 bg-[#C6A664] align-middle" />
            <span className="text-sm font-normal tracking-widest text-slate-500">
              VENTURES
            </span>
          </Link>
          <Link
            href="/instant-offer#chat"
            className="rounded-full bg-[#0A2540] px-5 py-2 text-sm text-white transition hover:bg-[#13365c]"
          >
            Get an offer
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <p className="mb-3 text-xs uppercase tracking-widest text-[#C6A664]">
          The team
        </p>
        <h1 className="font-serif text-5xl font-semibold leading-tight">
          Real people. Named. Accountable.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-600">
          You can pick up the phone and speak to the person who made your
          offer. Every deal has a named owner from first contact to
          completion.
        </p>

        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2">
          {[
            {
              name: 'Samir Irving',
              role: 'Founder · Deal pipeline',
              bio: 'Runs the Bellwood deal engine — sourcing, appraisals, offers, completions. Former [role] with experience across [sector].',
              linkedin: '#',
            },
            {
              name: '[Co-founder]',
              role: 'Founder · Capital & operations',
              bio: 'Manages the investor syndicate, capital allocation, and operational excellence. Background in [sector].',
              linkedin: '#',
            },
          ].map((p) => (
            <div
              key={p.name}
              className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"
            >
              <div className="aspect-square w-full rounded-2xl bg-gradient-to-br from-slate-100 to-[#FAF6EA]" />
              <h3 className="mt-6 font-serif text-2xl font-semibold">
                {p.name}
              </h3>
              <p className="text-sm text-[#C6A664]">{p.role}</p>
              <p className="mt-4 text-slate-600">{p.bio}</p>
              <a
                href={p.linkedin}
                className="mt-4 inline-block text-sm font-medium text-[#0A2540] underline underline-offset-4 hover:text-[#C6A664]"
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
