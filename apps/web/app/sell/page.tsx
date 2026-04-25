import Link from 'next/link';
import { Suspense } from 'react';
import { ChatFlow } from '../instant-offer/components/chat-flow';
import { LivePill } from '../instant-offer/components/live-pill';

export const revalidate = 300;

const REASONS: Array<{ k: string; t: string; b: string }> = [
  {
    k: 'Probate',
    t: 'You inherited a property',
    b: "HMRC charges 8.75% interest on inheritance tax 6 months after the death. Empty homes accrue council tax + insurance. We complete fast so the estate doesn't bleed.",
  },
  {
    k: 'Chain break',
    t: 'Your buyer pulled out',
    b: "You've spent months getting to exchange. Don't lose your onward purchase. We step in with a binding offer and complete in 18 days.",
  },
  {
    k: 'Relocation',
    t: 'You\u2019re moving abroad or for work',
    b: "International signatures, time-zone delays, empty house syndrome — we handle it. You sign once, we complete on your timeline.",
  },
  {
    k: 'Divorce or separation',
    t: 'You need a clean break',
    b: 'Court-ordered timelines, joint mortgage to clear, emotional weight. We move quietly and quickly. Solicitors talk to solicitors.',
  },
  {
    k: 'Problem property',
    t: 'Knotweed, short lease, cladding, structural',
    b: "Properties high-street lenders won't touch. We buy them at fair value and absorb the risk.",
  },
  {
    k: 'Repossession risk',
    t: 'Mortgage arrears mounting',
    b: 'A controlled, voluntary sale beats a forced one. We pay on completion — before any repossession order can be filed.',
  },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'How is the offer calculated?',
    a: "We pull every comparable sale within 0.5 miles of your home from HM Land Registry's last 24 months, adjust for market trend (HPI), score risk factors, then apply a fair speed-premium discount. The calculation is published at /instant-offer/methodology.",
  },
  {
    q: 'Why is the offer below open-market?',
    a: "Because we buy for cash, complete in 14–28 days, charge no fee, and take the risk of fall-through. Our typical offer is 75–87% of open-market value. You're paying us a 'speed premium' for certainty.",
  },
  {
    q: 'How quickly can you complete?',
    a: 'We aim for 14–28 days. Probate cases adjust to your grant timeline. We instruct solicitors within 24 hours of acceptance and share proof of funds the same day.',
  },
  {
    q: 'What happens after I accept?',
    a: 'We instruct solicitors and order searches the same day. You get a written, time-stamped offer document. We commission a RICS Level 2 survey at our cost. Target completion 14–28 days.',
  },
  {
    q: 'Can the offer change later?',
    a: 'Only if a survey reveals a material issue you did not disclose (e.g. structural movement, hidden damp). We tell you within 48 hours and you can walk away free of charge.',
  },
  {
    q: 'What does it cost me?',
    a: 'Zero. No agent fee. No solicitor fee (if you use our panel). No survey fee. The offer you see is the amount that lands in your account on completion day.',
  },
  {
    q: "Can I change my mind?",
    a: "Yes. The offer is binding upon Bellwoods Lane for 72 hours. It is not binding upon you until exchange. You can withdraw at any point before exchange at no cost.",
  },
  {
    q: 'Are you regulated?',
    a: 'Cash property buying is unregulated by the FCA. We voluntarily follow The Property Ombudsman code and are members of the National Association of Property Buyers (NAPB). We are HMRC-registered for AML supervision. Full disclosure at /legal/fca-disclosure.',
  },
];

