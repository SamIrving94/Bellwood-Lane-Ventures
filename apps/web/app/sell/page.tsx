import {
  Button,
  Eyebrow,
  LogoLockup,
  Monogram,
  Seal,
  SectionNumber,
  Wordmark,
} from '@/components/brand';
import { ProofBand } from '@/components/proof-band';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import { ChatFlow } from '../instant-offer/components/chat-flow';

export const revalidate = 300;

/* Situations, in the seller's words — never in ours, and never with a number
   in them. Founder note (Aug 2026): the probate card used to open on HMRC
   interest and council tax, which is an accountant talking to someone who has
   just lost a parent. Every card now names the situation, then says what we
   do about it, and lands on the same place: getting back to what matters. */
const REASONS: Array<{ k: string; t: string; b: string }> = [
  {
    k: 'Probate',
    t: 'You’re the executor of an estate',
    b: 'There is a lot to carry, and the house is only part of it. We complete with speed and certainty, at whatever pace the grant allows, so you and your loved ones can move on and focus on the things that matter most.',
  },
  {
    k: 'Chain break',
    t: 'Your buyer pulled out',
    b: 'Months of work, undone weeks from the finish. We step in and hold the chain together, so your onward move survives and you can get on with it.',
  },
  {
    k: 'Relocation',
    t: 'You’re moving abroad or for work',
    b: 'Signatures across time zones, an empty house behind you, a life starting somewhere else. You sign once. We complete when you need us to.',
  },
  {
    k: 'Divorce or separation',
    t: 'You need a clean break',
    b: 'Court-ordered timelines, a joint mortgage to clear, emotional weight. We move quietly and quickly. Solicitors talk to solicitors.',
  },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Why is the offer below open-market?',
    a: 'Because we buy for cash, complete in weeks rather than months, charge no fee, and carry the risk of the sale falling through. The price reflects the speed and the certainty of the transaction.',
  },
  {
    q: 'Can I change my mind after I accept?',
    a: 'Yes. The offer is binding upon Kept for 72 hours. It is not binding upon you until exchange of contracts. You can withdraw at any point before exchange at no cost.',
  },
  {
    q: 'What does it cost me?',
    a: 'There is no agent fee and no fee to us, at any point. You instruct your own solicitor and pay their costs; we pay ours. The figure in our offer is the figure we complete at, minus your own legal costs.',
  },
  {
    q: 'How is the offer calculated?',
    a: "We pull every comparable sale within 0.5 miles of the property from HM Land Registry's last 24 months, adjust for market trend, score the risk factors, then arrive at a figure we can commit to. The full methodology is published.",
  },
  {
    q: 'How quickly can you complete?',
    a: 'At the pace you need. We can complete in as little as two weeks, or take as long as your circumstances require if you are waiting on a grant of probate, a court date, or an onward purchase. We instruct solicitors as soon as you accept and share proof of funds straight away.',
  },
  {
    q: 'Can the offer change later?',
    a: 'The price we confirm in writing is the price we complete at. There are only three exceptions, all documented in writing: (1) a structural survey reveals a material defect that was not visible or disclosed at viewing, (2) a title issue emerges during conveyancing that materially affects value, or (3) information provided about the property turns out to be materially incorrect. None of those apply? The price does not change.',
  },
  {
    q: 'Are you regulated?',
    a: 'Cash property buying is unregulated by the FCA. We are members of the Property Redress Scheme (PRS), a government-approved independent redress body. We voluntarily follow The Property Ombudsman code, are HMRC-registered for AML supervision, and ICO-registered as a data controller.',
  },
];

const NAV = [
  { href: '#broken', label: 'Why we exist' },
  { href: '#how', label: 'How it works' },
  { href: '#promise', label: 'Our promise' },
  { href: '#faq', label: 'FAQ' },
  { href: '/agents', label: 'For agents' },
];

/** The three documented exceptions, listed in full wherever we say we do not
 *  renegotiate. Founder note: never assert the promise without them visible —
 *  an unqualified absolute would be the one thing on this page we could not
 *  stand behind. */
