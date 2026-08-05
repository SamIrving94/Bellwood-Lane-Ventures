import {
  Button,
  Eyebrow,
  LogoLockup,
  Seal,
  SectionNumber,
  Wordmark,
} from '@/components/brand';
import { OfferBreakdown } from '@/components/offer-breakdown';
import { ProofBand } from '@/components/proof-band';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import { ChatFlow } from '../instant-offer/components/chat-flow';

export const revalidate = 300;

const REASONS: Array<{ k: string; t: string; b: string }> = [
  {
    k: 'Probate',
    t: 'You inherited a property',
    b: "HMRC charges 8.75% interest on inheritance tax six months after the death. Empty homes bleed council tax and insurance. We complete on the grant date so the estate doesn't lose money waiting.",
  },
  {
    k: 'Chain break',
    t: 'Your buyer pulled out',
    b: "You've spent months getting to exchange. Don't lose your onward purchase. We step in with a binding offer so the chain holds and your move stays on track.",
  },
  {
    k: 'Relocation',
    t: 'You’re moving abroad or for work',
    b: 'International signatures, time-zone delays, empty house syndrome. You sign once, we complete on your timeline.',
  },
  {
    k: 'Divorce or separation',
    t: 'You need a clean break',
    b: 'Court-ordered timelines, joint mortgage to clear, emotional weight. We move quietly and quickly. Solicitors talk to solicitors.',
  },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Why is the offer below open-market?',
    a: "Because we buy for cash, complete in weeks rather than months, charge no fee, and take the risk of fall-through. The price reflects the speed and certainty of the transaction. You're paying us a speed premium for certainty.",
  },
  {
    q: 'Can I change my mind after I accept?',
    a: 'Yes. The offer is binding upon Kept for 72 hours. It is not binding upon you until exchange of contracts. You can withdraw at any point before exchange at no cost.',
  },
  {
    q: 'What does it cost me?',
    a: 'Zero. No agent fee, no survey fee, and no fee to us at any point. As the buyer we pay for our own legals, searches and survey. The figure you see in the offer is the figure that lands in your account on completion day.',
  },
  {
    q: 'How is the offer calculated?',
    a: "We pull every comparable sale within 0.5 miles of your home from HM Land Registry's last 24 months, adjust for market trend, score risk factors, then apply a transparent speed-premium discount. The full methodology is published.",
  },
  {
    q: 'How quickly can you complete?',
    a: 'In weeks rather than months, paced to suit a probate grant or onward move. We instruct solicitors as soon as you accept and share proof of funds straight away.',
  },
  {
    q: 'Can the offer change later?',
    a: 'The price we confirm in writing is the price we complete at. There are only three exceptions, all documented in writing: (1) a structural survey reveals a material defect that was not visible or disclosed at viewing, (2) a title issue emerges during conveyancing that materially affects value, or (3) information provided about the property turns out to be materially incorrect. None of those apply? The price does not change.',
  },
  {
    q: 'Are you regulated?',
    a: 'Cash property buying is unregulated by the FCA. We are members of the Property Redress Scheme (PRS) — a government-approved independent redress body — voluntarily follow The Property Ombudsman code, are HMRC-registered for AML supervision, and ICO-registered as a data controller.',
  },
];

const NAV = [
  { href: '#how', label: 'How it works' },
  { href: '#maths', label: 'The maths' },
  { href: '#faq', label: 'FAQ' },
  { href: '/instant-offer/methodology', label: 'Methodology' },
  { href: '/agents', label: 'For agents' },
];

/** The signed cash-offer letter, the hero artifact. A real typed document,
 *  not type on a flat field: Caslon letterhead, Courier body, dotted spec
 *  leaders, an actual wax-red seal with weight, and an ink signature. Every
 *  detail here is doing anti-template work — this card is the brand. */
