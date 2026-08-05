import {
  Button,
  Eyebrow,
  LogoLockup,
  Seal,
  SectionNumber,
  Wordmark,
} from '@/components/brand';
import { ProofBand } from '@/components/proof-band';
import type { Metadata } from 'next';
import Link from 'next/link';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Probate, in plain English — a guide for executors — Kept',
  description:
    'What actually happens after someone dies, what an executor has to do, where the property fits, and when a cash sale is (and is not) the right call.',
};

/**
 * The probate guide — Farewill's "what happens next" pattern in Kept
 * register. Plain steps, no euphemism, no urgency. The guide is the point;
 * the pitch is one section, stated honestly, including who should not use
 * us. Nothing here is legal advice and the page says so.
 */

const STEPS: Array<{ n: string; t: string; d: string }> = [
  {
    n: '01',
    t: 'Register the death',
    d: 'Within 5 days in England and Wales. The register office gives you certified copies of the death certificate — order several; banks, insurers and the probate registry all want their own.',
  },
  {
    n: '02',
    t: 'Find the will, or apply the intestacy rules',
    d: 'The will names the executors — the people legally responsible for the estate. If there is no will, the intestacy rules decide who inherits and who can act (an "administrator" rather than an executor).',
  },
  {
    n: '03',
    t: 'Value the estate for inheritance tax',
    d: 'Everything the person owned, including the property, valued at the date of death. Inheritance tax is due by the end of the sixth month after the death — after that, HMRC charges interest on what is outstanding. This deadline is why timing matters more in probate sales than almost anywhere else.',
  },
  {
    n: '04',
    t: 'Apply for the grant of probate',
    d: 'The grant is the legal document that lets executors deal with the estate. You can apply online or by post. It typically takes months, not weeks, to arrive — and nothing can complete without it.',
  },
  {
    n: '05',
    t: 'Look after the property while you wait',
    d: 'An empty home still costs money: council tax, utilities, maintenance — and standard home insurance often lapses once a property is empty for more than 30 to 60 days, so tell the insurer. Meanwhile the estate cannot distribute anything.',
  },
  {
    n: '06',
    t: 'Sell or transfer the property',
    d: 'You can market the property and agree a sale before the grant arrives — you just cannot complete until it does. That gap is where most probate sales stall, and where the carrying costs quietly add up.',
  },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Can we agree a sale before the grant of probate?',
    a: 'Yes. You can market the property, receive offers and agree a price at any point. Completion — money and keys changing hands — has to wait for the grant. We routinely agree a price early and set completion for the grant date.',
  },
  {
    q: 'Do all the executors have to agree?',
    a: 'Yes. Every named executor who takes up the role must sign. If beneficiaries disagree about the route — speed versus best price — resolve that first. We would rather wait than sit inside a family dispute.',
  },
  {
    q: 'What does using Kept cost the estate?',
    a: 'Nothing. No fee to us at any point; as the buyer we pay our own legals, searches and survey. The figure in the offer is the figure the estate receives on completion.',
  },
  {
    q: 'Is a cash sale right for every estate?',
    a: 'No. If the estate has no tax deadline pressure, the property is in good condition, and the beneficiaries want every pound of value, a good local agent on the open market will very likely net more. We say this on every page: our figure is below open-market value by design, in exchange for speed and certainty.',
  },
];