const EXCEPTIONS = [
  'A survey reveals a material defect that was not visible or disclosed at viewing.',
  'A title issue emerges during conveyancing that materially affects value.',
  'Information provided about the property turns out to be materially incorrect.',
];

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
          The signed-letter artefact and the wax seal are gone (founder review,
          Aug 2026). Removing the letter left a hole on the right, and for a
          while it was filled with a second column of body copy, which is the
          layout you get by default rather than by decision. The hero is now a
          full-rail headline over two columns that BOTH carry content: the
          promise on the left, the situation index on the right. */}
      <section className="relative overflow-hidden px-6 pt-10 pb-16 md:px-12 md:pt-12 md:pb-20">
        {/* The watermark is the MONOGRAM, not the wordmark.

            The founder's reference was the old Bellwoods `B`: one letter,
            oversized, translucent. The full word does not survive the
            treatment. "kept" set this large has to be sliced by two page edges
            to fit, and a word cut through its own x-height reads as a
            rendering fault rather than a decision. A single `k.` bleeds off
            one edge, keeps its whole letterform, and is what KEPT.md already
            reserves the monogram for: seals, favicons, ghosted watermarks.
            It sits in the headline band, above both columns, so it never tints
            running body copy.

            Opacity goes on the WRAPPER, not on the letter's text colour.
            `Monogram` draws its full stop through `KeptDot`, which carries its
            own `text-wax`; a `text-forest/[0.06]` on the parent leaves that
            dot at FULL strength, i.e. a solid red circle the height of the
            headline. Fading the whole element keeps the dot wax and in
            proportion. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 select-none overflow-hidden opacity-[0.07]"
        >
          <Monogram className="-right-[7vw] absolute top-[2vw] text-[34vw] text-forest leading-none md:text-[26vw]" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          {/* Dateline — the page itself is a document */}
          <div className="flex items-baseline justify-between gap-6 border-hair border-b pb-4">
            <Eyebrow>for UK property sellers</Eyebrow>
            <p className="text-[11px] text-stone-400 tracking-[0.18em] [font-family:var(--font-courier)]">
              EST. 2026 · UK
            </p>
          </div>

          {/* The headline runs the full rail. It used to stop at max-w-4xl,
              which left the right third of every rule on the page pointing at
              nothing. */}
          <h1
            className="relative z-10 mt-9 text-balance font-bold font-serif text-forest leading-[1.0] tracking-[-0.03em] md:mt-10"
            style={{ fontSize: 'clamp(40px, 6.2vw, 78px)' }}
          >
            A real cash offer in writing.
            <br />
            <span className="font-normal text-brand">
              And a promise we keep<span className="text-wax">.</span>
            </span>
          </h1>

          {/* Two columns that BOTH carry content: the promise on the left, the
              situation index on the right. The right column is where the
              signed letter used to sit; leaving it empty is what made the
              composition fall off the right-hand edge. */}
          <div className="relative z-10 mt-12 grid grid-cols-1 gap-x-16 gap-y-12 border-hair border-t pt-9 md:mt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
            <div>
              <Eyebrow tone="wax">our promise is simple</Eyebrow>
              <p className="mt-5 max-w-md text-[17px] text-stone-700 leading-[1.7]">
                We come and see every home ourselves before we put a price on
                paper. Then we send you our offer in writing, held for 72 hours.
                What we write down is what we complete at.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
                <Button href="#offer">Get a cash offer</Button>
                <Button href="#how" variant="ghost">
                  See how it works
                </Button>
              </div>
            </div>

            {/* Verbs as navigation (DESIGN-REFERENCES.md, the Farewill steal),
                set as an index with dotted leaders. That texture is lifted
                straight from the offer letter's spec table, which is the one
                piece of the document world still available to us now the
                letter artefact itself has gone. */}
            <div>
              <Eyebrow tone="muted">why are you selling?</Eyebrow>
              <ul className="mt-4 divide-y divide-hair border-hair border-y">
                {[
                  { t: 'I’m an executor', s: 'Probate', href: '/probate' },
                  {
                    t: 'My buyer pulled out',
                    s: 'Chain break',
                    href: '#situations',
                  },
                  { t: 'We’re separating', s: 'Divorce', href: '#situations' },
                  {
                    t: 'I’m relocating',
                    s: 'Moving away',
                    href: '#situations',
                  },
                ].map((r) => (
                  <li key={r.t}>
                    <Link
                      href={r.href}
                      className="group flex items-baseline gap-3 py-3.5 transition-colors hover:text-brand-deep"
                    >
                      <span className="shrink-0 font-serif text-[18px] text-forest transition-colors group-hover:text-brand">
                        {r.t}
                      </span>
                      <span
                        aria-hidden
                        className="mb-[5px] flex-1 border-stone-400/40 border-b border-dotted"
                      />
                      <span className="shrink-0 text-[10.5px] text-stone-500 uppercase tracking-[0.14em] [font-family:var(--font-courier)]">
                        {r.s}
                      </span>
                      <span
                        aria-hidden
                        className="shrink-0 text-brand transition-transform group-hover:translate-x-0.5"
                      >
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-14 border-hair border-t pt-5">
            <p className="font-serif text-[13px] text-stone-500">
              Property Redress Scheme &middot; HMRC AML supervised &middot; ICO
              registered &middot; No fees to you
            </p>
          </div>
        </div>
      </section>

      {/* ————— WHO WE ARE —————
          Lifted out of the hero, where it was competing with the promise for
          the same eyeline. On its own it can be what it actually is: the
          argument for why we are not the company sellers are afraid of. */}
      <section className="px-6 pt-20 pb-4 md:px-12 md:pt-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.25fr] lg:gap-20">
            <h2 className="font-semibold font-serif text-3xl text-forest leading-[1.1] tracking-[-0.02em] md:text-[42px]">
              We&rsquo;re Kept.
              <br />
              We&rsquo;re not a{' '}
              <span className="font-normal text-brand">
                &ldquo;we buy any home&rdquo;
              </span>
              <span className="text-wax">.</span>
            </h2>
            <div className="space-y-5 text-[16px] text-stone-600 leading-[1.75]">
              <p>
                A home is usually the biggest thing a family will ever own, and
                we treat it that way. We are a people business that happens to
                buy property. That is why we will never make you an offer on a
                house we have not stood in.
              </p>
              <p>
                We show our workings, we say plainly what we are and what we are
                not, and whatever your circumstances you will get an honest
                steer from us. Even when that steer is to sell somewhere other
                than to us.
              </p>
              <p className="font-serif text-[19px] text-forest">
                Honesty and respect, both ways. That is the whole of it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ————— THE MARKET IS BROKEN —————
          Moved to the top of the page (founder review, Aug 2026), taking the
          slot the offer-maths breakdown used to hold further down. The
          argument runs problem → promise: here is what is wrong with selling a
          house in this country, and here is the sentence we are willing to be
          held to. */}
      <section id="broken" className="scroll-mt-24 px-3 py-4 md:px-6">
        <div className="mx-auto max-w-[1500px] rounded-[20px] bg-white md:rounded-[28px]">
          <div className="mx-auto max-w-6xl px-6 py-20 md:px-12 md:py-24">
            <div className="max-w-3xl">
              <Eyebrow tone="wax">why we exist</Eyebrow>
              <h2 className="mt-4 font-semibold font-serif text-4xl leading-[1.05] tracking-[-0.02em] md:text-5xl">
                The way we sell homes in this country is{' '}
                <span className="font-normal text-brand">broken.</span>
              </h2>
            </div>

            <dl className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-hair bg-hair sm:grid-cols-3">
              {[
                {
                  stat: '~1 in 3',
                  t: 'agreed sales collapse',
                  d: 'Roughly a third of sales agreed in England and Wales never reach completion.',
                  note: '1',
                },
                {
                  stat: '4–6 months',
                  t: 'from offer to keys',
                  d: 'The average conveyancing timeline, and it has been getting longer, not shorter.',
                  note: '2',
                },
                {
                  stat: '1–1.5%',
                  t: 'agent fee, plus VAT',
                  d: 'Paid by you, on completion, whether the sale was quick or agonising.',
                  note: '3',
                },
              ].map((s) => (
                <div key={s.t} className="bg-white p-7">
                  {/* The footnote marker rides the label, never the figure —
                      "~1 in 3" with a superscript 1 on it reads as "1 in 31". */}
                  <p className="font-bold font-serif text-4xl text-forest tracking-[-0.02em]">
                    {s.stat}
                  </p>
                  <p className="mt-2 font-serif text-[17px] text-brand">
                    {s.t}
                    <sup className="ml-1 align-super text-[11px] text-stone-400">
                      {s.note}
                    </sup>
                  </p>
                  <p className="mt-2 text-[14px] text-stone-600 leading-relaxed">
                    {s.d}
                  </p>
                </div>
              ))}
            </dl>

            <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
              <div>
                <p className="text-[17px] text-stone-700 leading-[1.7]">
                  Months of not knowing. A fee for the privilege. And a one in
                  three chance that after all of it, you are back where you
                  started.
                </p>
                <p className="mt-5 text-[17px] text-stone-700 leading-[1.7]">
                  We are the other way round.{' '}
                  <strong className="font-medium text-forest">
                    We can complete in as little as two weeks, and the price we
                    quote is the price we complete at.
                  </strong>{' '}
                  We will not come back and try to renegotiate. There are three
                  exceptions, written down here so you can hold us to them.
                </p>
              </div>
              <ul className="space-y-px overflow-hidden rounded-sm border border-hair bg-hair">
                {EXCEPTIONS.map((e) => (
                  <li key={e} className="flex items-start gap-4 bg-soft p-5">
                    <span className="mt-2.5 h-px w-4 shrink-0 bg-wax" />
                    <p className="text-[14px] text-stone-700 leading-relaxed">
                      {e}
                    </p>
                  </li>
                ))}
                <li className="bg-soft px-5 pt-2 pb-5">
                  <p className="text-[13px] text-stone-500 leading-relaxed">
                    In each case you can walk away at no cost. Nothing else
                    moves the price.
                  </p>
                </li>
              </ul>
            </div>

            <p className="mt-12 font-semibold font-serif text-2xl text-forest tracking-[-0.01em] md:text-3xl">
              A promise made is a promise{' '}
              <span className="font-normal text-brand">Kept.</span>
            </p>

            <ol className="mt-10 space-y-1 border-hair border-t pt-5 text-[11px] text-stone-500 leading-relaxed">
              <li>1. TwentyCi fall-through data, 2025.</li>
              <li>
                2. Typical UK residential conveyancing timeline from offer
                accepted to completion; your own transaction may be faster or
                slower.
              </li>
              <li>
                3. Typical UK high-street sole-agency fee range; your agent may
                charge more or less.
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* ————— REASONS / SITUATIONS —————
          Anchor target for the hero's self-selection row. */}
      <section
        id="situations"
        className="scroll-mt-24 px-6 py-20 md:px-12 md:py-24"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-3xl">
            <Eyebrow>who we buy from</Eyebrow>
            <h2 className="mt-4 font-semibold font-serif text-4xl leading-[1.05] tracking-[-0.02em] md:text-5xl">
              Real reasons people choose{' '}
              <span className="font-normal text-brand">certainty</span>, so they
              can focus on what matters most.
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

      {/* ————— 01 · HOW IT WORKS —————
          Four steps, not five. The indicative-offer step is gone: we no longer
          put any figure in front of a seller before we have viewed the
          property (founder decision, Aug 2026 — offers are reviewed by hand
          and sent by email until the AVM has earned more trust). */}
      <section id="how" className="scroll-mt-24 px-3 py-4 md:px-6">
        <div className="mx-auto max-w-[1500px] rounded-[20px] bg-white md:rounded-[28px]">
          <div className="mx-auto max-w-6xl px-6 py-24 md:px-12 md:py-28">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_2fr] lg:gap-16">
              <div>
                <SectionNumber>01</SectionNumber>
                <Eyebrow className="mt-5">how it works</Eyebrow>
                <h2 className="mt-4 font-semibold font-serif text-4xl leading-[1] tracking-[-0.02em] md:text-6xl">
                  Four steps.{' '}
                  <span className="font-normal text-brand">No surprises.</span>
                </h2>
                <p className="mt-6 text-[15px] text-stone-600 leading-relaxed">
                  We never price a home we have not seen, and we never send a
                  number a person has not checked. The price we confirm in
                  writing is the price we complete at.
                </p>
              </div>
              <ol className="divide-y divide-hair border-hair border-y">
                {[
                  {
                    n: '01',
                    t: 'You get in touch',
                    sla: 'Same day',
                    d: 'Tell us the address and a little about your situation. We come back to you the same day. Before we bother you for anything else, we pull what we can ourselves: Land Registry, EPC, planning.',
                  },
                  {
                    n: '02',
                    t: 'We come and see the property',
                    sla: 'At your convenience',
                    d: 'We view every property before we price it. We tell you in advance what we are looking for, so there is nothing to prepare and nothing to dread.',
                  },
                  {
                    n: '03',
                    t: 'Our offer, in writing',
                    sla: 'We aim for 24–48 hours after viewing',
                    d: 'The price we send is the price we complete at. We share the notes that informed it. Held for 72 hours, so you can take advice and talk it over with whoever you need to.',
                  },
                  {
                    n: '04',
                    t: 'Conveyancing and completion',
                    sla: 'At the pace you need',
                    d: 'You instruct your own solicitor, and we can recommend firms used to working quickly. We instruct ours straight away. Regular updates on a live timeline you can share with anyone. We pay our own legal costs.',
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
          </div>
        </div>
      </section>

      {/* ————— 02 · THE PROMISE —————
          Promoted into the slot the offer-maths breakdown used to hold. It
          answers the section above it: the market breaks its word, and this is
          ours, itemised. */}
      <section id="promise" className="scroll-mt-24 px-3 py-4 md:px-6">
        <div className="relative mx-auto max-w-[1500px] rounded-[20px] bg-brand-deep text-white md:rounded-[28px]">
          <div className="-top-10 absolute right-14 hidden md:block">
            <Seal className="border-wax/60 bg-cream shadow-[0_10px_24px_-12px_rgba(36,28,26,0.4)]" />
          </div>
          <div className="mx-auto max-w-6xl px-6 py-24 md:px-12 md:py-28">
            <div className="relative grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.4fr]">
              <div>
                <SectionNumber tone="light">02</SectionNumber>
                <Eyebrow tone="light" className="mt-5">
                  the written promise
                </Eyebrow>
                <h2 className="mt-4 font-semibold font-serif text-4xl leading-[1.05] tracking-[-0.02em] md:text-5xl">
                  No renegotiation.
                  <br />
                  <span className="font-normal text-leaf">A promise Kept.</span>
                </h2>
                <p className="mt-6 text-[15px] text-white/70 leading-relaxed">
                  The single biggest complaint about cash buyers is the
                  last-minute price drop. We put the price in writing and we
                  stand behind it.
                </p>
              </div>
              <dl className="divide-y divide-white/10 border-white/10 border-t">
                {[
                  [
                    'Offer validity',
                    'Binding upon Kept for 72 hours. Time-stamped, in writing, downloadable as a PDF.',
                  ],
                  [
                    'No price reduction',
                    'We do not renegotiate between issue and exchange. There are three documented exceptions: a survey reveals a material defect not visible at viewing, a title issue emerges that materially affects value, or information provided proves materially incorrect. In each case you can walk away at no cost.',
                  ],
                  [
                    'Your timeline',
                    'We work to the timeline that suits you. Fast when you need fast, as little as two weeks. Patient when you are waiting on a grant of probate, a court date, or somewhere to move to.',
                  ],
                  [
                    'Walk-away free',
                    'You may withdraw at any point before exchange. No penalty, no chase.',
                  ],
                  [
                    'Costs covered',
                    'No agent fee, and no fee to us at any point. You instruct your own solicitor and pay their costs; we pay ours.',
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
          </div>
        </div>
      </section>

      {/* ————— THE OFFER (CHAT) ————— */}
      <section id="offer" className="scroll-mt-24 px-6 py-24 md:px-12 md:py-28">
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 flex flex-col items-center text-center">
            <Eyebrow>get an offer</Eyebrow>
            <h2 className="mt-4 font-semibold font-serif text-4xl md:text-5xl">
              Tell us about the property.
            </h2>
            <p className="mt-4 text-stone-600">
              A few quick details, then we will be in touch the same day. We
              come and view the property before we put any figure to you, and
              when we do, it comes in writing.
            </p>
          </div>
          <Suspense fallback={<div className="h-96" />}>
            <ChatFlow defaultRole="seller" />
          </Suspense>
        </div>
      </section>

      {/* ————— A PERSON, NOT A PIPELINE ————— */}
      <section className="px-6 py-16 md:px-12 md:py-20">
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
              Comparable sales, title records, market trend: the desk research
              is automated, which is why it&rsquo;s fast. The judgment
              isn&rsquo;t. No figure reaches you until one of us has read it,
              checked it and put our name to it. Write to us and it&rsquo;s
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

      {/* ————— PROOF BAND ————— */}
      <ProofBand />

      {/* ————— FAQ ————— */}
      <section id="faq" className="scroll-mt-24 px-6 py-20 md:px-12 md:py-24">
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
      <section className="px-3 py-4 md:px-6">
        <div className="mx-auto max-w-[1500px] rounded-[20px] bg-soft md:rounded-[28px]">
          <div className="mx-auto max-w-6xl px-6 py-20 md:px-12 md:py-24">
            <Eyebrow>the honest version</Eyebrow>
            <h2 className="mt-4 font-semibold font-serif text-3xl leading-tight tracking-[-0.02em] md:text-5xl">
              When we&rsquo;re probably{' '}
              <span className="font-normal text-brand">not</span> the right
              answer
            </h2>
            <p className="mt-5 max-w-2xl text-[15px] text-stone-700 leading-relaxed">
              We buy below open market value, at a price that reflects the speed
              and certainty of the transaction. That trade is right for some
              sellers and wrong for others. We&rsquo;d rather tell you so up
              front than waste your time.
            </p>
            <ul className="mt-8 space-y-px overflow-hidden rounded-sm border border-hair bg-hair">
              {[
                {
                  t: 'You have plenty of time and no pressure to sell.',
                  d: 'If you can wait months for the right buyer, the open market will almost certainly get you a better price. Speed is the trade you’re paying for with us.',
                },
                {
                  t: 'Your property is in excellent condition and high demand.',
                  d: 'Family homes in popular streets, with no chain issues, usually sell fast at full market value through a good high-street agent. That’s their wedge, not ours.',
                },
                {
                  t: 'You want to maximise every pound of sale price.',
                  d: 'Our offer is below open-market value by design. If maximising is the goal, this isn’t the route.',
                },
              ].map((item) => (
                <li
                  key={item.t}
                  className="flex items-start gap-4 bg-white p-6"
                >
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
              genuinely suggest calling a local agent first. We&rsquo;d rather
              you sold well than sold to us.
            </p>
          </div>
        </div>
      </section>

      {/* ————— AGENTS LINK ————— */}
      <section className="px-6 py-12 md:px-12">
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
      <section className="px-3 py-4 md:px-6">
        <div className="relative mx-auto max-w-[1500px] overflow-hidden rounded-[20px] bg-brand-deep text-white md:rounded-[28px]">
          <div className="mx-auto max-w-6xl px-6 py-20 md:px-12 md:py-24">
            <div className="relative grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
              <div>
                <Eyebrow tone="light">talk to us</Eyebrow>
                <h2 className="mt-4 font-semibold font-serif text-5xl leading-[1] tracking-[-0.025em] md:text-7xl">
                  A real offer{' '}
                  <span className="font-normal text-leaf">in writing.</span>
                </h2>
              </div>
              <div className="lg:text-right">
                <Button href="#offer" variant="accent">
                  Get my offer
                </Button>
              </div>
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
              Kept is a UK cash property buyer, not an FCA-authorised firm. We
              do not provide financial or legal advice. Seek independent legal
              advice before accepting any offer. All offers are subject to
              satisfactory survey and title searches.
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