export default function SellPage() {
  return (
    <>
      {/* ————— NAV ————— */}
      <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-[#FAFAF7]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10">
          <Link
            href="/sell"
            className="font-serif text-xl font-semibold tracking-tight"
          >
            BELLWOODS
            <span className="mx-2 inline-block h-px w-8 bg-[#C6A664] align-middle" />
            <span className="text-sm font-normal tracking-[0.22em] text-slate-500">
              LANE
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-[13px] text-slate-600 md:flex">
            <a href="#how" className="hover:text-[#0A2540]">
              How it works
            </a>
            <a href="#faq" className="hover:text-[#0A2540]">
              FAQ
            </a>
            <Link
              href="/instant-offer/methodology"
              className="hover:text-[#0A2540]"
            >
              Methodology
            </Link>
            <Link href="/agents" className="hover:text-[#0A2540]">
              For agents
            </Link>
            <a
              href="#offer"
              className="rounded-full bg-[#0A2540] px-5 py-2 text-white transition hover:bg-[#13365c]"
            >
              Get an offer
            </a>
          </nav>
        </div>
      </header>

      {/* ————— HERO ————— */}
      <section className="px-6 pt-16 pb-12 md:px-12 md:pt-20 md:pb-16">
        <div className="mx-auto max-w-5xl">
          <LivePill>For UK homeowners</LivePill>
          <h1
            className="mt-8 font-serif font-semibold leading-[0.98] tracking-[-0.025em] text-[#0A1020]"
            style={{ fontSize: 'clamp(44px, 7vw, 80px)' }}
          >
            Sell your home in
            <br />
            eighteen days.
            <br />
            <span className="italic text-[#C6A664]">No fees. No chain.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-slate-600 md:mt-10">
            We buy any UK residential property directly with our own
            capital. Binding cash offer in 60 seconds. Completion in 14–28
            days. No agents to pay. No buyer to lose. No fees, ever.
          </p>

          <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <a
              href="#offer"
              className="inline-flex items-center gap-2 rounded-full bg-[#C6A664] px-8 py-4 text-[15px] font-medium text-[#0A1020] shadow-sm transition hover:bg-[#b08f52]"
            >
              Get a cash offer
              <span aria-hidden>→</span>
            </a>
            <Link
              href="/instant-offer/methodology"
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-8 py-4 text-[15px] text-slate-700 transition hover:border-slate-400"
            >
              See how we calculate offers
            </Link>
          </div>

          <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
            HMRC AML supervised · NAPB · TPO redress scheme · Zero fees
          </p>
        </div>
      </section>

      {/* ————— HOW IT WORKS ————— */}
      <section
        id="how"
        className="border-y border-slate-200/60 bg-white px-6 py-24 md:px-12"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
              How it works
            </p>
            <h2 className="mt-3 font-serif text-4xl font-semibold leading-[1] tracking-[-0.02em] md:text-6xl">
              Three steps.
              <br />
              No surprises.
            </h2>
            <p className="mt-6 text-[15px] leading-relaxed text-slate-600">
              Every offer is generated from real comparable sales. The
              maths are published. Nothing hidden.
            </p>
          </div>
          <div className="space-y-5">
            {[
              {
                n: '01',
                t: 'Tell us about your home',
                d: 'A short conversation — address, situation. Sixty seconds. No personal information needed for the offer.',
              },
              {
                n: '02',
                t: 'See the offer in writing',
                d: 'Real binding price, locked for 72 hours. Includes the comparables we used, the risk score, and our methodology — so you can compare to any other valuation.',
              },
              {
                n: '03',
                t: 'Complete in 14–28 days',
                d: 'Accept, and we instruct solicitors the same day. We pay all legal costs. The amount in the offer is the amount in your account on completion.',
              },
            ].map((s) => (
              <div
                key={s.n}
                className="grid grid-cols-[60px_1fr] items-start gap-6 rounded-2xl border border-slate-200 bg-white p-7"
              >
                <span className="font-serif text-[28px] italic text-[#C6A664]">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-serif text-2xl font-semibold">{s.t}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
                    {s.d}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ————— REASONS / SITUATIONS ————— */}
      <section className="border-b border-slate-200/60 bg-[#FAF6EA] px-6 py-24 md:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-3xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
              Who we buy from
            </p>
            <h2 className="mt-3 font-serif text-4xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-5xl">
              Real reasons people choose certainty over price.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {REASONS.map((r) => (
              <div
                key={r.k}
                className="rounded-2xl border border-[#C6A664]/20 bg-white p-6"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#C6A664]">
                  {r.k}
                </p>
                <p className="mt-3 font-serif text-xl font-semibold">{r.t}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
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
        className="border-b border-slate-200/60 px-6 py-24 md:px-12"
      >
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
              Get an offer
            </p>
            <h2 className="mt-3 font-serif text-4xl font-semibold md:text-5xl">
              Tell us about your home.
            </h2>
            <p className="mt-4 text-slate-600">
              Sixty seconds. Real binding offer, not an estimate.
            </p>
          </div>
          <Suspense fallback={<div className="h-96" />}>
            <ChatFlow defaultRole="seller" />
          </Suspense>
        </div>
      </section>

      {/* ————— PROMISE ————— */}
      <section className="border-b border-slate-200/60 bg-[#0A2540] px-6 py-24 text-white md:px-12">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
              The written promise
            </p>
            <h2 className="mt-3 font-serif text-4xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-5xl">
              No re-trade.
              <br />
              No surprises.
            </h2>
            <p className="mt-6 text-[15px] leading-relaxed text-white/70">
              The single biggest complaint about cash buyers is the
              last-minute price drop. We make it contractually impossible.
            </p>
          </div>
          <dl className="space-y-4">
            {[
              ['Offer validity', 'Legally binding upon Bellwoods Lane for 72 hours. Time-stamped, in writing, downloadable as PDF.'],
              ['No re-trade', 'We cannot reduce the offer between issue and exchange. The only exception is a survey-disclosed material defect, in which case you can walk away free.'],
              ['Walk-away free', 'You may withdraw at any point before exchange. No penalty, no chase.'],
              ['Costs covered', 'We pay solicitors (if you use our panel), searches, and survey. Zero fees to you.'],
              ['Fall-through cover', 'If we walk without cause, we reimburse your costs plus £1,000.'],
            ].map(([k, v]) => (
              <div
                key={k as string}
                className="grid grid-cols-1 gap-2 border-t border-white/10 pt-5 sm:grid-cols-[180px_1fr] sm:gap-8"
              >
                <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/50">
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
        className="border-b border-slate-200/60 px-6 py-24 md:px-12"
      >
        <div className="mx-auto max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
            Honest answers
          </p>
          <h2 className="mt-3 font-serif text-4xl font-semibold md:text-5xl">
            Questions sellers ask us most.
          </h2>
          <div className="mt-12 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
            {FAQ.map((item, i) => (
              <details key={item.q} className="group p-6" open={i === 0}>
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-serif text-lg font-semibold">
                  <span>{item.q}</span>
                  <span className="ml-4 text-xl text-slate-400 transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-4 leading-relaxed text-slate-600">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ————— AGENTS LINK ————— */}
      <section className="border-b border-slate-200/60 bg-slate-50 px-6 py-12 md:px-12">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-center md:flex-row md:text-left">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
              Are you an estate agent?
            </p>
            <p className="mt-1 font-serif text-xl">
              Earn up to 3% + VAT per referral.
            </p>
          </div>
          <Link
            href="/agents"
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm text-slate-700 transition hover:border-slate-400"
          >
            See the agent partner programme →
          </Link>
        </div>
      </section>

      {/* ————— FINAL CTA ————— */}
      <section className="px-6 py-16 md:px-12">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-[32px] bg-[#0A2540] px-8 py-16 text-white md:px-16 md:py-20">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
                See the number
              </p>
              <h2 className="mt-4 font-serif text-5xl font-semibold leading-[1] tracking-[-0.025em] md:text-7xl">
                Sixty seconds. Binding offer.
              </h2>
            </div>
            <div className="lg:text-right">
              <a
                href="#offer"
                className="inline-flex items-center gap-2 rounded-full bg-[#C6A664] px-8 py-4 text-[15px] font-medium text-[#0A1020] transition hover:bg-[#b08f52]"
              >
                Get my offer
                <span aria-hidden>→</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ————— FOOTER ————— */}
      <footer className="bg-white px-6 py-14 md:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div>
              <p className="font-serif text-xl font-semibold tracking-tight">
                BELLWOODS
                <span className="mx-2 inline-block h-px w-8 bg-[#C6A664] align-middle" />
                <span className="text-sm font-normal tracking-[0.22em] text-slate-500">
                  LANE
                </span>
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Direct-to-vendor property buyers · UK
              </p>
            </div>
            <nav className="flex flex-wrap items-center gap-6 text-sm text-slate-600">
              <a href="#offer">Get an offer</a>
              <Link href="/instant-offer/methodology">Methodology</Link>
              <Link href="/agents">For agents</Link>
              <Link href="/legal/fca-disclosure">Regulatory</Link>
            </nav>
          </div>
          <p className="mt-10 font-mono text-[11px] leading-relaxed text-slate-500">
            Bellwoods Lane Ltd is a UK cash property buyer, not an
            FCA-authorised firm. We do not provide financial or legal
            advice. Seek independent legal advice before accepting any
            offer. All offers are subject to satisfactory survey and title
            searches.
          </p>
          <p className="mt-4 font-mono text-[11px] text-slate-400">
            © {new Date().getFullYear()} Bellwoods Lane Ltd.
          </p>
        </div>
      </footer>
    </>
  );
}
