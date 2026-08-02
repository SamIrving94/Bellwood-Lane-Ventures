import { Wordmark } from '@/components/brand';
import { SiteHeader } from '@/components/site-header';
import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import Link from 'next/link';

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
  title: "Why we won't buy any home · Kept",
  description:
    "Some companies will buy any home. We won't. Here's what we buy, what we don't, and what we recommend instead. UK direct-to-vendor cash buyer.",
  openGraph: {
    title: "Why we won't buy any home · Kept",
    description:
      'A deliberate refusal of "We Buy Any House" territory. Selectivity is in the vendor\'s interest.',
    type: 'website',
  },
};

const SITUATIONS_WE_BUY: Array<{ k: string; b: string }> = [
  {
    k: 'Chain break',
    b: "Buyer pulled out at exchange. You've spent months getting there. We complete in weeks rather than months so the chain holds and the vendor's onward purchase survives.",
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

const SITUATIONS_WE_WONT_BUY: Array<{
  k: string;
  b: string;
  recommend: string;
}> = [
  {
    k: 'Working chain, no urgency',
    b: 'Your sale is progressing normally. The buyer is engaged, the surveys are clean, your mortgage offer is in. There is no fall-through risk.',
    recommend:
      'Stay with your high-street agent. The open market will get you more than we will, and the time difference will be measured in weeks, not months.',
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
    recommend:
      'Speak to free, regulated debt advice first. ' +
      'StepChange (stepchange.org) and Citizens Advice will work through your options without judgement. ' +
      'A property sale is only one of the levers. Talk to them before you talk to us.',
  },
  {
    k: 'A property we have no expertise to underwrite',
    b: 'Commercial properties, equestrian, agricultural, unusual heritage assets, properties under £80k or over £2m. Our model is sized for residential UK property in the £150k–£800k range.',
    recommend:
      'A specialist auction house or a buyer focused on your property type will outperform us. We can recommend names if you email hello@bellwoodslane.co.uk with a one-line description.',
  },
];

const SITUATIONS_WE_BUY_FROM: Array<{
  situation: string;
  route: string;
  href: string;
}> = [
  {
    situation: 'Chain break / buyer pulled out',
    route: 'Use the save-the-sale form',
    href: '/save-the-sale',
  },
  {
    situation: 'Mortgage refused / survey down-valued',
    route: 'Use the save-the-sale form',
    href: '/save-the-sale',
  },
  {
    situation: 'Probate',
    route: 'Start with the executors’ guide',
    href: '/probate',
  },
  {
    situation: 'Problem property',
    route: 'Email us with the issue (knotweed, lease length, structural)',
    href: 'mailto:hello@bellwoodslane.co.uk?subject=Problem%20property%20enquiry',
  },
  {
    situation: 'Distressed sale (financial, divorce, repossession risk)',
    route: 'Read who we’re wrong for below, then get an offer',
    href: '/sell',
  },
];

export default function WhyWeWontBuyAnyHomePage() {
  return (
    <div
      className={`${fraunces.variable} ${inter.variable} min-h-screen bg-cream font-sans text-forest antialiased`}
    >
      {/* ————— HEADER ————— */}
      {/* Shared site header — LogoLockup plus the one canonical nav, which
          already carries the three links this page used to hand-roll. */}
      <SiteHeader />

      {/* ————— HERO ————— */}
      <section className="px-6 pt-16 pb-12 md:px-12 md:pt-24 md:pb-16">
        <div className="mx-auto max-w-4xl">
          <p className="font-serif text-[13px] text-leaf italic">Our line</p>
          <h1
            className="mt-4 font-semibold font-serif text-forest leading-[0.98] tracking-[-0.025em]"
            style={{ fontSize: 'clamp(40px, 6.5vw, 76px)' }}
          >
            Some companies will buy any home.
            <br />
            <span className="text-leaf italic">We won&rsquo;t.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg text-stone-600 leading-relaxed">
            We&rsquo;re a UK direct-to-vendor cash buyer. We buy six specific
            kinds of property situations &mdash; the ones where speed and
            certainty matter more than maximum price. If your situation
            isn&rsquo;t one of those, the open market will probably get you
            more, and we&rsquo;ll tell you that for free.
          </p>
        </div>
      </section>

      {/* ————— WHAT WE BUY ————— */}
      <section className="border-stone-200/60 border-y bg-white px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="font-serif text-[13px] text-leaf italic">What we buy</p>
          <h2 className="mt-3 font-semibold font-serif text-3xl leading-[1.05] tracking-[-0.02em] md:text-5xl">
            Six situations. That&rsquo;s the list.
          </h2>
          <p className="mt-5 max-w-2xl text-[15px] text-stone-600 leading-relaxed">
            We&rsquo;ve built a business around being good at these specific
            problems. We invest in the data, the legal workflow, the insurance,
            and the operational speed each one needs. Outside this list, we
            don&rsquo;t pretend.
          </p>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
            {SITUATIONS_WE_BUY.map((s) => (
              <div
                key={s.k}
                className="rounded-2xl border border-stone-200 bg-white p-7"
              >
                <p className="font-semibold font-serif text-xl">{s.k}</p>
                <p className="mt-3 text-[14px] text-stone-600 leading-relaxed">
                  {s.b}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ————— WHAT WE WON'T BUY ————— */}
      <section className="border-stone-200/60 border-b bg-soft px-6 py-20 md:px-12 md:py-28">
        <div className="mx-auto max-w-4xl">
          <p className="font-serif text-[13px] text-leaf italic">
            What we won&rsquo;t buy
          </p>
          <h2 className="mt-3 font-semibold font-serif text-3xl leading-[1.05] tracking-[-0.02em] md:text-5xl">
            And here&rsquo;s when we&rsquo;ll tell you to talk to someone else.
          </h2>
          <p className="mt-5 max-w-2xl text-[15px] text-stone-600 leading-relaxed">
            We make money when we buy properties we can resell or hold
            confidently. If your situation doesn&rsquo;t fit, our offer will be
            too low to be useful, or we won&rsquo;t make one at all.
            That&rsquo;s not a sales technique &mdash; it&rsquo;s the maths.
          </p>
          <dl className="mt-12 divide-y divide-stone-200 border-stone-200 border-y">
            {SITUATIONS_WE_WONT_BUY.map((s) => (
              <div key={s.k} className="py-7">
                <dt className="font-semibold font-serif text-forest text-xl">
                  {s.k}
                </dt>
                <dd className="mt-3 text-[15px] text-stone-700 leading-relaxed">
                  {s.b}
                </dd>
                <dd className="mt-4 rounded-xl border-wax border-l-2 bg-white px-5 py-4 text-[14px] text-stone-700 leading-relaxed">
                  <span className="font-serif text-[13px] text-wax italic">
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
      <section className="border-stone-200/60 border-b px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-3xl">
          <p className="font-serif text-[13px] text-leaf italic">
            Why this matters to you
          </p>
          <h2 className="mt-3 font-semibold font-serif text-3xl leading-[1.1] tracking-[-0.02em] md:text-4xl">
            Selectivity is in your interest, not ours.
          </h2>
          <div className="mt-8 space-y-5 text-[15px] text-stone-700 leading-relaxed">
            <p>
              The UK quick-sale market is full of firms that promise to buy
              anything and then drop the offer £20&ndash;40k right before
              exchange. They can do that because they&rsquo;ve over-promised
              upfront. Their incentive is to lock you in, then renegotiate once
              you&rsquo;ve told the chain you&rsquo;re sold.
            </p>
            <p>
              We work the other way around. We say no to the deals we
              can&rsquo;t do well, and we put the rest in writing. When we say a
              number, that number is what completes, and you can walk away at no
              cost any time before exchange.
            </p>
            <p>
              The trade-off is honest:{' '}
              <strong>our offer is below open-market.</strong> The price
              reflects the speed and certainty of the transaction: a fixed date,
              a fixed number, and zero fall-through risk. If your situation
              doesn&rsquo;t need those things, you don&rsquo;t need us.
            </p>
          </div>
        </div>
      </section>

      {/* ————— ROUTING ————— */}
      <section className="border-stone-200/60 border-b bg-forest px-6 py-20 text-white md:px-12 md:py-24">
        <div className="mx-auto max-w-4xl">
          <p className="font-serif text-[13px] text-leaf italic">
            Where to go from here
          </p>
          <h2 className="mt-3 font-semibold font-serif text-3xl leading-[1.05] tracking-[-0.02em] md:text-4xl">
            Find your situation. Take the right route.
          </h2>
          <ul className="mt-10 divide-y divide-white/10 border-white/10 border-y">
            {SITUATIONS_WE_BUY_FROM.map((s) => (
              <li
                key={s.situation}
                className="grid grid-cols-1 gap-2 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-8"
              >
                <p className="text-[15px] text-white/90">{s.situation}</p>
                <Link
                  href={s.href}
                  className="rounded-full border border-white/30 px-5 py-2 text-[13px] text-white/90 transition hover:border-leaf hover:text-white"
                >
                  {s.route} →
                </Link>
              </li>
            ))}
            <li className="grid grid-cols-1 gap-2 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-8">
              <p className="text-[15px] text-white/90">
                Working chain, no urgency, testing the market
              </p>
              <span className="font-serif text-[13px] text-white/50 italic">
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
                className="font-serif text-[13px] text-white/70 italic underline-offset-4 hover:underline"
              >
                Talk to StepChange first →
              </a>
            </li>
          </ul>
        </div>
      </section>

      {/* ————— ESTATE AGENTS ————— */}
      <section className="border-stone-200/60 border-b bg-stone-50 px-6 py-12 md:px-12">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-center md:flex-row md:text-left">
          <div>
            <p className="font-serif text-[13px] text-stone-500 italic">
              Estate agent reading this?
            </p>
            <p className="mt-1 font-serif text-xl">
              The same selectivity applies on your side.
            </p>
          </div>
          <Link
            href="/agents"
            className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-6 py-3 text-sm text-stone-700 transition hover:border-stone-400"
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
              <Wordmark className="text-xl" />
              <p className="mt-2 text-sm text-stone-500">
                Direct-to-vendor property buyers · UK
              </p>
            </div>
            <nav className="flex flex-wrap items-center gap-6 text-sm text-stone-600">
              <Link href="/sell">For sellers</Link>
              <Link href="/agents">For agents</Link>
              <Link href="/save-the-sale">Save a sale</Link>
              <Link href="/instant-offer/methodology">Methodology</Link>
              <Link href="/legal/fca-disclosure">Regulatory</Link>
            </nav>
          </div>
          <p className="mt-10 font-mono text-[11px] text-stone-500 leading-relaxed">
            Kept is a UK cash property buyer, not an FCA-authorised firm. We do
            not provide financial or legal advice. Seek independent legal and
            debt advice before accepting any offer. All offers are subject to
            satisfactory survey and title searches.
          </p>
          <p className="mt-4 font-mono text-[11px] text-stone-400">
            © {new Date().getFullYear()} Kept.
          </p>
        </div>
      </footer>
    </div>
  );
}
