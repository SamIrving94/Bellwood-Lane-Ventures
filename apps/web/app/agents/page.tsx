import Link from 'next/link';
import { Suspense } from 'react';
import { database } from '@repo/database';
import { ChatFlow } from '../instant-offer/components/chat-flow';
import { LivePill } from '../instant-offer/components/live-pill';
import { ProofOfFundsButton } from '../instant-offer/components/proof-of-funds-button';

export const revalidate = 300;

async function getPublicStats() {
  try {
    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );
    const [quotes, completedDeals, agents] = await Promise.all([
      database.quoteRequest.count({
        where: { status: { not: 'draft' }, createdAt: { gte: startOfMonth } },
      }),
      database.deal.count({ where: { status: 'completed' } }),
      database.agentAccount.count(),
    ]);
    return { quotes, completedDeals, agents };
  } catch {
    return { quotes: 0, completedDeals: 0, agents: 0 };
  }
}

const SITUATIONS_WE_BUY: Array<{ k: string; t: string; b: string }> = [
  {
    k: 'Chain break',
    t: 'Buyer pulled out at exchange',
    b: 'You spent 4 months getting this to exchange. We complete in 18 days so the chain holds and your fee survives.',
  },
  {
    k: 'Probate',
    t: 'IHT clock ticking',
    b: 'HMRC charges 8.75% interest after 6 months. Executors stuck waiting on probate need a buyer who can flex completion to the grant date.',
  },
  {
    k: 'Repossession',
    t: 'LPA receiver instructed',
    b: 'Receivers have a duty to sell. We complete in 14 days with proof of funds in your hand before instruction.',
  },
  {
    k: 'Problem property',
    t: 'Knotweed · short lease · cladding',
    b: 'Properties no high-street lender will mortgage. We buy them at fair value and absorb the risk.',
  },
  {
    k: 'Long-stalled listing',
    t: 'Sole agency window closing',
    b: "About to lose the instruction? We rescue the listing with a cash offer your client can compare against the open market.",
  },
  {
    k: 'Distressed seller',
    t: 'Divorce · bankruptcy · relocation',
    b: 'Court-mandated dates. International signatories. Empty properties bleeding council tax. Speed is the product.',
  },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'When do I get paid?',
    a: 'On completion of our purchase from your client. We pay your standard sale fee, plus 1% + VAT introducer fee, plus 1% + VAT when we resell through you. All disclosed to the seller in writing per NTS guidance.',
  },
  {
    q: 'Will my client think I sold them short?',
    a: "No — because the offer is below open-market by a published, defensible margin (a 'speed premium' for cash + 18-day completion + zero fall-through risk). You hand them the methodology page and a signed offer. They make the call.",
  },
  {
    q: 'Can I show my client your offer document?',
    a: "Yes. We email a signed PDF certificate within 60 seconds of you submitting the property. It's legally binding upon us for 72 hours — your client has time to seek independent advice.",
  },
  {
    q: 'What about my AML obligations on the seller?',
    a: 'We carry the load. Bellwoods Lane is HMRC-registered for AML supervision. We run KYC and source-of-funds checks, then issue a written compliance receipt for your file. HMRC fined 551 agents £3.25M last year — we make sure you’re not next.',
  },
  {
    q: 'What if my client decides to stay on the open market?',
    a: 'You instruct the property as normal. We pay you a small introducer fee for the lead. No referral wasted, no awkward conversation.',
  },
  {
    q: "What's your completion rate?",
    a: 'We are a new firm and committed to publishing our completion rate quarterly from launch — including failures. Our promise: any offer issued is binding for 72 hours, and any post-survey adjustment requires a disclosed material defect. If we walk without cause, we pay £1,000 plus your costs.',
  },
  {
    q: 'How do I refer?',
    a: "Submit the property below or email us the address + situation. We send you a signed offer within 24 hours. There's no contract to sign — just a written disclosure for your seller.",
  },
  {
    q: 'Are you regulated?',
    a: "Cash property buying is unregulated by the FCA. We voluntarily follow The Property Ombudsman code and are NAPB members. See our regulatory disclosure for full detail.",
  },
];