function OfferLetter() {
  return (
    <div className="-rotate-[1.6deg] relative w-[300px] rounded-[2px] border border-hair bg-[linear-gradient(175deg,#fdfaf2_0%,#f7f2e6_70%,#f3edde_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(36,28,26,0.08),0_30px_56px_-26px_rgba(36,28,26,0.55)]">
      {/* Wax seal — solid, irregular, embossed. Not an outline. */}
      <div className="-right-5 -top-5 absolute hidden rotate-[8deg] sm:block">
        <div
          className="flex h-14 w-14 items-center justify-center bg-wax shadow-[inset_0_2px_3px_rgba(255,255,255,0.35),inset_0_-3px_4px_rgba(0,0,0,0.3),0_3px_6px_rgba(36,28,26,0.35)]"
          style={{ borderRadius: '46% 54% 50% 50% / 52% 46% 54% 48%' }}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 font-bold font-serif text-[17px] text-cream">
            k.
          </span>
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-bold font-serif text-[17px] text-brand-deep tracking-[0.01em]">
          Kept
        </p>
        <p className="text-[10.5px] text-stone-400 [font-family:var(--font-courier)]">
          Ref BW-2026-0142
        </p>
      </div>
      <p className="mt-0.5 text-[10.5px] text-stone-400 [font-family:var(--font-courier)]">
        Sample document
      </p>
      <div className="mt-4 border-stone-300/60 border-t border-dashed pt-3">
        <p className="text-[10.5px] text-stone-400 tracking-[0.08em] [font-family:var(--font-courier)]">
          PROPERTY
        </p>
        <p className="mt-1 font-serif text-[15px] text-forest leading-snug">
          14 Acacia Avenue, Stockport SK4&nbsp;3HQ
        </p>
      </div>
      <div className="mt-3 border-stone-300/60 border-t border-dashed pt-3">
        <p className="text-[10.5px] text-brand tracking-[0.08em] [font-family:var(--font-courier)]">
          OUR CASH OFFER
        </p>
        <p className="mt-1 font-bold font-serif text-[40px] text-forest leading-none tracking-[-0.01em]">
          £244,000
        </p>
        <p className="mt-2 inline-block rotate-[-1.5deg] border border-wax/60 px-2 py-0.5 text-[10px] text-wax tracking-[0.14em] [font-family:var(--font-courier)]">
          LOCKED · 72 HOURS
        </p>
      </div>
      <dl className="mt-4 space-y-2.5 border-stone-300/60 border-t border-dashed pt-3.5 text-[12px] text-stone-600 [font-family:var(--font-courier)]">
        <div className="flex items-baseline gap-2">
          <dt className="shrink-0">Completion</dt>
          <span
            aria-hidden
            className="mb-[3px] flex-1 border-stone-400/50 border-b border-dotted"
          />
          <dd className="shrink-0 text-forest">Weeks, not months</dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="shrink-0">Fees to you</dt>
          <span
            aria-hidden
            className="mb-[3px] flex-1 border-stone-400/50 border-b border-dotted"
          />
          <dd className="shrink-0 text-forest">None</dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="shrink-0">Chain</dt>
          <span
            aria-hidden
            className="mb-[3px] flex-1 border-stone-400/50 border-b border-dotted"
          />
          <dd className="shrink-0 text-forest">None. Cash.</dd>
        </div>
      </dl>
      {/* Ink signature — two strokes, imperfect baseline */}
      <svg viewBox="0 0 150 34" className="mt-4 h-7 w-32" aria-hidden="true">
        <path
          d="M4 24 C 8 8, 16 4, 18 12 C 20 20, 14 28, 22 26 C 30 24, 32 10, 40 12 C 45 13, 43 22, 50 21 C 58 20, 60 8, 68 11 C 74 13, 72 22, 80 20 C 90 17, 94 10, 104 12 C 112 14, 116 18, 126 13 C 134 9, 140 12, 146 15"
          fill="none"
          stroke="#26333c"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M30 29 C 55 26, 100 26, 132 24"
          fill="none"
          stroke="#26333c"
          strokeWidth="0.8"
          strokeLinecap="round"
          opacity="0.55"
        />
      </svg>
      <div className="mt-1 flex items-baseline justify-between gap-4">
        <p className="font-serif text-[11px] text-stone-400 italic">
          Signed for Kept
        </p>
        <p className="text-[10px] text-stone-400 [font-family:var(--font-courier)]">
          A. Taylor
        </p>
      </div>
    </div>
  );
}

