import Link from 'next/link';
import { Suspense } from 'react';
import { database } from '@repo/database';
import { ChatFlow } from './components/chat-flow';

export const revalidate = 300; // 5 minutes

async function getPublicStats() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [quotesThisMonth, totalDeals] = await Promise.all([
      database.quoteRequest.count({
        where: {
          status: { not: 'draft' },
          createdAt: { gte: startOfMonth },
        },
      }),
      database.deal.count({ where: { status: 'completed' } }),
    ]);
    return { quotesThisMonth, totalDeals };
  } catch {
    return { quotesThisMonth: 0, totalDeals: 0 };
  }
}

export default async function InstantOfferPage() {
  const stats = await getPublicStats();

  return (
    <>
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-[#FAFAF7]/80 backdrop-blur-md">
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
          <nav className="hidden items-center gap-8 text-sm text-slate-600 md:flex">
            <a href="#how-it-works" className="hover:text-[#0A2540]">
              How it works
            </a>
            <Link
              href="/instant-offer/methodology"
              className="hover:text-[#0A2540]"
            >
              Methodology
            </Link>
            <Link href="/instant-offer/team" className="hover:text-[#0A2540]">
              Team
            </Link>
            <a
              href="#chat"
              className="rounded-full bg-[#0A2540] px-5 py-2 text-white transition hover:bg-[#13365c]"
            >
              Get an offer
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-200/60 px-6 pb-24 pt-20 md:pt-28">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs text-slate-600 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1F6B3A] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1F6B3A]" />
            </span>
            Live · accepting new properties today
          </div>
          <h1 className="font-serif text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
            Sell in 18 days.
            <br />
            Cash. <span className="text-[#C6A664]">Guaranteed.</span>
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg text-slate-600 md:text-xl">
            The UK cash buyer built for estate agents. Instant offer.{' '}
            <strong className="font-semibold text-[#0A1020]">
              No re-trade.
            </strong>{' '}
            AML handled.{' '}
            <strong className="font-semibold text-[#0A1020]">
              Up to 3% + VAT commission protected.
            </strong>
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#chat"
              className="inline-flex items-center gap-2 rounded-full bg-[#C6A664] px-8 py-4 text-base font-medium text-[#0A1020] shadow-sm transition hover:bg-[#b08f52]"
            >
              Get an instant offer
              <span aria-hidden>→</span>
            </a>
            <Link
              href="/instant-offer/methodology"
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-8 py-4 text-base text-slate-700 transition hover:border-slate-400"
            >
              See how we price
            </Link>
          </div>
          <p className="mt-8 text-xs uppercase tracking-widest text-slate-500">
            HMRC-aligned · FCA-compliant disclosure · 72-hour offer lock
          </p>
        </div>

        {/* Subtle data visual */}
        <div className="relative mx-auto mt-20 max-w-4xl">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                label: 'HMLR comps',
                value: '47 matched',
                tint: 'from-slate-50 to-white',
              },
              {
                label: 'EPC · flood · risk',
                value: 'Low risk',
                tint: 'from-[#FAF6EA] to-white',
              },
              {
                label: 'Offer',
                value: '£182,400',
                tint: 'from-[#F2F6FA] to-white',
                highlight: true,
              },
            ].map((card) => (
              <div
                key={card.label}
                className={`rounded-2xl border border-slate-200 bg-gradient-to-br ${card.tint} p-6 shadow-sm`}
              >
                <p className="text-xs uppercase tracking-widest text-slate-500">
                  {card.label}
                </p>
                <p
                  className={`mt-2 font-serif text-2xl ${card.highlight ? 'text-[#0A2540]' : 'text-[#0A1020]'}`}
                >
                  {card.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chat section */}
      <section id="chat" className="border-b border-slate-200/60 px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs uppercase tracking-widest text-[#C6A664]">
              Instant offer
            </p>
            <h2 className="font-serif text-4xl font-semibold md:text-5xl">
              Tell us about the property.
            </h2>
            <p className="mt-4 text-slate-600">
              Takes 60 seconds. Real offer, not an estimate.
            </p>
          </div>
          <Suspense fallback={<div className="h-96" />}>
            <ChatFlow />
          </Suspense>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="border-b border-slate-200/60 px-6 py-24"
      >
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs uppercase tracking-widest text-[#C6A664]">
              How it works
            </p>
            <h2 className="font-serif text-4xl font-semibold md:text-5xl">
              Three steps. Sixty seconds.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                n: '01',
                title: 'Enter the property',
                desc: "Address and situation — that's it. Our chat walks you through the rest.",
              },
              {
                n: '02',
                title: '60-second valuation',
                desc: 'Real-time pull from HM Land Registry, EPC Register, Ordnance Survey, and our risk model.',
              },
              {
                n: '03',
                title: 'Legally binding offer',
                desc: 'Signed, time-stamped, locked for 72 hours. No subject-to. No games.',
              },
            ].map((step) => (
              <div
                key={step.n}
                className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
              >
                <p className="font-serif text-sm text-[#C6A664]">{step.n}</p>
                <h3 className="mt-4 font-serif text-2xl font-semibold">
                  {step.title}
                </h3>
                <p className="mt-3 text-slate-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="border-b border-slate-200/60 bg-[#0A2540] px-6 py-20 text-white">
        <div className="mx-auto max-w-5xl text-center">
          <p className="font-serif text-6xl font-semibold md:text-7xl">
            {stats.quotesThisMonth.toLocaleString('en-GB')}
          </p>
          <p className="mt-3 text-lg text-white/70">
            cash offers generated this month
          </p>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-white/50">
            <span>HM Land Registry</span>
            <span aria-hidden>·</span>
            <span>Energy Performance Register</span>
            <span aria-hidden>·</span>
            <span>Ordnance Survey</span>
            <span aria-hidden>·</span>
            <span>Companies House</span>
          </div>
        </div>
      </section>

      {/* The No Re-Trade Promise */}
      <section className="border-b border-slate-200/60 bg-[#FAF6EA] px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-14 text-center">
            <p className="mb-3 text-xs uppercase tracking-widest text-[#C6A664]">
              The one promise other buyers don&apos;t make
            </p>
            <h2 className="font-serif text-4xl font-semibold leading-tight md:text-5xl">
              No re-trade. Ever. In writing.
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
              Gazundering — reducing the offer days before completion — is the
              single biggest complaint estate agents have about cash buyers.
              We contractually can&apos;t do it.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                t: 'Written guarantee',
                b: 'The price in your offer document is the price at completion. Full stop.',
              },
              {
                t: 'One exception — disclosed',
                b: 'Only adjustable if a physical survey reveals material issues you did not know about. You have 48 hours to walk away, free.',
              },
              {
                t: 'Audited completion rate',
                b: 'We publish the percentage of offers we complete without adjustment. No competitor in the UK does.',
              },
            ].map((item) => (
              <div
                key={item.t}
                className="rounded-2xl border border-[#C6A664]/30 bg-white p-6 shadow-sm"
              >
                <p className="font-serif text-lg font-semibold">{item.t}</p>
                <p className="mt-3 text-sm text-slate-600">{item.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How agents earn */}
      <section className="border-b border-slate-200/60 px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs uppercase tracking-widest text-[#C6A664]">
              For estate agents
            </p>
            <h2 className="font-serif text-4xl font-semibold md:text-5xl">
              Earn up to 3% + VAT per referral.
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
              When a chain breaks or a distressed seller needs certainty, most
              agents lose the instruction — and the fee. With Bellwood you
              earn on every stage of the deal.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                pct: '1%',
                t: 'Sale fee',
                b: 'The standard seller-side commission you would have earned on the open market — we pay it.',
              },
              {
                pct: '1%',
                t: 'Introducer fee',
                b: 'Paid to you on top of the sale fee, on completion of our purchase from your seller.',
              },
              {
                pct: '1%',
                t: 'Resale instruction',
                b: 'When we resell, you list it. You earn again — with no chain risk the second time.',
              },
            ].map((s) => (
              <div
                key={s.t}
                className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
              >
                <p className="font-serif text-5xl font-semibold text-[#C6A664]">
                  {s.pct}
                </p>
                <p className="mt-2 text-xs uppercase tracking-widest text-slate-500">
                  + VAT
                </p>
                <p className="mt-4 font-serif text-xl font-semibold">{s.t}</p>
                <p className="mt-2 text-sm text-slate-600">{s.b}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-slate-500">
            All fees disclosed to the seller in writing per National Trading
            Standards guidance. No hidden structure.
          </p>
        </div>
      </section>

      {/* Partnership tiers */}
      <section className="border-b border-slate-200/60 bg-[#0A2540] px-6 py-24 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <p className="mb-3 text-xs uppercase tracking-widest text-[#C6A664]">
              Partnership tiers
            </p>
            <h2 className="font-serif text-4xl font-semibold md:text-5xl">
              The more you refer, the more we do.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
                className={`rounded-2xl p-8 ${
                  t.highlight
                    ? 'border border-[#C6A664] bg-white/5 shadow-lg shadow-[#C6A664]/10'
                    : 'border border-white/10 bg-white/[0.02]'
                }`}
              >
                <p className="text-xs uppercase tracking-widest text-[#C6A664]">
                  Bellwood {t.tier}
                </p>
                <p className="mt-2 text-sm text-white/60">{t.req}</p>
                <ul className="mt-6 space-y-2 text-sm text-white/90">
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

      {/* Agents — no signup needed */}
      <section className="border-b border-slate-200/60 bg-[#FAF6EA] px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-xs uppercase tracking-widest text-[#C6A664]">
            For estate agents
          </p>
          <h2 className="font-serif text-3xl font-semibold leading-tight md:text-4xl">
            No signup. Just start referring.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-slate-600">
            When you submit a property through the tool above as an agent,
            we auto-create your referral code on the spot and show it on
            the offer card. Bookmark it, share it with sellers, and we
            credit every introduction to you. The dashboard is optional.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4 text-sm">
            <a
              href="#chat"
              className="font-medium text-[#0A2540] underline underline-offset-4 hover:text-[#C6A664]"
            >
              Get an instant offer now →
            </a>
            <span className="text-slate-400">·</span>
            <Link
              href="/partners/login"
              className="text-slate-500 underline underline-offset-4 hover:text-[#0A2540]"
            >
              Already have an account?
            </Link>
          </div>
        </div>
      </section>

      {/* Either outcome */}
      <section className="border-b border-slate-200/60 px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-xs uppercase tracking-widest text-[#C6A664]">
            Either outcome reward
          </p>
          <h2 className="font-serif text-4xl font-semibold leading-tight md:text-5xl">
            You earn whether the seller takes our offer or not.
          </h2>
          <p className="mt-6 text-lg text-slate-600">
            If the seller decides open-market is the right route, we instruct
            you to list the property on standard commission. No wasted
            referral. No awkward conversation with your client.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-4 text-left md:grid-cols-2">
            <div className="rounded-xl bg-[#FAF6EA] p-5 text-sm text-slate-700">
              <p className="font-semibold">If they take the cash offer</p>
              <p className="mt-2 text-slate-600">
                You earn the full 3% + VAT stack across our purchase and
                resale.
              </p>
            </div>
            <div className="rounded-xl bg-white p-5 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200">
              <p className="font-semibold">If they choose open-market</p>
              <p className="mt-2 text-slate-600">
                We hand you the listing on standard terms. You earn your
                normal commission — with a warm lead we introduced.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Split audience */}
      <section className="border-b border-slate-200/60 px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {[
              {
                eyebrow: 'For estate agents',
                title: 'Your chain-break rescue tool.',
                bullets: [
                  'Up to 3% + VAT commission stack',
                  'Show your client a real offer on the call',
                  'Completion in weeks, not months',
                  'AML handled end-to-end — we give you a compliance receipt',
                ],
              },
              {
                eyebrow: 'For sellers',
                title: 'Stop waiting for the chain.',
                bullets: [
                  'No fees. No agents to pay',
                  'Sell in 14–28 days',
                  'Fair, explainable offer',
                  'No fall-throughs',
                ],
              },
            ].map((card) => (
              <div
                key={card.eyebrow}
                className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm"
              >
                <p className="text-xs uppercase tracking-widest text-[#C6A664]">
                  {card.eyebrow}
                </p>
                <h3 className="mt-4 font-serif text-3xl font-semibold leading-tight">
                  {card.title}
                </h3>
                <ul className="mt-8 space-y-3 text-slate-700">
                  {card.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-3">
                      <span className="mt-2 block h-1 w-1 rounded-full bg-[#C6A664]" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust stack */}
      <section className="border-b border-slate-200/60 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs uppercase tracking-widest text-[#C6A664]">
              Trust built in
            </p>
            <h2 className="font-serif text-4xl font-semibold md:text-5xl">
              Why agents and sellers bet on us.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: '72-hour offer lock',
                body: 'Once we make the offer, it is written and legally binding for 72 hours.',
              },
              {
                title: 'Proof of funds',
                body: 'Signed bank letter available on request before you share any details.',
              },
              {
                title: 'Named team',
                body: 'Real people with real track records. See the team.',
                href: '/instant-offer/team',
              },
              {
                title: 'Transparent methodology',
                body: 'We show our comps, risk scoring, and margin.',
                href: '/instant-offer/methodology',
              },
              {
                title: 'Independent solicitor',
                body: 'We cover your solicitor, or you use ours. Your choice.',
              },
              {
                title: 'AML compliance receipt',
                body: 'We run full KYC and source-of-funds checks on every seller. You get a signed receipt for your AML file — HMRC-ready.',
              },
              {
                title: 'Completion-or-compensation',
                body: 'If we fall through on our side, we compensate your costs.',
              },
              {
                title: 'NAPB · TPO · HMRC registered',
                body: 'Members of the National Association of Property Buyers, The Property Ombudsman, and HMRC-registered for anti-money-laundering supervision.',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
              >
                <h3 className="font-serif text-xl font-semibold">{card.title}</h3>
                <p className="mt-3 text-slate-600">{card.body}</p>
                {card.href && (
                  <Link
                    href={card.href}
                    className="mt-4 inline-block text-sm font-medium text-[#0A2540] underline underline-offset-4 hover:text-[#C6A664]"
                  >
                    Learn more →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-slate-200/60 px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs uppercase tracking-widest text-[#C6A664]">
              Questions
            </p>
            <h2 className="font-serif text-4xl font-semibold md:text-5xl">
              The honest answers.
            </h2>
          </div>
          <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
            {[
              {
                q: 'How is the offer calculated?',
                a: "We pull real comparable sales from HM Land Registry within 0.5 miles and last 24 months, adjust for market trend (HPI), score environmental and building risk, then apply a seller-situation margin. Nothing subjective — it's a published formula. See our Methodology page for the worked example.",
              },
              {
                q: 'Why is it below market?',
                a: "Because we buy for cash, complete in weeks, take the risk of fall-through, and do not charge any fee. Typical discount is 15–25% below market — explicitly called a 'speed premium' you pay us to buy certainty and time.",
              },
              {
                q: 'Do you pay estate agent commission?',
                a: 'Yes. If the property was introduced by an agent, we pay their agreed commission at completion. Your fee is protected in writing before exchange.',
              },
              {
                q: 'What happens after I accept?',
                a: 'Within 24 hours: we instruct solicitors, order searches, and share proof of funds. Target exchange: 10 days. Target completion: 14–28 days.',
              },
              {
                q: 'Can the offer change later?',
                a: 'Only if a physical survey uncovers a material issue not disclosed up front (e.g. structural movement, hidden damp, unregistered alterations). We tell you within 48 hours of survey — you can walk away free.',
              },
              {
                q: 'Do you survey the property?',
                a: 'Yes, a RICS Level 2 survey in most cases. We cover the cost if we complete.',
              },
              {
                q: "What's the fee?",
                a: 'Zero. Not to us, not to agents, not to solicitors (if you use our panel). The offer you see is the amount in your account at completion.',
              },
              {
                q: 'Who are Bellwood?',
                a: 'A UK-based cash property buyer. Two named founders with track records. We publish every completed deal anonymously on our methodology page.',
              },
            ].map((item, i) => (
              <details key={item.q} className="group p-6" open={i === 0}>
                <summary className="flex cursor-pointer items-center justify-between font-serif text-lg font-semibold">
                  {item.q}
                  <span className="ml-4 text-xl text-slate-400 transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-4 text-slate-600">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-b border-slate-200/60 bg-[#FAF6EA] px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-serif text-5xl font-semibold md:text-6xl">
            Ready to see the number?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-slate-600">
            60 seconds, no email required for the offer. You only share contact
            details if you want to lock it in.
          </p>
          <a
            href="#chat"
            className="mt-10 inline-flex items-center gap-2 rounded-full bg-[#0A2540] px-8 py-4 text-base font-medium text-white shadow-sm transition hover:bg-[#13365c]"
          >
            Get an instant offer
            <span aria-hidden>→</span>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div>
              <p className="font-serif text-xl font-semibold tracking-tight">
                BELLWOOD
                <span className="mx-2 inline-block h-px w-8 bg-[#C6A664] align-middle" />
                <span className="text-sm font-normal tracking-widest text-slate-500">
                  VENTURES
                </span>
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Direct-to-vendor property buyers. UK.
              </p>
            </div>
            <nav className="flex flex-wrap items-center gap-6 text-sm text-slate-600">
              <a href="#chat">Instant offer</a>
              <Link href="/instant-offer/methodology">Methodology</Link>
              <Link href="/instant-offer/team">Team</Link>
              <Link href="/legal/privacy">Privacy</Link>
              <Link href="/legal/terms">Terms</Link>
            </nav>
          </div>
          <p className="mt-10 text-xs leading-relaxed text-slate-500">
            Bellwood Ventures Ltd is a UK cash property buyer, not an
            FCA-authorised firm. We do not provide financial or legal advice.
            Seek independent legal advice before accepting any offer. All
            offers are subject to satisfactory survey and title searches.
          </p>
          <p className="mt-4 text-xs text-slate-400">
            © {new Date().getFullYear()} Bellwood Ventures Ltd.
          </p>
        </div>
      </footer>
    </>
  );
}