export default function ProbatePage() {
  return (
    <>
      {/* ————— NAV ————— */}
      <header className="sticky top-0 z-40 border-hair/70 border-b bg-cream/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5 md:px-10">
          <LogoLockup href="/sell" />
          <nav className="hidden items-center gap-7 text-[14px] text-stone-600 md:flex">
            <Link href="/sell" className="transition-colors hover:text-brand-deep">
              For sellers
            </Link>
            <Link
              href="/instant-offer/methodology"
              className="transition-colors hover:text-brand-deep"
            >
              Methodology
            </Link>
            <Link
              href="/agents"
              className="transition-colors hover:text-brand-deep"
            >
              For agents
            </Link>
            <Button href="/sell#offer" className="px-5 py-2 text-sm">
              Get an offer
            </Button>
          </nav>
        </div>
      </header>

      {/* ————— HERO ————— */}
      <section className="border-hair/70 border-b px-6 pt-20 pb-16 md:px-12 md:pt-24 md:pb-20">
        <div className="mx-auto max-w-4xl">
          <Eyebrow>a guide for executors</Eyebrow>
          <h1
            className="mt-5 font-bold font-serif text-forest leading-[1.07]"
            style={{ fontSize: 'clamp(38px, 5vw, 58px)' }}
          >
            Probate,{' '}
            <span className="font-normal text-brand">
              in plain English.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-[17px] text-stone-600 leading-relaxed">
            Someone has died, there is a property, and it has somehow become
            your job. This page sets out what actually happens next — the
            deadlines that matter, the costs that quietly accumulate, and
            where a sale fits. No euphemisms, no rush.
          </p>
          <p className="mt-5 font-serif text-[13px] text-stone-500">
            This is general information, not legal or tax advice. For the
            estate&rsquo;s specific position, speak to a solicitor.
          </p>
        </div>
      </section>

      {/* ————— THE STEPS ————— */}
      <section className="border-hair/70 border-b bg-white px-6 py-24 md:px-12 md:py-28">
        <div className="mx-auto max-w-5xl">
          <SectionNumber>01</SectionNumber>
          <Eyebrow className="mt-5">what happens, in order</Eyebrow>
          <h2 className="mt-4 font-semibold font-serif text-4xl leading-[1.05] tracking-[-0.02em] md:text-5xl">
            Six steps. Two deadlines that bite.
          </h2>
          <ol className="mt-12 divide-y divide-hair border-hair border-y">
            {STEPS.map((s) => (
              <li
                key={s.n}
                className="grid grid-cols-[44px_1fr] items-start gap-5 py-6 md:grid-cols-[56px_1fr] md:gap-7"
              >
                <span className="font-light font-serif text-3xl text-brand-deep/30 tabular-nums">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-semibold font-serif text-lg md:text-xl">
                    {s.t}
                  </h3>
                  <p className="mt-2 max-w-3xl text-[14px] text-stone-600 leading-relaxed">
                    {s.d}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-8 max-w-3xl text-[13px] text-stone-500 leading-relaxed">
            The two deadlines: inheritance tax falls due at the end of month
            six, and interest runs after it. Empty-property insurance lapses
            fast. Everything else in probate can wait; those two cannot.
          </p>
        </div>
      </section>

      {/* ————— WHERE WE FIT ————— */}
      <section className="border-hair/70 border-b bg-soft px-6 py-24 md:px-12 md:py-28">
        <div className="mx-auto max-w-4xl">
          <SectionNumber>02</SectionNumber>
          <Eyebrow className="mt-5">where a cash sale fits</Eyebrow>
          <h2 className="mt-4 font-semibold font-serif text-4xl leading-[1.05] tracking-[-0.02em] md:text-5xl">
            Agree the price now.{' '}
            <span className="font-normal text-brand">
              Complete on the grant date.
            </span>
          </h2>
          <p className="mt-6 max-w-2xl text-[15px] text-stone-700 leading-relaxed">
            Because completion has to wait for the grant anyway, the months of
            waiting cost a probate seller nothing with us — we do the viewing,
            confirm the price in writing, and set completion for the day the
            grant arrives. The estate stops bleeding carrying costs the moment
            it completes, and the tax bill can be paid on time.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {[
              {
                t: 'Price certainty',
                d: 'Confirmed in writing after viewing, locked 72 hours, and it does not change at the last minute. Executors can put a real number in front of beneficiaries.',
              },
              {
                t: 'No chain',
                d: 'Cash, no mortgage condition, no onward chain to collapse — the fall-through risk that haunts probate sales is removed.',
              },
              {
                t: 'No cost to the estate',
                d: 'No agent fee, no fee to us. We pay our own legals, searches and survey.',
              },
            ].map((c) => (
              <div
                key={c.t}
                className="rounded-sm border border-hair bg-white p-6"
              >
                <p className="font-semibold font-serif text-[17px] text-forest">
                  {c.t}
                </p>
                <p className="mt-3 text-[13px] text-stone-600 leading-relaxed">
                  {c.d}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-10 max-w-2xl text-[15px] text-stone-700 leading-relaxed">
            And the honest other half: if the estate is under no time
            pressure and the beneficiaries want the best possible price, a
            good local agent will very likely net the estate more than we
            will. Our offer is below open-market value by design — the maths
            is shown line by line on{' '}
            <Link
              className="text-leaf underline decoration-leaf/50 underline-offset-4 hover:decoration-leaf"
              href="/sell#maths"
            >
              the seller page
            </Link>
            .
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Button href="/sell#offer">Get an indicative figure</Button>
            <Button href="/sell#maths" variant="ghost">
              See where the number comes from
            </Button>
          </div>
        </div>
      </section>

      {/* ————— FAQ ————— */}
      <section className="border-hair/70 border-b px-6 py-24 md:px-12 md:py-28">
        <div className="mx-auto max-w-3xl">
          <Eyebrow>honest answers</Eyebrow>
          <h2 className="mt-4 font-semibold font-serif text-4xl tracking-[-0.02em] md:text-5xl">
            Questions executors ask us.
          </h2>
          <div className="mt-12 divide-y divide-hair border-hair border-y">
            {FAQ.map((item, i) => (
              <details key={item.q} className="group py-5" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-serif text-[18px] text-brand-deep">
                  <span>{item.q}</span>
                  <span className="ml-4 font-light font-serif text-2xl text-brand transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-4 text-stone-600 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ————— PROOF BAND ————— */}
      <ProofBand />

      {/* ————— FOOTER ————— */}
      <footer className="bg-cream px-6 py-16 md:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div className="flex items-center gap-4">
              <Seal label="Est. 2026" />
              <div className="pl-1">
                <Wordmark ventures className="text-base" />
                <p className="mt-2 font-serif text-sm text-stone-500">
                  Direct-to-vendor property buyers &middot; UK
                </p>
              </div>
            </div>
            <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-stone-600">
              <Link href="/sell" className="hover:text-brand-deep">
                For sellers
              </Link>
              <Link
                href="/instant-offer/methodology"
                className="hover:text-brand-deep"
              >
                Methodology
              </Link>
              <Link
                href="/why-we-wont-buy-any-home"
                className="hover:text-brand-deep"
              >
                What we won&rsquo;t buy
              </Link>
              <Link
                href="/legal/fca-disclosure"
                className="hover:text-brand-deep"
              >
                Regulatory
              </Link>
            </nav>
          </div>
          <div className="mt-10 border-hair border-t pt-6">
            <p className="text-[11px] text-stone-500 leading-relaxed">
              Kept is a UK cash property buyer, not an FCA-authorised firm. We
              do not provide financial, legal or tax advice; the information
              on this page is general guidance for England and Wales. Seek
              independent legal advice before accepting any offer.
            </p>
            <p className="mt-4 text-[11px] text-stone-400">
              © {new Date().getFullYear()} Kept.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
