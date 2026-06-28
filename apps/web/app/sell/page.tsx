import Link from 'next/link';
import { Suspense } from 'react';
import { ChatFlow } from '../instant-offer/components/chat-flow';
import {
  Button,
  Eyebrow,
  LogoLockup,
  Monogram,
  Seal,
  SectionNumber,
  StatusNote,
  Wordmark,
} from '@/components/brand';

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
    a: "Because we buy for cash, complete in 14–28 days, charge no fee, and take the risk of fall-through. Our typical offer is 75–87% of open-market value. You're paying us a speed premium for certainty.",
  },
  {
    q: 'Can I change my mind after I accept?',
    a: 'Yes. The offer is binding upon Bellwoods Lane for 72 hours. It is not binding upon you until exchange of contracts. You can withdraw at any point before exchange at no cost.',
  },
  {
    q: 'What does it cost me?',
    a: 'Zero. No agent fee. No solicitor fee (if you use our panel). No survey fee. The figure you see in the offer is the figure that lands in your account on completion day.',
  },
  {
    q: 'How is the offer calculated?',
    a: "We pull every comparable sale within 0.5 miles of your home from HM Land Registry's last 24 months, adjust for market trend, score risk factors, then apply a transparent speed-premium discount. The full methodology is published.",
  },
  {
    q: 'How quickly can you complete?',
    a: 'In weeks rather than months, paced to suit a probate grant or onward move. We instruct solicitors within 24 hours of acceptance and share proof of funds the same day.',
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
  { href: '#faq', label: 'FAQ' },
  { href: '/instant-offer/methodology', label: 'Methodology' },
  { href: '/agents', label: 'For agents' },
];

/** The signed cash-offer letter, the hero artifact. A real typed document,
 *  not type on a flat field: Caslon letterhead, Courier body, wax seal. */
function OfferLetter() {
  return (
    <div className="relative w-[290px] -rotate-[1.6deg] rounded-[2px] border border-[#E2D7CF] bg-[#FFFEFB] p-6 shadow-[0_28px_52px_-24px_rgba(36,28,26,0.5)]">
      <div className="absolute -right-5 -top-5 hidden sm:block">
        <Seal />
      </div>
      <p className="font-serif text-[17px] font-bold tracking-[0.01em] text-brand-deep">
        Bellwoods Lane
      </p>
      <p className="mt-1 text-[11px] text-stone-400 [font-family:var(--font-courier)]">
        Sample &middot; Ref BW-2026-0142
      </p>
      <div className="mt-4 border-t border-[#EAE0D9] pt-3">
        <p className="text-[11px] text-stone-400 [font-family:var(--font-courier)]">
          PROPERTY
        </p>
        <p className="mt-1 font-serif text-[15px] leading-snug text-[#352B27]">
          14 Acacia Avenue, Stockport SK4 3HQ
        </p>
      </div>
      <div className="mt-3 border-t border-[#EAE0D9] pt-3">
        <p className="text-[11px] text-brand [font-family:var(--font-courier)]">
          OUR CASH OFFER
        </p>
        <p className="mt-1 font-serif text-[40px] font-bold leading-none text-[#241C1A]">
          £244,000
        </p>
        <p className="mt-1.5 text-[11px] text-stone-500 [font-family:var(--font-courier)]">
          83% of mid AVM &middot; locked 72 hours
        </p>
      </div>
      <dl className="mt-3 space-y-2 border-t border-[#EAE0D9] pt-3 text-[12px] text-stone-600 [font-family:var(--font-courier)]">
        <div className="flex justify-between gap-6">
          <dt>Completion</dt>
          <dd className="text-[#352B27]">Weeks, not months</dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt>Walk-away cover</dt>
          <dd className="text-[#352B27]">£1,000 + costs</dd>
        </div>
      </dl>
      <svg viewBox="0 0 130 30" className="mt-3 h-6 w-28" aria-hidden="true">
        <path
          d="M3 21 C 13 3, 22 5, 23 17 S 36 27, 43 13 C 47 5, 54 23, 64 14 C 74 5, 83 25, 102 7 C 111 1, 120 5, 127 11"
          fill="none"
          stroke="#2C2320"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <p className="mt-1 font-serif text-[11px] italic text-stone-400">
        Signed for Bellwoods Lane Ltd
      </p>
    </div>
  );
}

