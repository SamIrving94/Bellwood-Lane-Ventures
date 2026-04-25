import Link from 'next/link';
import { Suspense } from 'react';
import { database } from '@repo/database';
import { ChatFlow } from './components/chat-flow';
import { LedgerTicker } from './components/ledger-ticker';
import { Sparkline } from './components/sparkline';
import { LivePill } from './components/live-pill';
import { ProofOfFundsButton } from './components/proof-of-funds-button';
import { EmailSampleButton } from './components/email-sample-button';

export const revalidate = 300;

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

// Sample 12-month trend (£k) — replace with live aggregate query later.
const TREND_POINTS = [162, 168, 164, 172, 175, 170, 178, 182, 179, 186, 191, 188, 194];

const RECENT_DEALS = [
  {
    ref: 'M14.PRB.0419',
    situation: 'Probate',
    description:
      '3-bed terrace, Manchester. Vendor inherited after mother passed.',
    days: 19,
    offer: 142_000,
    market: 168_000,
  },
  {
    ref: 'BR3.CHN.0402',
    situation: 'Chain break',
    description:
      '4-bed semi, Bromley. Onward purchase collapsed at exchange.',
    days: 14,
    offer: 318_000,
    market: 372_000,
  },
  {
    ref: 'LS6.SHL.0328',
    situation: 'Short lease',
    description:
      '2-bed flat, Leeds. Lease at 74 years, lenders withdrawn.',
    days: 23,
    offer: 89_500,
    market: 124_000,
  },
] as const;

const SPEC_ROWS: Array<[string, string]> = [
  ['Offer validity', '72 hours, time-stamped'],
  ['Completion target', '14 – 28 days'],
  [
    'Fall-through cover',
    'All your costs + £1,000 if we withdraw without cause',
  ],
  [
    'Post-survey change',
    'Only for undisclosed material defect — you may walk away',
  ],
  ['Proof of funds', 'Signed bank letter, within 2 hours on request'],
  ['Agent commission', 'Up to 3% + VAT, paid at completion'],
  ['AML cover', 'KYC + source-of-funds handled. Compliance receipt issued.'],
  ['Regulatory status', 'Not FCA-authorised. Cash property buyer only.'],
];