export default async function AgentsPage() {
  const stats = await getPublicStats();

  return (
    <>
      {/* ————— NAV ————— */}
      <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-[#FAFAF7]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10">
          <Link
            href="/agents"
            className="font-serif text-xl font-semibold tracking-tight"
          >
            BELLWOODS
            <span className="mx-2 inline-block h-px w-8 bg-[#C6A664] align-middle" />
            <span className="text-sm font-normal tracking-[0.22em] text-slate-500">
              LANE
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-[13px] text-slate-600 md:flex">
            <a href="#earnings" className="hover:text-[#0A2540]">
              Earnings
            </a>
            <a href="#promise" className="hover:text-[#0A2540]">
              No re-trade
            </a>
            <a href="#tiers" className="hover:text-[#0A2540]">
              Tiers
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
            <Link href="/sell" className="hover:text-[#0A2540]">
              For sellers
            </Link>
            <Link
              href="/partners/login"
              className="rounded-full border border-slate-300 px-4 py-2 transition hover:border-slate-400"
            >
              Partner sign in
            </Link>
            <a
              href="#submit"
              className="rounded-full bg-[#0A2540] px-5 py-2 text-white transition hover:bg-[#13365c]"
            >
              Submit a deal
            </a>
          </nav>
        </div>
      </header>

      {/* ————— HERO ————— */}
      <section className="px-6 pt-16 pb-12 md:px-12 md:pt-20 md:pb-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <LivePill>For UK estate agents</LivePill>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
              No signup · Just start referring
            </span>
          </div>
          <h1
            className="font-serif font-semibold leading-[0.98] tracking-[-0.025em] text-[#0A1020]"
            style={{ fontSize: 'clamp(48px, 7vw, 88px)' }}
          >
            Save the deal.
            <br />
            Keep the commission.
            <br />
            <span className="italic text-[#C6A664]">In&nbsp;eighteen&nbsp;days.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-slate-600 md:mt-10">
            When a chain breaks, probate stalls, or a buyer walks — Bellwoods
            Lane buys in 18&nbsp;days. You earn up to{' '}
            <strong className="font-semibold text-[#0A1020]">
              3%&nbsp;+&nbsp;VAT
            </strong>
            . Your client thinks you&rsquo;re a hero. Your fee survives the
            chain.
          </p>

          <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <a
              href="#submit"
              className="inline-flex items-center gap-2 rounded-full bg-[#C6A664] px-8 py-4 text-[15px] font-medium text-[#0A1020] shadow-sm transition hover:bg-[#b08f52]"
            >
              Submit a deal in 60 seconds
              <span aria-hidden>→</span>
            </a>
            <Link
              href="/instant-offer/partner-brief"
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-8 py-4 text-[15px] text-slate-700 transition hover:border-slate-400"
            >
              Read the partner brief
            </Link>
          </div>
        </div>
      </section>

      {/* ————— PAIN STATS ————— */}
      <section className="border-y border-slate-200/60 bg-[#0A2540] px-6 py-16 text-white md:px-12">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
            What fall-throughs cost UK agents
          </p>
          <h2 className="mt-3 font-serif text-3xl font-semibold leading-tight md:text-5xl">
            The pain we exist to solve.
          </h2>
          <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
            {[
              { v: '£392M', l: 'Lost in agent fees to fall-throughs (Rightmove, 2024)' },
              { v: '23%', l: 'Of agreed UK sales collapse before completion (TwentyCi)' },
              { v: '£17,500', l: 'Average annual loss per agent on chain breaks alone' },
              { v: '551', l: 'UK agents fined for AML breaches in 2023–24 (HMRC)' },
            ].map((s) => (
              <div key={s.v}>
                <p
                  className="font-serif font-semibold tracking-[-0.025em] text-white"
                  style={{ fontSize: 'clamp(40px, 5vw, 64px)' }}
                >
                  {s.v}
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-white/70">
                  {s.l}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ————— EARNINGS ————— */}
      <section
        id="earnings"
        className="border-b border-slate-200/60 px-6 py-24 md:px-12"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
              How you earn
            </p>
            <h2 className="mt-3 font-serif text-4xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-6xl">
              Up to{' '}
              <span className="text-[#C6A664]">3% + VAT</span>
              <br />
              per referral.
            </h2>
            <p className="mt-6 text-[15px] leading-relaxed text-slate-600">
              Most cash buyers either undercut your fee or treat you as the
              enemy. We pay you on every leg of the deal — explicitly,
              disclosed in writing to the seller, and never in cash on the
              side.
            </p>
            <div className="mt-8 rounded-2xl bg-[#FAF6EA] p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
                Worked example
              </p>
              <p className="mt-2 text-sm text-slate-700">
                A £280k chain-break sale that would otherwise collapse:
              </p>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between border-b border-slate-200 py-2">
                  <dt>Sale fee (1% + VAT)</dt>
                  <dd className="font-medium">£3,360</dd>
                </div>
                <div className="flex justify-between border-b border-slate-200 py-2">
                  <dt>Introducer fee (1% + VAT)</dt>
                  <dd className="font-medium">£3,360</dd>
                </div>
                <div className="flex justify-between border-b border-slate-200 py-2">
                  <dt>Resale instruction (1% + VAT)</dt>
                  <dd className="font-medium">£3,360</dd>
                </div>
                <div className="flex justify-between pt-2 text-base">
                  <dt className="font-semibold">You earn</dt>
                  <dd className="font-semibold text-[#C6A664]">£10,080</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="space-y-4">
            {[
              {
                pct: '1%',
                t: 'Sale fee',
                b: 'The standard seller-side commission you would have earned on the open market — we pay it on our purchase completion.',
              },
              {
                pct: '1%',
                t: 'Introducer fee',
                b: 'Stacked on top, paid to you on the same day. Your reward for bringing the deal to a buyer who can actually complete.',
              },
              {
                pct: '1%',
                t: 'Resale instruction',
                b: 'When we resell, you list it. You earn again — same property, second commission, no chain risk this time.',
              },
            ].map((s) => (
              <div
                key={s.t}
                className="grid grid-cols-[80px_1fr] items-start gap-6 rounded-2xl border border-slate-200 bg-white p-6"
              >
                <p className="font-serif text-5xl font-semibold leading-none text-[#C6A664]">
                  {s.pct}
                </p>
                <div>
                  <p className="font-serif text-xl font-semibold">{s.t}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {s.b}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ————— NO RE-TRADE ————— */}
      <section
        id="promise"
        className="border-b border-slate-200/60 bg-[#FAF6EA] px-6 py-24 md:px-12"
      >
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 max-w-3xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
              The promise no other UK cash buyer makes
            </p>
            <h2 className="mt-3 font-serif text-4xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-6xl">
              No re-trade.
              <br />
              Ever. In writing.
            </h2>
            <p className="mt-6 text-[15px] leading-relaxed text-slate-600">
              Gazundering — quietly reducing the offer days before exchange
              — is the single biggest complaint UK estate agents have about
              cash buyers. We contractually can&rsquo;t do it.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                n: '01',
                t: 'Written guarantee',
                b: 'The price in your offer document is the price at completion. Bellwoods Lane is liable for £1,000 plus your costs if we walk without cause.',
              },
              {
                n: '02',
                t: 'One disclosed exception',
                b: 'Adjustable only if a RICS survey reveals a material issue you did not know about. Your client has 48 hours to walk away free of charge.',
              },
              {
                n: '03',
                t: 'Quarterly published rate',
                b: 'We commit to publishing our completion rate every quarter — including failures. No competitor in the UK does this.',
              },
            ].map((item) => (
              <div
                key={item.n}
                className="rounded-2xl border border-[#C6A664]/30 bg-white p-7"
              >
                <span className="font-serif text-[24px] italic text-[#C6A664]">
                  {item.n}
                </span>
                <p className="mt-4 font-serif text-xl font-semibold">
                  {item.t}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  {item.b}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ————— WHO WE BUY FROM ————— */}
      <section className="border-b border-slate-200/60 px-6 py-24 md:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-3xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
              The deals we buy
            </p>
            <h2 className="mt-3 font-serif text-4xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-5xl">
              We exist for the deals other buyers can&rsquo;t do.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {SITUATIONS_WE_BUY.map((s) => (
              <div
                key={s.k}
                className="rounded-2xl border border-slate-200 bg-white p-6"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#C6A664]">
                  {s.k}
                </p>
                <p className="mt-3 font-serif text-xl font-semibold">{s.t}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  {s.b}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ————— SUBMIT (CHAT) ————— */}
      <section
        id="submit"
        className="border-b border-slate-200/60 px-6 py-24 md:px-12"
      >
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
              Submit a deal
            </p>
            <h2 className="mt-3 font-serif text-4xl font-semibold md:text-5xl">
              Tell us about the property.
            </h2>
            <p className="mt-4 text-slate-600">
              Sixty seconds. Real binding offer, not an estimate. We auto-create
              your referral code on the offer card — bookmark it, share it,
              earn from every seller you send our way.
            </p>
          </div>
          <Suspense fallback={<div className="h-96" />}>
            <ChatFlow defaultRole="agent" />
          </Suspense>
        </div>
      </section>

      {/* ————— AML COMPLIANCE ————— */}
      <section className="border-b border-slate-200/60 bg-[#0A2540] px-6 py-24 text-white md:px-12">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
              AML cover
            </p>
            <h2 className="mt-3 font-serif text-4xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-5xl">
              We give you a signed compliance receipt for your file.
            </h2>
          </div>
          <div className="space-y-4 text-[15px] leading-relaxed text-white/80">
            <p>
              HMRC fined <strong className="text-white">551 estate agents</strong>{' '}
              a total of <strong className="text-white">£3.25 million</strong> for
              AML breaches in 2023–24 alone. From December 2025 every fine
              carries an extra £2,000 sanction admin charge.
            </p>
            <p>
              Bellwoods Lane is HMRC-registered for AML supervision. We run
              full KYC and source-of-funds verification on every seller. You
              get a signed PDF receipt for your file — your audit trail, our
              liability.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ProofOfFundsButton />
              <Link
                href="/legal/fca-disclosure"
                className="rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm text-white/80 transition hover:border-white/40"
              >
                Regulatory disclosure
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ————— TIERS ————— */}
      <section
        id="tiers"
        className="border-b border-slate-200/60 px-6 py-24 md:px-12"
      >
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 max-w-3xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
              Partnership tiers
            </p>
            <h2 className="mt-3 font-serif text-4xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-5xl">
              The more you refer, the more we do.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {[
              {
                tier: 'Partner',
                req: 'First referral completed',
                perks: [
                  'Access to the agent portal',
                  '24-hour offer SLA',
                  'Standard fee schedule',
                ],
              },
              {
                tier: 'Preferred',
                req: '3+ completions',
                perks: [
                  '8-hour priority offer SLA',
                  'Co-branded landing page',
                  'Featured on our partner wall',
                ],
                highlight: true,
              },
              {
                tier: 'Elite',
                req: '10+ completions or 3 in 90 days',
                perks: [
                  'Dedicated relationship manager',
                  'CPD-accredited training sessions',
                  'Monthly league-table visibility',
                  'Case study features',
                ],
              },
            ].map((t) => (
              <div
                key={t.tier}
                className={`rounded-2xl p-7 ${
                  t.highlight
                    ? 'border-2 border-[#C6A664] bg-white shadow-lg shadow-[#C6A664]/10'
                    : 'border border-slate-200 bg-white'
                }`}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#C6A664]">
                  Bellwoods {t.tier}
                </p>
                <p className="mt-2 text-sm text-slate-600">{t.req}</p>
                <ul className="mt-6 space-y-2 text-sm">
                  {t.perks.map((p) => (
                    <li key={p} className="flex items-start gap-2">
                      <span className="mt-1.5 block h-1 w-1 rounded-full bg-[#C6A664]" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ————— EITHER OUTCOME ————— */}
      <section className="border-b border-slate-200/60 bg-[#FAF6EA] px-6 py-24 md:px-12">
        <div className="mx-auto max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
            Either-outcome reward
          </p>
          <h2 className="mt-3 font-serif text-4xl font-semibold leading-[1] tracking-[-0.02em] md:text-5xl">
            You earn whether your client takes our offer or not.
          </h2>
          <p className="mt-6 text-[15px] leading-relaxed text-slate-600">
            If your seller decides open-market is the right route, we instruct
            you to list. No wasted referral. No awkward conversation with
            your client.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border-2 border-[#C6A664] bg-white p-6">
              <p className="font-serif text-lg font-semibold">
                Cash offer accepted
              </p>
              <p className="mt-3 text-sm text-slate-600">
                You earn the full <strong>3% + VAT stack</strong> across our
                purchase and resale.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="font-serif text-lg font-semibold">
                Open-market chosen
              </p>
              <p className="mt-3 text-sm text-slate-600">
                We hand you the listing on standard terms + a small
                introducer fee for the warm lead.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ————— FAQ ————— */}
      <section
        id="faq"
        className="border-b border-slate-200/60 px-6 py-24 md:px-12"
      >
        <div className="mx-auto max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
            Agent FAQ
          </p>
          <h2 className="mt-3 font-serif text-4xl font-semibold md:text-5xl">
            The honest answers.
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

      {/* ————— STATS / SOCIAL PROOF ————— */}
      <section className="border-b border-slate-200/60 bg-white px-6 py-20 md:px-12">
        <div className="mx-auto max-w-4xl text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
            Live · {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </p>
          <div className="mt-6 grid grid-cols-3 gap-8">
            {[
              { v: stats.quotes, l: 'Offers issued this month' },
              { v: stats.completedDeals, l: 'Deals completed' },
              { v: stats.agents, l: 'Partner agents' },
            ].map((m) => (
              <div key={m.l}>
                <p className="font-serif text-5xl font-semibold tracking-[-0.025em] text-[#0A2540] md:text-6xl">
                  {m.v.toLocaleString('en-GB')}
                </p>
                <p className="mt-2 text-xs uppercase tracking-widest text-slate-500">
                  {m.l}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-xs text-slate-500">
            We commit to publishing live numbers from day one. No fabricated
            track records.
          </p>
        </div>
      </section>

      {/* ————— SELLERS LINK ————— */}
      <section className="border-b border-slate-200/60 bg-slate-50 px-6 py-12 md:px-12">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-center md:flex-row md:text-left">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
              Not an agent?
            </p>
            <p className="mt-1 font-serif text-xl">
              Selling your own property?
            </p>
          </div>
          <Link
            href="/sell"
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm text-slate-700 transition hover:border-slate-400"
          >
            Get a cash offer for your home →
          </Link>
        </div>
      </section>

      {/* ————— FINAL CTA ————— */}
      <section className="px-6 py-16 md:px-12">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-[32px] bg-[#0A2540] px-8 py-16 text-white md:px-16 md:py-20">
          <div className="grid grid-cols-1 items-end gap-10 lg:grid-cols-2">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
                Sixty seconds
              </p>
              <h2 className="mt-4 font-serif text-5xl font-semibold leading-[1] tracking-[-0.025em] md:text-7xl">
                Submit your next deal.
              </h2>
              <p className="mt-6 text-white/70">
                We auto-create your referral code. No signup, no contract.
              </p>
            </div>
            <div className="lg:text-right">
              <a
                href="#submit"
                className="inline-flex items-center gap-2 rounded-full bg-[#C6A664] px-8 py-4 text-[15px] font-medium text-[#0A1020] transition hover:bg-[#b08f52]"
              >
                Start now
                <span aria-hidden>→</span>
              </a>
              <p className="mt-4 text-xs text-white/50">
                Already a partner?{' '}
                <Link
                  href="/partners/login"
                  className="text-white/80 underline hover:text-white"
                >
                  Sign in to your dashboard
                </Link>
              </p>
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
              <a href="#submit">Submit a deal</a>
              <Link href="/instant-offer/methodology">Methodology</Link>
              <Link href="/instant-offer/team">Team</Link>
              <Link href="/sell">For sellers</Link>
              <Link href="/legal/fca-disclosure">Regulatory</Link>
              <Link href="/partners/login">Partner sign in</Link>
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
