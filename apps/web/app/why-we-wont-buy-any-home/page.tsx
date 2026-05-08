import Link from 'next/link';
import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Why we won't buy any home · Bellwoods Lane",
  description:
    "Some companies will buy any home. We won't. Here's what we buy, what we don't, and what we recommend instead. UK direct-to-vendor cash buyer.",
  openGraph: {
    title: "Why we won't buy any home · Bellwoods Lane",
    description:
      'A deliberate refusal of "We Buy Any House" territory. Selectivity is in the vendor\'s interest.',
    type: 'website',
  },
};

const SITUATIONS_WE_BUY: Array<{ k: string; b: string }> = [
  {
    k: 'Chain break',
    b: "Buyer pulled out at exchange. You've spent months getting there. We complete in 14 days so the chain holds and the vendor's onward purchase survives.",
  },
  {
    k: 'Mortgage refused',
    b: "The buyer's mortgage was declined late in the process. We replace them at a defensible cash figure and complete in days, not months.",
  },
  {
    k: 'Survey down-valuation',
    b: 'Buyer wants £15–30k off after a low survey. We quote independently against the same comps and offer a fixed completion date with no further wobbles.',
  },
  {
    k: 'Probate',
    b: 'IHT clock at 8.75% interest after 6 months. Executors scattered. Empty property bleeding council tax. We flex completion to the grant date and absorb the AML weight.',
  },
  {
    k: 'Repossession risk',
    b: 'Mortgage arrears mounting. A controlled voluntary sale beats a forced one. We pay on completion before any repossession order can be filed.',
  },
  {
    k: 'Problem property',
    b: "Knotweed, short lease, cladding, structural, non-standard construction. Stock high-street lenders won't mortgage. We buy at fair value and carry the risk.",
  },
];

const SITUATIONS_WE_WONT_BUY: Array<{ k: string; b: string; recommend: string }> = [
  {
    k: 'Working chain, no urgency',
    b: 'Your sale is progressing normally. The buyer is engaged, the surveys are clean, your mortgage offer is in. There is no fall-through risk.',
    recommend:
      'Stay with your high-street agent. The open market will get you 10–15% more than we will, and the time difference will be measured in weeks, not months.',
  },
  {
    k: 'Testing the market for an aspirational price',
    b: "You've read what neighbours sold for online and want to see if anyone bites at a higher number. There's no urgency. There's no distress.",
    recommend:
      "Don't list with us. List with a high-street agent at the price you want, and reduce after 4–6 weeks if it doesn't move.",
  },
  {
    k: 'In family mediation, social services involvement, or live legal dispute',
    b: 'Selling a home that is the subject of an active legal process. Court orders. Disputed beneficiaries on a probate estate. Spouse in dispute over the marital home.',
    recommend:
      "Speak to a solicitor before you speak to any cash buyer — including us. Selling under contested circumstances can void a transaction and cost more than the speed gains. We'll happily review a deal once the legal position is settled.",
  },
  {
    k: 'A faster sale leaves you with debt you cannot service',
    b: 'You owe more than the property will fetch under any cash-buyer model. Selling fast does not solve the debt problem and may make it worse.',
    recommend: (
      'Speak to free, regulated debt advice first. ' +
      'StepChange (stepchange.org) and Citizens Advice will work through your options without judgement. ' +
      'A property sale is only one of the levers. Talk to them before you talk to us.'
    ),
  },
  {
    k: "A property we have no expertise to underwrite",
    b: 'Commercial properties, equestrian, agricultural, unusual heritage assets, properties under £80k or over £2m. Our model is sized for residential UK property in the £150k–£800k range.',
    recommend:
      'A specialist auction house or a buyer focused on your property type will outperform us. We can recommend names if you email hello@bellwoodslane.co.uk with a one-line description.',
  },
];

const SITUATIONS_WE_BUY_FROM: Array<{ situation: string; route: string; href: string }> = [
  { situation: 'Chain break / buyer pulled out', route: 'Use the form on /save-the-sale', href: '/save-the-sale' },
  { situation: 'Mortgage refused / survey down-valued', route: 'Use the form on /save-the-sale', href: '/save-the-sale' },
  { situation: 'Probate', route: 'Send us the address and the grant status', href: '/sell' },
  { situation: 'Problem property', route: "Email us with the issue (knotweed, lease length, structural)", href: 'mailto:hello@bellwoodslane.co.uk?subject=Problem%20property%20enquiry' },
  { situation: "Distressed sale (financial, divorce, repossession risk)", route: "Read our distress page first, then email", href: '/sell' },
];