export default function SellPage() {
  return (
    <>
      {/* ————— NAV ————— */}
      <header className="sticky top-0 z-40 border-b border-[#EBE1DB]/70 bg-[#FBF8F5]/85 backdrop-blur-md">
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

      {/* ————— HERO ————— */}
      <section className="relative overflow-hidden px-6 pt-20 pb-20 md:px-12 md:pt-24 md:pb-24">
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[1.05fr_0.95fr] md:gap-10">
          <div>
            <Eyebrow>for UK homeowners</Eyebrow>
            <h1
              className="mt-5 font-serif font-bold leading-[1.07] text-[#241C1A]"
              style={{ fontSize: 'clamp(40px, 5.4vw, 62px)' }}
            >
              A real cash offer,
              <br />
              <span className="italic font-normal text-brand">in writing.</span>
            </h1>
            <p className="mt-6 max-w-md text-[17px] leading-relaxed text-stone-600">
              An indicative figure in 4 business hours. After we visit, a
              confirmed, signed price within 24 hours, locked for 72 hours so you
              can take advice. The price we put in writing is the price we
              complete at.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Button href="#offer">Get a cash offer</Button>
              <Button href="/instant-offer/methodology" variant="ghost">
                See how we calculate offers
              </Button>
            </div>
            <p className="mt-7 text-[13px] text-stone-500 [font-family:var(--font-courier)]">
              Every confirmed offer is a signed document like this one.
            </p>
            <p className="mt-4 font-serif text-[13px] italic text-stone-500">
              Property Redress Scheme &middot; HMRC AML supervised &middot; ICO
              registered &middot; Zero fees
            </p>
          </div>
          <div className="flex justify-center md:justify-end">
            <OfferLetter />
          </div>
        </div>
      </section>

      {/* ————— HOW IT WORKS ————— */}
      <section
        id="how"
        className="border-y border-[#EBE1DB]/70 bg-white px-6 py-24 md:px-12 md:py-28"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <SectionNumber>01</SectionNumber>
            <Eyebrow className="mt-5">how it works</Eyebrow>
            <h2 className="mt-4 font-serif text-4xl font-semibold leading-[1] tracking-[-0.02em] md:text-6xl">
              Five steps.{' '}
              <span className="italic font-normal text-brand">No surprises.</span>
            </h2>
            <p className="mt-6 text-[15px] leading-relaxed text-stone-600">
              Every offer is generated from real comparable sales. The maths are
              published. Nothing hidden. The price we confirm in writing is the
              price we complete at.
            </p>
          </div>
          <ol className="divide-y divide-[#EBE1DB] border-y border-[#EBE1DB]">
            {[
              {
                n: '01',
                t: 'You get in touch',
                sla: '4 business hours',
                d: 'Tell us the address and a little about your situation. We acknowledge receipt within 4 business hours and pull what we can from public records — Land Registry, EPC, planning — before bothering you for anything else.',
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
                sla: 'Within 24 hours of viewing',
                d: 'The price we send is the price we complete at. We share the survey notes that informed it. Locked for 72 hours so you can take advice. Walk-away cover £1,000 + costs.',
              },
              {
                n: '05',
                t: 'Conveyancing and completion',
                sla: 'Paced to suit you',
                d: 'You instruct your own solicitor (your choice — we never require ours). We instruct ours same-day. Regular updates on a live timeline you can share with anyone. We pay all our legal costs.',
              },
            ].map((s) => (
              <li
                key={s.n}
                className="grid grid-cols-[44px_1fr] items-start gap-5 py-6 md:grid-cols-[56px_1fr_170px] md:gap-7"
              >
                <span className="font-serif text-3xl font-light text-brand-deep/30 tabular-nums">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-serif text-lg font-semibold md:text-xl">
                    {s.t}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-stone-600">
                    {s.d}
                  </p>
                </div>
                <p className="font-serif text-sm italic text-brand md:text-right">
                  {s.sla}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ————— REASONS / SITUATIONS ————— */}
      <section className="border-b border-[#EBE1DB]/70 bg-[#F6ECE7] px-6 py-24 md:px-12 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-3xl">
            <Eyebrow>who we buy from</Eyebrow>
            <h2 className="mt-4 font-serif text-4xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-5xl">
              Real reasons people choose{' '}
              <span className="italic font-normal text-brand">certainty</span>{' '}
              over price.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {REASONS.map((r) => (
              <div
                key={r.k}
                className="rounded-sm border border-[#E4D8D1] bg-white p-7 transition-shadow hover:shadow-[0_24px_48px_-32px_rgba(43,34,32,0.4)]"
              >
                <p className="font-serif text-sm italic text-brand">{r.k}</p>
                <p className="mt-3 font-serif text-xl font-semibold">{r.t}</p>
                <p className="mt-3 text-sm leading-relaxed text-stone-600">
                  {r.b}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ————— THE OFFER (CHAT) ————— */}
      <section
        id="offer"
        className="border-b border-[#EBE1DB]/70 px-6 py-24 md:px-12 md:py-28"
      >
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 flex flex-col items-center text-center">
            <Eyebrow>get an offer</Eyebrow>
            <h2 className="mt-4 font-serif text-4xl font-semibold md:text-5xl">
              Tell us about your home.
            </h2>
            <p className="mt-4 text-stone-600">
              A few quick details. A real binding offer back the same day — not
              an estimate.
            </p>
          </div>
          <Suspense fallback={<div className="h-96" />}>
            <ChatFlow defaultRole="seller" />
          </Suspense>
        </div>
      </section>

      {/* ————— PROMISE ————— */}
      <section className="relative overflow-hidden border-b border-[#EBE1DB]/70 bg-brand-deep px-6 py-24 text-white md:px-12 md:py-28">
        <Monogram
          aria-hidden
          className="pointer-events-none absolute -bottom-16 -right-16 h-80 w-auto opacity-[0.06]"
        />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <Eyebrow tone="light">the written promise</Eyebrow>
            <h2 className="mt-4 font-serif text-4xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-5xl">
              No re-trade.
              <br />
              <span className="italic font-normal text-[#f0c9c0]">
                No surprises.
              </span>
            </h2>
            <p className="mt-6 text-[15px] leading-relaxed text-white/70">
              The single biggest complaint about cash buyers is the last-minute
              price drop. We make it contractually impossible.
            </p>
            <Seal label="Bellwoods Lane" className="mt-10 hidden lg:inline-flex" />
          </div>
          <dl className="divide-y divide-white/10 border-t border-white/10">
            {[
              ['Offer validity', 'Legally binding upon Bellwoods Lane for 72 hours. Time-stamped, in writing, downloadable as PDF.'],
              ['No re-trade', 'We cannot reduce the offer between issue and exchange. The only exception is a survey-disclosed material defect, in which case you can walk away free.'],
              ['Walk-away free', 'You may withdraw at any point before exchange. No penalty, no chase.'],
              ['Costs covered', 'We pay solicitors (if you use our panel), searches, and survey. Zero fees to you.'],
              ['Fall-through cover', 'If we walk without cause, we reimburse your costs plus £1,000.'],
            ].map(([k, v]) => (
              <div
                key={k as string}
                className="grid grid-cols-1 gap-2 py-5 sm:grid-cols-[180px_1fr] sm:gap-8"
              >
                <dt className="font-serif text-[15px] italic text-[#f0c9c0]">
                  {k}
                </dt>
                <dd className="text-white/90">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ————— FAQ ————— */}
      <section
        id="faq"
        className="border-b border-[#EBE1DB]/70 px-6 py-24 md:px-12 md:py-28"
      >
        <div className="mx-auto max-w-3xl">
          <Eyebrow>honest answers</Eyebrow>
          <h2 className="mt-4 font-serif text-4xl font-semibold md:text-5xl">
            Questions sellers ask us most.
          </h2>
          <div className="mt-12 divide-y divide-[#EBE1DB] border-y border-[#EBE1DB]">
            {FAQ.map((item, i) => (
              <details key={item.q} className="group py-5" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-serif text-[18px] text-brand-deep">
                  <span>{item.q}</span>
                  <span className="ml-4 font-serif text-2xl font-light text-brand transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-4 leading-relaxed text-stone-600">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ————— WHEN NOT TO USE BELLWOODS ————— */}
      <section className="border-b border-[#EBE1DB]/70 bg-[#F6ECE7] px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-4xl">
          <Eyebrow>the honest version</Eyebrow>
          <h2 className="mt-4 font-serif text-3xl font-semibold leading-tight tracking-[-0.02em] md:text-5xl">
            When we&rsquo;re probably{' '}
            <span className="italic font-normal text-brand">not</span> the right
            answer
          </h2>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-stone-700">
            We buy at 65&ndash;75% of open market value. That trade is right for
            some sellers and wrong for others. We&rsquo;d rather tell you so up
            front than waste your time.
          </p>
          <ul className="mt-8 space-y-px overflow-hidden rounded-sm border border-[#E4D8D1] bg-[#E4D8D1]">
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
                  <p className="font-serif text-[17px] font-semibold text-[#2B2220]">
                    {item.t}
                  </p>
                  <p className="mt-1 text-[14px] leading-relaxed text-stone-600">
                    {item.d}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-2xl text-[14px] leading-relaxed text-stone-600">
            If you read those and one of them describes you, we&rsquo;d genuinely
            suggest calling a local agent first. We&rsquo;d rather you sold well
            than sold to us.
          </p>
        </div>
      </section>

      {/* ————— AGENTS LINK ————— */}
      <section className="border-b border-[#EBE1DB]/70 bg-white px-6 py-14 md:px-12">
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
          <Monogram
            aria-hidden
            className="pointer-events-none absolute -bottom-12 right-6 h-64 w-auto opacity-[0.07]"
          />
          <div className="relative grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
            <div>
              <Eyebrow tone="light">see the number</Eyebrow>
              <h2 className="mt-4 font-serif text-5xl font-semibold leading-[1] tracking-[-0.025em] md:text-7xl">
                A real offer{' '}
                <span className="italic font-normal text-[#f0c9c0]">
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
      <footer className="bg-[#FBF8F5] px-6 py-16 md:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div className="flex items-center gap-4">
              <Seal label="Est. 2026" />
              <div className="pl-1">
                <Wordmark ventures className="text-base" />
                <p className="mt-2 font-serif text-sm italic text-stone-500">
                  Direct-to-vendor property buyers &middot; UK
                </p>
              </div>
            </div>
            <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-stone-600">
              <a href="#offer" className="hover:text-brand-deep">
                Get an offer
              </a>
              <Link href="/instant-offer/methodology" className="hover:text-brand-deep">
                Methodology
              </Link>
              <Link href="/why-we-wont-buy-any-home" className="hover:text-brand-deep">
                What we won&rsquo;t buy
              </Link>
              <Link href="/agents" className="hover:text-brand-deep">
                For agents
              </Link>
              <Link href="/legal/fca-disclosure" className="hover:text-brand-deep">
                Regulatory
              </Link>
            </nav>
          </div>
          <div className="mt-10 border-t border-[#EBE1DB] pt-6">
            <p className="text-[11px] leading-relaxed text-stone-500">
              Bellwoods Lane Ltd is a UK cash property buyer, not an
              FCA-authorised firm. We do not provide financial or legal advice.
              Seek independent legal advice before accepting any offer. All offers
              are subject to satisfactory survey and title searches.
            </p>
            <p className="mt-4 text-[11px] text-stone-400">
              © {new Date().getFullYear()} Bellwoods Lane Ltd.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