export default function SellPage() {
  return (
    <>
      {/* ————— NAV ————— */}
      <header className="sticky top-0 z-40 border-hair/70 border-b bg-cream/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5 md:px-10">
          <LogoLockup href="/sell" />
          <nav className="hidden items-center gap-7 text-[14px] text-stone-600 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="transition-colors hover:text-brand-deep"
              >
                {item.label}
              </Link>
            ))}
            <Button href="#offer" className="px-5 py-2 text-sm">
              Get an offer
            </Button>
          </nav>
        </div>
      </header>

      {/* ————— HERO —————
          Not the template split ("headline left, floating card right").
          Structure borrowed from the reference set (docs/brand/
          DESIGN-REFERENCES.md): a courier dateline row (the page opens like
          a document), a giant full-width editorial headline (the Wise move),
          the signed letter laid OVER the composition like an object on a
          desk, and a real person next to the promise (the Farewill move). */}
      <section className="relative overflow-hidden px-6 pt-10 pb-16 md:px-12 md:pt-12 md:pb-20">
        <div className="relative mx-auto max-w-6xl">
          {/* Dateline — the page itself is a document */}
          <div className="flex items-baseline justify-between gap-6 border-hair border-b pb-4">
            <Eyebrow>for UK homeowners</Eyebrow>
            <p className="text-[11px] text-stone-400 tracking-[0.18em] [font-family:var(--font-courier)]">
              EST. 2026 · UK
            </p>
          </div>
          {/* Full-width editorial headline — no half-column timidity */}
          <h1
            className="relative z-10 mt-10 font-bold font-serif text-forest leading-[0.98] tracking-[-0.03em] md:mt-12"
            style={{ fontSize: 'clamp(46px, 7.6vw, 92px)' }}
          >
            A real cash offer,
            <br />
            <span className="font-normal text-brand">
              in writing<span className="text-wax">.</span>
            </span>
          </h1>
          {/* The letter is laid over the composition; the copy sits beside it */}
          <div className="mt-10 grid items-start gap-12 md:mt-8 md:grid-cols-[1fr_auto] md:gap-16">
            <div className="max-w-md">
              <p className="text-[16px] text-stone-600 leading-[1.75]">
                Tell us about the property and we will come and view it. We
                aim to make an offer within 24 to 48 hours of viewing, locked
                for 72 hours so you can take advice. The price we put in
                writing is the price we complete at.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                <Button href="#offer">Get a cash offer</Button>
                <Button href="/instant-offer/methodology" variant="ghost">
                  See how we calculate offers
                </Button>
              </div>
              {/* A person, not a pipeline — right where the promise is made */}
              <div className="mt-10 flex items-center gap-4 border-hair border-t pt-6">
                <Image
                  src="/team/anthony-taylor.jpg"
                  alt="Anthony Taylor of Kept"
                  width={96}
                  height={96}
                  className="h-12 w-12 rounded-full border border-hair object-cover object-top"
                />
                <p className="max-w-[300px] text-[13.5px] text-stone-600 leading-snug">
                  <span className="font-semibold text-forest">
                    Anthony reads every enquiry.
                  </span>{' '}
                  Same-day reply, Monday to Friday.
                </p>
              </div>
            </div>
            <figure className="flex flex-col items-center md:items-end lg:-mt-16 xl:-mt-32">
              <OfferLetter />
              <figcaption className="mt-6 max-w-[300px] text-center font-serif text-[13px] text-stone-500 md:text-right">
                Every confirmed offer is a signed document like this one.
              </figcaption>
            </figure>
          </div>
          {/* Hairline baseline — the hero ends on a rule, not on air */}
          <div className="mt-14 border-hair border-t pt-5">
            <p className="font-serif text-[13px] text-stone-500">
              Property Redress Scheme &middot; HMRC AML supervised &middot;
              ICO registered &middot; Zero fees
            </p>
          </div>
        </div>
      </section>

      {/* ————— REASONS / SITUATIONS ————— */}
      <section className="border-hair/70 border-y bg-soft px-6 py-24 md:px-12 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-3xl">
            <Eyebrow>who we buy from</Eyebrow>
            <h2 className="mt-4 font-semibold font-serif text-4xl leading-[1.05] tracking-[-0.02em] md:text-5xl">
              Real reasons people choose{' '}
              <span className="font-normal text-brand">certainty</span>{' '}
              over price.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {REASONS.map((r) => (
              <div
                key={r.k}
                className="rounded-sm border border-hair bg-white p-7 transition-shadow hover:shadow-[0_24px_48px_-32px_rgba(43,34,32,0.4)]"
              >
                <p className="font-serif text-brand text-sm">{r.k}</p>
                <p className="mt-3 font-semibold font-serif text-xl">{r.t}</p>
                <p className="mt-3 text-sm text-stone-600 leading-relaxed">
                  {r.b}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-[14px] text-stone-600">
            Dealing with probate and not sure what happens next?{' '}
            <Link
              href="/probate"
              className="text-leaf underline decoration-leaf/50 underline-offset-4 hover:decoration-leaf"
            >
              Read our plain-English guide for executors →
            </Link>
          </p>
        </div>
      </section>

      {/* ————— HOW IT WORKS ————— */}
      <section
        id="how"
        className="border-hair/70 border-y bg-white px-6 py-24 md:px-12 md:py-28"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <SectionNumber>01</SectionNumber>
            <Eyebrow className="mt-5">how it works</Eyebrow>
            <h2 className="mt-4 font-semibold font-serif text-4xl leading-[1] tracking-[-0.02em] md:text-6xl">
              Five steps.{' '}
              <span className="font-normal text-brand">
                No surprises.
              </span>
            </h2>
            <p className="mt-6 text-[15px] text-stone-600 leading-relaxed">
              Every offer is generated from real comparable sales. The maths are
              published. Nothing hidden. The price we confirm in writing is the
              price we complete at.
            </p>
          </div>
          <ol className="divide-y divide-hair border-hair border-y">
            {[
              {
                n: '01',
                t: 'You get in touch',
                sla: 'Straight away',
                d: 'Tell us the address and a little about your situation. We acknowledge receipt and pull what we can from public records, Land Registry, EPC and planning, before bothering you for anything else.',
              },
              {
                n: '02',
                t: 'Indicative offer',
                sla: 'After desk research',
                d: 'We send an indicative offer range based on comparable sales, PropertyData valuation, and the public records we found. Clearly labelled INDICATIVE — our honest starting point, subject only to viewing.',
              },
              {
                n: '03',
                t: 'We come and view the property',
                sla: 'At your convenience',
                d: 'We physically view every property before we confirm a price. We assess condition and anything not clear from the records. We tell you in advance what we are looking for.',
              },
              {
                n: '04',
                t: 'Confirmed price in writing',
                sla: 'We aim for 24–48 hours after viewing',
                d: 'The price we send is the price we complete at. We share the survey notes that informed it. Locked for 72 hours so you can take advice.',
              },
              {
                n: '05',
                t: 'Conveyancing and completion',
                sla: 'Paced to suit you',
                d: 'You instruct your own solicitor. We can recommend firms accustomed to working on expedited timelines to keep the transaction efficient. We instruct ours straight away. Regular updates on a live timeline you can share with anyone. We pay all our own legal costs.',
              },
            ].map((s) => (
              <li
                key={s.n}
                className="grid grid-cols-[44px_1fr] items-start gap-5 py-6 md:grid-cols-[56px_1fr_170px] md:gap-7"
              >
                <span className="font-light font-serif text-3xl text-brand-deep/30 tabular-nums">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-semibold font-serif text-lg md:text-xl">
                    {s.t}
                  </h3>
                  <p className="mt-2 text-[14px] text-stone-600 leading-relaxed">
                    {s.d}
                  </p>
                </div>
                <p className="font-serif text-brand text-sm md:text-right">
                  {s.sla}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ————— THE MATHS (OFFER BREAKDOWN) ————— */}
      <section
        id="maths"
        className="border-hair/70 border-b bg-soft px-6 py-24 md:px-12 md:py-28"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-3xl">
            <SectionNumber>02</SectionNumber>
            <Eyebrow tone="wax" className="mt-5">
              the honest version
            </Eyebrow>
            <h2 className="mt-4 font-semibold font-serif text-4xl leading-[1.05] tracking-[-0.02em] md:text-5xl">
              Where the number{' '}
              <span className="font-normal text-brand">
                actually comes from.
              </span>
            </h2>
            <p className="mt-6 max-w-2xl text-[15px] text-stone-700 leading-relaxed">
              We buy below open-market value. On purpose, and we say so. Here
              is the whole trade, side by side — including the route that
              beats us on price.
            </p>
          </div>
          <OfferBreakdown />
        </div>
      </section>

      {/* ————— THE OFFER (CHAT) ————— */}
      <section
        id="offer"
        className="border-hair/70 border-b px-6 py-24 md:px-12 md:py-28"
      >
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 flex flex-col items-center text-center">
            <Eyebrow>get an offer</Eyebrow>
            <h2 className="mt-4 font-semibold font-serif text-4xl md:text-5xl">
              Tell us about your home.
            </h2>
            <p className="mt-4 text-stone-600">
              A few quick details. An indicative figure first, then a confirmed
              offer in writing after we view the property.
            </p>
          </div>
          <Suspense fallback={<div className="h-96" />}>
            <ChatFlow defaultRole="seller" />
          </Suspense>
        </div>
      </section>

      {/* ————— A PERSON, NOT A PIPELINE ————— */}
      <section className="border-hair/70 border-b bg-white px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 md:grid-cols-[260px_1fr] md:gap-14">
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
            <h2 className="mt-4 font-semibold font-serif text-3xl leading-tight tracking-[-0.02em] md:text-5xl">
              Software does the maths.{' '}
              <span className="font-normal text-brand">
                A person makes the promise.
              </span>
            </h2>
            <p className="mt-6 max-w-xl text-[15px] text-stone-600 leading-relaxed">
              Comparable sales, title records, market trend — the desk research
              is automated, which is why it&rsquo;s fast. The judgment
              isn&rsquo;t. Nothing is sent to you until a person has read it
              and put their name to it, and when you write to us, it&rsquo;s
              Anthony who reads it. Same-day response, Monday to Friday.
            </p>
            <div className="mt-8">
              <Button href="#offer" variant="secondary">
                Start with the address
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ————— PROMISE ————— */}
      <section className="relative overflow-hidden border-hair/70 border-b bg-brand-deep px-6 py-24 text-white md:px-12 md:py-28">
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <Eyebrow tone="light">the written promise</Eyebrow>
            <h2 className="mt-4 font-semibold font-serif text-4xl leading-[1.05] tracking-[-0.02em] md:text-5xl">
              No renegotiation.
              <br />
              <span className="font-normal text-leaf">
                No surprises.
              </span>
            </h2>
            <p className="mt-6 text-[15px] text-white/70 leading-relaxed">
              The single biggest complaint about cash buyers is the last-minute
              price drop. We put the price in writing and stand behind it.
            </p>
            <Seal
              label="Kept"
              className="mt-10 hidden lg:inline-flex"
            />
          </div>
          <dl className="divide-y divide-white/10 border-white/10 border-t">
            {[
              [
                'Offer validity',
                'Legally binding upon Kept for 72 hours. Time-stamped, in writing, downloadable as PDF.',
              ],
              [
                'No price reduction',
                'We do not renegotiate between issue and exchange. There are three documented exceptions: a survey reveals a material defect not visible at viewing, a title issue emerges that materially affects value, or information provided proves materially incorrect. In each case you can walk away at no cost.',
              ],
              [
                'Walk-away free',
                'You may withdraw at any point before exchange. No penalty, no chase.',
              ],
              [
                'Costs covered',
                'No fee to us at any point. As the buyer we pay our own legals, searches and survey.',
              ],
            ].map(([k, v]) => (
              <div
                key={k as string}
                className="grid grid-cols-1 gap-2 py-5 sm:grid-cols-[180px_1fr] sm:gap-8"
              >
                <dt className="font-serif text-[15px] text-leaf">{k}</dt>
                <dd className="text-white/90">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ————— PROOF BAND ————— */}
      <ProofBand />

      {/* ————— FAQ ————— */}
      <section
        id="faq"
        className="border-hair/70 border-b px-6 py-24 md:px-12 md:py-28"
      >
        <div className="mx-auto max-w-3xl">
          <Eyebrow>honest answers</Eyebrow>
          <h2 className="mt-4 font-semibold font-serif text-4xl md:text-5xl">
            Questions sellers ask us most.
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

      {/* ————— WHEN NOT TO USE US ————— */}
      <section className="border-hair/70 border-b bg-soft px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-4xl">
          <Eyebrow>the honest version</Eyebrow>
          <h2 className="mt-4 font-semibold font-serif text-3xl leading-tight tracking-[-0.02em] md:text-5xl">
            When we&rsquo;re probably{' '}
            <span className="font-normal text-brand">not</span> the right
            answer
          </h2>
          <p className="mt-5 max-w-2xl text-[15px] text-stone-700 leading-relaxed">
            We buy below open market value, at a price that reflects the speed
            and certainty of the transaction. That trade is right for some
            sellers and wrong for others. We&rsquo;d rather tell you so up front
            than waste your time.
          </p>
          <ul className="mt-8 space-y-px overflow-hidden rounded-sm border border-hair bg-hair">
            {[
              {
                t: 'You have plenty of time and no pressure to sell.',
                d: 'If you can wait 4–8 months for the right buyer, the open market will almost certainly get you a better price. Speed is the trade you’re paying for with us.',
              },
              {
                t: 'Your property is in excellent condition and high demand.',
                d: 'Family homes in popular streets, with no chain issues, usually sell fast at full market value through a good high-street agent. That’s their wedge, not ours.',
              },
              {
                t: 'You want to maximise every pound of sale price.',
                d: 'Our offer is below open-market value by design — a speed premium for cash, certainty, and no chain. If maximising is the goal, this isn’t the route.',
              },
            ].map((item) => (
              <li key={item.t} className="flex items-start gap-4 bg-white p-6">
                <span className="mt-2.5 h-px w-4 shrink-0 bg-brand" />
                <div>
                  <p className="font-semibold font-serif text-[17px] text-forest">
                    {item.t}
                  </p>
                  <p className="mt-1 text-[14px] text-stone-600 leading-relaxed">
                    {item.d}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-2xl text-[14px] text-stone-600 leading-relaxed">
            If you read those and one of them describes you, we&rsquo;d
            genuinely suggest calling a local agent first. We&rsquo;d rather you
            sold well than sold to us.
          </p>
        </div>
      </section>

      {/* ————— AGENTS LINK ————— */}
      <section className="border-hair/70 border-b bg-white px-6 py-14 md:px-12">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-5 text-center md:flex-row md:text-left">
          <div>
            <Eyebrow tone="muted">are you an estate agent?</Eyebrow>
            <p className="mt-2 font-serif text-xl">
              Partner fee agreed per deal, in writing.
            </p>
          </div>
          <Button href="/agents" variant="ghost">
            See the agent partner programme
          </Button>
        </div>
      </section>

      {/* ————— FINAL CTA ————— */}
      <section className="px-6 py-16 md:px-12">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-sm bg-brand-deep px-8 py-16 text-white md:px-16 md:py-20">
          <div className="relative grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
            <div>
              <Eyebrow tone="light">see the number</Eyebrow>
              <h2 className="mt-4 font-semibold font-serif text-5xl leading-[1] tracking-[-0.025em] md:text-7xl">
                A real offer{' '}
                <span className="font-normal text-leaf">
                  in writing.
                </span>
              </h2>
            </div>
            <div className="lg:text-right">
              <Button href="#offer" variant="accent">
                Get my offer
              </Button>
            </div>
          </div>
        </div>
      </section>

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
              <a href="#offer" className="hover:text-brand-deep">
                Get an offer
              </a>
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
              <Link href="/probate" className="hover:text-brand-deep">
                Probate guide
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
          <div className="mt-10 border-hair border-t pt-6">
            <p className="text-[11px] text-stone-500 leading-relaxed">
              Kept is a UK cash property buyer, not an
              FCA-authorised firm. We do not provide financial or legal advice.
              Seek independent legal advice before accepting any offer. All
              offers are subject to satisfactory survey and title searches.
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