export default function WhyWeWontBuyAnyHomePage() {
  return (
    <div
      className={`${fraunces.variable} ${inter.variable} min-h-screen bg-[#FAFAF7] font-sans text-[#0A1020] antialiased`}
    >
      {/* ————— HEADER ————— */}
      <header className="border-b border-slate-200/60 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-10">
          <Link
            href="/"
            className="font-serif text-xl font-semibold tracking-tight"
          >
            BELLWOODS
            <span className="mx-2 inline-block h-px w-8 bg-[#C6A664] align-middle" />
            <span className="text-sm font-normal tracking-[0.22em] text-slate-500">
              LANE
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-[13px] text-slate-600 md:flex">
            <Link href="/agents" className="hover:text-[#0A2540]">
              For agents
            </Link>
            <Link href="/sell" className="hover:text-[#0A2540]">
              For sellers
            </Link>
            <Link href="/save-the-sale" className="hover:text-[#0A2540]">
              Save a sale
            </Link>
          </nav>
        </div>
      </header>

      {/* ————— HERO ————— */}
      <section className="px-6 pt-16 pb-12 md:px-12 md:pt-24 md:pb-16">
        <div className="mx-auto max-w-4xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
            Our line
          </p>
          <h1
            className="mt-4 font-serif font-semibold leading-[0.98] tracking-[-0.025em] text-[#0A1020]"
            style={{ fontSize: 'clamp(40px, 6.5vw, 76px)' }}
          >
            Some companies will buy any home.
            <br />
            <span className="italic text-[#C6A664]">We won&rsquo;t.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-slate-600">
            We&rsquo;re a UK direct-to-vendor cash buyer. We buy six specific
            kinds of property situations &mdash; the ones where speed and
            certainty matter more than maximum price. If your situation
            isn&rsquo;t one of those, the open market will probably get you
            10&ndash;15% more, and we&rsquo;ll tell you that for free.
          </p>
        </div>
      </section>

      {/* ————— WHAT WE BUY ————— */}
      <section className="border-y border-slate-200/60 bg-white px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
            What we buy
          </p>
          <h2 className="mt-3 font-serif text-3xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-5xl">
            Six situations. That&rsquo;s the list.
          </h2>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-slate-600">
            We&rsquo;ve built a business around being good at these specific
            problems. We invest in the data, the legal workflow, the
            insurance, and the operational speed each one needs. Outside this
            list, we don&rsquo;t pretend.
          </p>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
            {SITUATIONS_WE_BUY.map((s) => (
              <div
                key={s.k}
                className="rounded-2xl border border-slate-200 bg-white p-7"
              >
                <p className="font-serif text-xl font-semibold">{s.k}</p>
                <p className="mt-3 text-[14px] leading-relaxed text-slate-600">
                  {s.b}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ————— WHAT WE WON'T BUY ————— */}
      <section className="border-b border-slate-200/60 bg-[#FAF6EA] px-6 py-20 md:px-12 md:py-28">
        <div className="mx-auto max-w-4xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
            What we won&rsquo;t buy
          </p>
          <h2 className="mt-3 font-serif text-3xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-5xl">
            And here&rsquo;s when we&rsquo;ll tell you to talk to someone else.
          </h2>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-slate-600">
            We make money when we buy properties we can resell or hold
            confidently. If your situation doesn&rsquo;t fit, our offer will
            be too low to be useful, or we won&rsquo;t make one at all.
            That&rsquo;s not a sales technique &mdash; it&rsquo;s the maths.
          </p>
          <dl className="mt-12 divide-y divide-slate-200 border-y border-slate-200">
            {SITUATIONS_WE_WONT_BUY.map((s) => (
              <div key={s.k} className="py-7">
                <dt className="font-serif text-xl font-semibold text-[#0A1020]">
                  {s.k}
                </dt>
                <dd className="mt-3 text-[15px] leading-relaxed text-slate-700">
                  {s.b}
                </dd>
                <dd className="mt-4 rounded-xl border-l-2 border-[#C6A664] bg-white px-5 py-4 text-[14px] leading-relaxed text-slate-700">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#C6A664]">
                    What we recommend instead
                  </span>
                  <p className="mt-2">{s.recommend}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ————— WHY SELECTIVITY HELPS YOU ————— */}
      <section className="border-b border-slate-200/60 px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
            Why this matters to you
          </p>
          <h2 className="mt-3 font-serif text-3xl font-semibold leading-[1.1] tracking-[-0.02em] md:text-4xl">
            Selectivity is in your interest, not ours.
          </h2>
          <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-slate-700">
            <p>
              The UK quick-sale market is full of firms that promise to buy
              anything and then drop the offer £20&ndash;40k right before
              exchange. They can do that because they&rsquo;ve over-promised
              upfront. Their incentive is to lock you in, then renegotiate
              once you&rsquo;ve told the chain you&rsquo;re sold.
            </p>
            <p>
              We work the other way around. We say no to the deals we
              can&rsquo;t do well, and we put the rest in writing &mdash;
              with a £1,000 plus costs penalty if we walk without cause.
              When we say a number, that number is what completes.
            </p>
            <p>
              The trade-off is honest: <strong>our offer is below open-market.</strong>{' '}
              Typically 75&ndash;87% of mid-AVM. That&rsquo;s the price of
              certainty, speed, and zero fall-through risk. If your situation
              doesn&rsquo;t need those things, you don&rsquo;t need us.
            </p>
          </div>
        </div>
      </section>

      {/* ————— ROUTING ————— */}
      <section className="border-b border-slate-200/60 bg-[#0A2540] px-6 py-20 text-white md:px-12 md:py-24">
        <div className="mx-auto max-w-4xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
            Where to go from here
          </p>
          <h2 className="mt-3 font-serif text-3xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-4xl">
            Find your situation. Take the right route.
          </h2>
          <ul className="mt-10 divide-y divide-white/10 border-y border-white/10">
            {SITUATIONS_WE_BUY_FROM.map((s) => (
              <li
                key={s.situation}
                className="grid grid-cols-1 gap-2 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-8"
              >
                <p className="text-[15px] text-white/90">{s.situation}</p>
                <Link
                  href={s.href}
                  className="rounded-full border border-white/30 px-5 py-2 text-[13px] text-white/90 transition hover:border-[#C6A664] hover:text-white"
                >
                  {s.route} →
                </Link>
              </li>
            ))}
            <li className="grid grid-cols-1 gap-2 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-8">
              <p className="text-[15px] text-white/90">
                Working chain, no urgency, testing the market
              </p>
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">
                Use a high-street agent
              </span>
            </li>
            <li className="grid grid-cols-1 gap-2 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-8">
              <p className="text-[15px] text-white/90">
                In financial distress with debt larger than the property value
              </p>
              <a
                href="https://www.stepchange.org"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/70 underline-offset-4 hover:underline"
              >
                Talk to StepChange first →
              </a>
            </li>
          </ul>
        </div>
      </section>

      {/* ————— ESTATE AGENTS ————— */}
      <section className="border-b border-slate-200/60 bg-slate-50 px-6 py-12 md:px-12">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-center md:flex-row md:text-left">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
              Estate agent reading this?
            </p>
            <p className="mt-1 font-serif text-xl">
              The same selectivity applies on your side.
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
              <Link href="/sell">For sellers</Link>
              <Link href="/agents">For agents</Link>
              <Link href="/save-the-sale">Save a sale</Link>
              <Link href="/instant-offer/methodology">Methodology</Link>
              <Link href="/legal/fca-disclosure">Regulatory</Link>
            </nav>
          </div>
          <p className="mt-10 font-mono text-[11px] leading-relaxed text-slate-500">
            Bellwoods Lane Ltd is a UK cash property buyer, not an
            FCA-authorised firm. We do not provide financial or legal
            advice. Seek independent legal and debt advice before accepting
            any offer. All offers are subject to satisfactory survey and
            title searches.
          </p>
          <p className="mt-4 font-mono text-[11px] text-slate-400">
            © {new Date().getFullYear()} Bellwoods Lane Ltd.
          </p>
        </div>
      </footer>
    </div>
  );
}