export default async function InstantOfferPage() {
  const stats = await getPublicStats();
  const todayLabel = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      {/* ————— NAV ————— */}
      <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-[#FAFAF7]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10">
          <Link
            href="/instant-offer"
            className="font-serif text-xl font-semibold tracking-tight"
          >
            BELLWOODS
            <span className="mx-2 inline-block h-px w-8 bg-[#C6A664] align-middle" />
            <span className="text-sm font-normal tracking-[0.22em] text-slate-500">
              LANE
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-[13px] text-slate-600 md:flex">
            <a href="#how-it-works" className="hover:text-[#0A2540]">
              How it works
            </a>
            <Link
              href="/instant-offer/methodology"
              className="hover:text-[#0A2540]"
            >
              Methodology
            </Link>
            <a href="#ledger" className="hover:text-[#0A2540]">
              Deals
            </a>
            <Link
              href="/instant-offer/team"
              className="hover:text-[#0A2540]"
            >
              Team
            </Link>
            <div className="ml-2 flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 font-mono text-[11px] text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1F6B3A]" />
              {stats.quotesThisMonth.toLocaleString('en-GB')} offers this
              month
            </div>
            <a
              href="#chat"
              className="rounded-full bg-[#0A2540] px-5 py-2 text-white transition hover:bg-[#13365c]"
            >
              Get an offer
            </a>
          </nav>
        </div>
      </header>

      {/* ————— HERO ————— */}
      <section className="grid grid-cols-1 gap-0 border-b border-slate-200/60 lg:grid-cols-[1.4fr_1fr]">
        <div className="px-6 py-16 md:px-12 md:py-20">
          <LivePill>Accepting properties · {todayLabel}</LivePill>
          <h1
            className="mt-10 font-serif font-semibold leading-[0.98] tracking-[-0.025em] text-[#0A1020]"
            style={{ fontSize: 'clamp(48px, 8vw, 104px)' }}
          >
            Sell in
            <br />
            eighteen&nbsp;days.
            <br />
            <span className="italic text-[#C6A664]">
              Cash,&nbsp;in&nbsp;writing.
            </span>
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-slate-600 md:mt-10">
            We value any UK residential address against live HM&nbsp;Land&nbsp;Registry
            comparables and commit Bellwoods&nbsp;Lane capital to buy — in
            under a minute. Legally binding offer, seventy-two hour lock,
            completion in fourteen to twenty-eight days.
          </p>

          <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <a
              href="#chat"
              className="inline-flex items-center gap-2 rounded-full bg-[#C6A664] px-8 py-4 text-[15px] font-medium text-[#0A1020] shadow-sm transition hover:bg-[#b08f52]"
            >
              Get an instant offer
              <span aria-hidden>→</span>
            </a>
            <Link
              href="/instant-offer/methodology"
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-8 py-4 text-[15px] text-slate-700 transition hover:border-slate-400"
            >
              See the methodology
            </Link>
          </div>

          <div className="mt-14 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
            <span>HMLR</span>
            <span>·</span>
            <span>EPC</span>
            <span>·</span>
            <span>OS Places</span>
            <span>·</span>
            <span>Companies House</span>
            <span>·</span>
            <span>RICS panel</span>
          </div>
        </div>

        {/* Right — live engine readout */}
        <aside className="border-t border-slate-200/60 bg-white px-6 py-10 md:px-10 md:py-12 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
              Sample offer · live
            </p>
            <p className="font-mono text-[10px] text-[#1F6B3A]">
              ● 91ms engine
            </p>
          </div>

          <p className="mt-6 text-sm text-[#0A1020]">12 Crescent Road</p>
          <p className="font-mono text-[12px] text-slate-500">
            M14 5BQ · 3bd · terraced · EPC D
          </p>

          <p className="mt-6 font-serif text-[56px] font-semibold leading-[1] tracking-[-0.025em] text-[#0A2540] md:text-[68px]">
            £182,400
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 font-mono text-[12px]">
            <span className="text-slate-500">AVM £214k</span>
            <span className="text-slate-300">·</span>
            <span className="text-[#0A1020]">85.2% mid</span>
            <span className="text-slate-300">·</span>
            <span className="text-[#1F6B3A]">conf 0.91</span>
          </div>

          {/* Confidence breakdown */}
          <div className="mt-6">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
              <span>Confidence breakdown</span>
              <span>47 comps</span>
            </div>
            <div className="mt-3 flex h-1.5 overflow-hidden rounded-full">
              <div className="bg-[#1F6B3A]" style={{ width: '44%' }} />
              <div className="bg-[#C6A664]" style={{ width: '32%' }} />
              <div className="bg-[#E6D7A8]" style={{ width: '15%' }} />
              <div className="bg-slate-100" style={{ width: '9%' }} />
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2 font-mono text-[10px] text-slate-600">
              <div>
                <span className="text-[#1F6B3A]">●</span> Comps 44
              </div>
              <div>
                <span className="text-[#C6A664]">●</span> EPC 32
              </div>
              <div>
                <span className="text-[#E6D7A8]">●</span> Risk 15
              </div>
              <div>
                <span className="text-slate-300">●</span> Thin 9
              </div>
            </div>
          </div>

          {/* 72h lock */}
          <div className="mt-6 rounded-xl bg-[#FAF6EA] p-4">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
              <span>Offer locked</span>
              <span className="text-[#0A2540]">71h 42m</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#0A2540]/10">
              <div
                className="h-full rounded-full bg-[#0A2540]"
                style={{ width: '99%' }}
              />
            </div>
            <p className="mt-3 text-[11px] text-slate-600">
              Signed, time-stamped, legally binding until
              <br />
              27 April 2026 · 14:22 GMT
            </p>
          </div>

          {/* Trend */}
          <div className="mt-6 flex items-center justify-between border-t border-slate-200/60 pt-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                M14 · 24 months
              </p>
              <p className="mt-1 font-serif text-xl">
                £178k{' '}
                <span className="font-mono text-sm text-[#1F6B3A]">+17%</span>
              </p>
            </div>
            <Sparkline
              points={TREND_POINTS}
              color="#0A2540"
              width={120}
              height={32}
              fill
            />
          </div>
        </aside>
      </section>

      {/* ————— LEDGER TICKER ————— */}
      <LedgerTicker />

      {/* ————— CHAT ————— */}
      <section
        id="chat"
        className="border-b border-slate-200/60 px-6 py-20 md:py-24"
      >
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
              Instant offer
            </p>
            <h2 className="mt-4 font-serif text-4xl font-semibold md:text-5xl">
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

      {/* ————— HOW IT WORKS ————— */}
      <section
        id="how-it-works"
        className="border-b border-slate-200/60 px-6 py-24 md:px-12"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
              The mechanism
            </p>
            <h2 className="mt-4 font-serif text-5xl font-semibold leading-[1] tracking-[-0.02em] md:text-6xl">
              Three steps.
              <br />
              Sixty seconds.
            </h2>
            <p className="mt-6 text-[15px] leading-relaxed text-slate-600">
              Every calculation is published. No committee, no subjective
              markdown, no &ldquo;final offer subject to survey&rdquo; after
              the fact.
            </p>
          </div>
          <div className="space-y-5">
            {[
              {
                n: '01',
                t: 'You enter the property',
                d: 'A short conversation — address, type, situation. Sixty seconds.',
                k: 'Median time',
                v: '47s',
              },
              {
                n: '02',
                t: 'The engine runs',
                d: 'HMLR comps within 0.5 miles, HPI-adjusted, EPC-weighted, risk-scored against flood and subsidence data.',
                k: 'Engine latency',
                v: '91ms',
              },
              {
                n: '03',
                t: 'The offer is binding',
                d: 'Signed, time-stamped, locked 72 hours. Accept and we instruct solicitors the same day.',
                k: 'Fall-through',
                v: '0%',
              },
            ].map((s) => (
              <div
                key={s.n}
                className="grid grid-cols-1 items-start gap-4 rounded-2xl border border-slate-200 bg-white p-7 sm:grid-cols-[60px_1fr_160px] sm:gap-6"
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
                <div className="rounded-lg border border-slate-100 bg-[#FAFAF7] p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    {s.k}
                  </p>
                  <p className="mt-1 font-serif text-xl">{s.v}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ————— LEDGER / CASE STUDIES ————— */}
      <section
        id="ledger"
        className="px-6 py-24 md:px-12"
        style={{ background: '#0A2540', color: '#fff' }}
      >
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
                Ledger · last 30 days
              </p>
              <h2 className="mt-4 font-serif text-5xl font-semibold leading-[1] tracking-[-0.02em] md:text-6xl">
                Deals we&rsquo;ve closed.
              </h2>
            </div>
            <div className="md:text-right">
              <Sparkline
                points={TREND_POINTS}
                color="#C6A664"
                width={200}
                height={50}
                fill
              />
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">
                Offers / day · trailing 30
              </p>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
            {RECENT_DEALS.map((c) => (
              <div
                key={c.ref}
                className="rounded-2xl border border-white/10 bg-white/5 p-7"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
                    {c.ref}
                  </span>
                  <span className="rounded-full bg-[#C6A664]/15 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-[#C6A664]">
                    {c.situation}
                  </span>
                </div>
                <p className="mt-6 text-[14px] leading-relaxed text-white/80">
                  {c.description}
                </p>
                <p className="mt-6 font-serif text-[40px] font-normal leading-[1] tracking-[-0.02em] text-white">
                  £{c.offer.toLocaleString('en-GB')}
                </p>
                <div className="mt-3 flex items-center gap-5 font-mono text-[12px]">
                  <span className="text-white/50">
                    AVM £{(c.market / 1000).toFixed(0)}k
                  </span>
                  <span className="text-[#C6A664]">
                    {Math.round((c.offer / c.market) * 100)}%
                  </span>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 font-mono text-[12px]">
                  <span className="text-white/50">Cleared in</span>
                  <span className="text-[#1F6B3A]">● {c.days} days</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ————— TRUST / SPEC ————— */}
      <section
        className="px-6 py-24 md:px-12"
        style={{ background: '#FAF6EA' }}
      >
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
              The written word
            </p>
            <h2 className="mt-4 font-serif text-5xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-6xl">
              Every promise,
              <br />
              written down.
            </h2>
            <p className="mt-6 text-[15px] leading-relaxed text-slate-600">
              We are a cash buyer, not an FCA-regulated firm — which means we
              can move fast, but it also means you should know exactly what
              you are getting.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ProofOfFundsButton />
              <Link
                href="/legal/fca-disclosure"
                className="rounded-full border border-slate-300 bg-transparent px-6 py-3 text-sm text-slate-700 transition hover:border-slate-400"
              >
                FCA disclosure
              </Link>
            </div>
          </div>

          <dl>
            {SPEC_ROWS.map(([k, v], i) => (
              <div
                key={k}
                className="grid grid-cols-1 gap-2 border-t py-5 sm:grid-cols-[180px_1fr] sm:gap-8"
                style={{
                  borderColor: 'rgba(10,16,32,0.12)',
                  borderBottomWidth: i === SPEC_ROWS.length - 1 ? 1 : 0,
                  borderBottomStyle: 'solid',
                  borderBottomColor: 'rgba(10,16,32,0.12)',
                }}
              >
                <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-slate-500">
                  {k}
                </dt>
                <dd className="text-[#0A1020]">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ————— AGENT NOTE ————— */}
      <section className="border-y border-slate-200/60 bg-white px-6 py-16 md:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
            For estate agents
          </p>
          <h2 className="mt-3 font-serif text-3xl font-semibold leading-tight md:text-4xl">
            No signup. Just start referring.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-slate-600">
            Use the tool above as an estate agent — we auto-create your
            referral code on the spot and show it on the offer card. Earn
            up to <strong>3% + VAT</strong> per completed referral. The
            dashboard is optional.
          </p>
          <div className="mt-7 flex items-center justify-center gap-4 text-sm">
            <a
              href="#chat"
              className="font-medium text-[#0A2540] underline underline-offset-4 hover:text-[#C6A664]"
            >
              Get an instant offer →
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

      {/* ————— FINAL CTA ————— */}
      <section className="px-6 py-16 md:px-12">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-[32px] bg-[#0A2540] px-8 py-16 text-white md:px-16 md:py-20">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
                Sixty seconds
              </p>
              <h2 className="mt-4 font-serif text-5xl font-semibold leading-[1] tracking-[-0.025em] md:text-7xl">
                See your number.
              </h2>
              <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <a
                  href="#chat"
                  className="inline-flex items-center gap-2 rounded-full bg-[#C6A664] px-8 py-4 text-[15px] font-medium text-[#0A1020] transition hover:bg-[#b08f52]"
                >
                  Start now
                  <span aria-hidden>→</span>
                </a>
                <EmailSampleButton />
              </div>
            </div>
            <div className="lg:text-right">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
                This month
              </p>
              <p className="mt-2 font-serif text-[88px] font-semibold leading-[0.95] tracking-[-0.03em] md:text-[110px]">
                {stats.quotesThisMonth.toLocaleString('en-GB')}
              </p>
              <p className="mt-2 text-sm text-white/60">
                binding cash offers written
              </p>
              <div className="mt-4 inline-block">
                <Sparkline
                  points={TREND_POINTS}
                  color="#C6A664"
                  width={180}
                  height={32}
                  fill
                />
              </div>
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
                Direct-to-vendor property buyers. UK.
              </p>
            </div>
            <nav className="flex flex-wrap items-center gap-6 text-sm text-slate-600">
              <a href="#chat">Instant offer</a>
              <Link href="/instant-offer/methodology">Methodology</Link>
              <Link href="/instant-offer/team">Team</Link>
              <Link href="/legal/fca-disclosure">Regulatory</Link>
              <Link href="/legal/privacy">Privacy</Link>
              <Link href="/legal/terms">Terms</Link>
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
