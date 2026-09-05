import { Button, Eyebrow, LogoLockup, Seal } from '@/components/brand';
import { OfferForm } from '@/components/home/offer-form';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Selling your property shouldn’t be painful · Kept',
  description:
    'Sell without agency fees, complete in as little as two weeks, and trust that your written cash offer won’t change at the last minute. Every promise, kept.',
};

/* ————— Content, verbatim from the Aug 2026 design handoff —————
   The copy incorporates Beth Sims' editorial pass and is signed off; do not
   paraphrase. Two deliberate normalisations, both flagged at implementation:
   em dashes are replaced per the standing copy rule, and every promise
   string follows the handoff's NEWER promise chain (offer within two
   working days of viewing, held for a week) — the backend lock in
   packages/instant-offer matches. */

const REASONS = [
  { t: 'I’m an executor', s: 'Probate', href: '/probate' },
  { t: 'My buyer pulled out', s: 'Chain break', href: '/chain-break' },
  { t: 'We’re separating', s: 'Separation', href: '/separation' },
  { t: 'I’m relocating', s: 'Moving away', href: '/relocation' },
];

const STATS = [
  {
    stat: '~1 in 3',
    t: 'agreed sales collapse',
    note: '1',
    d: 'Roughly a third of sales agreed in England and Wales never reach completion.',
  },
  {
    stat: '4–6 months',
    t: 'from offer to keys',
    note: '2',
    d: 'The average conveyancing timeline, and it’s getting longer, not shorter.',
  },
  {
    stat: '1–1.5%',
    t: 'agent fee, plus VAT',
    note: '3',
    d: 'Paid by you on completion, even if the sale was long and painful.',
  },
];

const SITUATIONS = [
  {
    k: 'Probate',
    t: 'You’re the executor of an estate',
    b: 'There is a lot to carry, and the house is only part of it. We complete with speed and certainty, at whatever pace the grant allows, so you and your loved ones can move on and focus on the important things.',
  },
  {
    k: 'Chain break',
    t: 'Your buyer pulled out',
    b: 'Months of work, undone weeks from the finish. We step in and hold the chain together so your onward move survives.',
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

const STEPS = [
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
    sla: 'Provided within two working days or fewer',
    d: 'The price we send is the price we complete at. We share the notes that informed the offer, and it stays valid for a week so you can take advice and talk it over with whoever you need to.',
  },
  {
    n: '04',
    t: 'Conveyancing and completion',
    sla: 'At the pace you need',
    d: 'You’re free to choose your own solicitor. If you need help, we can recommend firms experienced in moving quickly. We’ll appoint ours immediately and cover our own legal costs. You can then track every step in real time through a live timeline, which you can share with anyone who needs an update.',
  },
];

const PROMISE_ROWS = [
  {
    k: 'No pressure',
    v: 'Receive a fair offer in writing and take up to a week to decide.',
  },
  {
    k: 'No price reduction',
    v: 'We do not renegotiate between issue and exchange. The only exceptions? A survey reveals a material defect not visible at viewing, a title issue emerges that significantly affects value, or information provided proves materially incorrect. In each case, you can walk away at no cost.',
  },
  {
    k: 'Your timeline',
    v: 'We work to the timeline that suits you. Fast when you need fast. Patient when you are waiting on a grant of probate, a court date, or the deeds to your next home.',
  },
  {
    k: 'Walk away free',
    v: 'Changed your mind? You are free to withdraw at any point before exchange with no penalty.',
  },
  {
    k: 'No hidden fees',
    v: 'Kept will never charge you a fee. You instruct your own solicitor and pay their costs; we pay ours.',
  },
];

const FAQ = [
  {
    q: 'Can I change my mind after I accept?',
    a: 'Yes. The offer is binding upon Kept for a week. It is not binding upon you until exchange of contracts. You can withdraw at any point before exchange at no cost.',
  },
  {
    q: 'What does it cost me?',
    a: 'There is no agent fee and no fee to us at any point. You instruct your own solicitor and pay their costs; we pay ours. That’s it.',
  },
  {
    q: 'What’s the catch?',
    a: 'There isn’t one. It’s simple: we’ll make you an offer that reflects the value of a committed cash buyer and a timeline that suits you, with no agency fees and no last-minute price drops. If the offer isn’t right for you, you’re free to walk away any time prior to exchange with no penalty.',
  },
  {
    q: 'How is the offer calculated?',
    a: 'We pull every comparable sale within 0.5 miles of the property from HM Land Registry’s last 24 months, adjust for market trend, score the risk factors, then arrive at a figure we can commit to. The full methodology is published.',
  },
  {
    q: 'How quickly can you complete?',
    a: 'At the pace you need. We can complete in as little as two weeks, or take as long as your circumstances require if you are waiting on a grant of probate, a court date, or an onward purchase. We instruct solicitors as soon as you accept and share proof of funds straight away.',
  },
  {
    q: 'Can the offer change later?',
    a: 'The price we confirm in writing is the price we complete at. The only exceptions are: (1) a structural survey reveals a material defect that was not visible or disclosed at viewing, (2) a title issue emerges during conveyancing that materially affects value, or (3) information provided about the property turns out to be materially incorrect. None of those apply? The price does not change.',
  },
  {
    q: 'Are you regulated?',
    a: 'Cash property buying is unregulated by the FCA. We are members of the Property Redress Scheme (PRS), a government-approved independent redress body. We voluntarily follow The Property Ombudsman code, are HMRC-registered for AML supervision, and ICO-registered as a data controller. The independent verification links are on our regulatory status page.',
  },
];

const NAV = [
  { href: '#why', label: 'Why we exist' },
  { href: '#promise', label: 'Our promise' },
  { href: '#for-me', label: 'Is Kept for me?' },
  { href: '#how', label: 'How it works' },
  { href: '#faq', label: 'FAQ' },
  { href: '/agents', label: 'For agents' },
];

export default function SellPage() {
  return (
    <>
      {/* ————— NAV ————— */}
      <header className="sticky top-0 z-40 border-hair/70 border-b bg-cream/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-2.5 md:px-10 md:py-3.5">
          <LogoLockup href="/sell" animate />
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
              Get started
            </Button>
          </nav>
          {/* Below md the nav collapses to the CTA alone */}
          <Button href="#offer" className="px-5 py-2 text-sm md:hidden">
            Get started
          </Button>
        </div>
      </header>

      {/* ————— HERO —————
          Per the handoff: headline + body + kicker + the four-step offer form
          on the left; the threshold photograph with the wax seal straddling
          its bottom-left corner on the right. The seal overlap is what stops
          the photograph floating. The earlier offer-document card is removed
          and must not be reinstated — its points live in the promise section.

          Phones (Sep 2026 mobile review): the grid children are placed
          explicitly so the photograph sits BETWEEN the kicker and the form
          when the two columns collapse. Left to source order, the text
          column alone was 730px tall and the photograph, the one real
          artefact on the page, landed a full screen down. On lg the figure
          spans both rows of the right column, so desktop is unchanged. */}
      <main className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="pt-6 md:pt-10">
          <Eyebrow>for UK property sellers</Eyebrow>
        </div>

        <section className="grid grid-cols-1 items-start gap-y-8 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:gap-x-[72px] lg:gap-y-7">
          <div className="lg:col-start-1 lg:row-start-1">
            <h1
              className="text-balance font-bold font-serif text-forest leading-[1.02] tracking-[-0.03em]"
              style={{ fontSize: 'clamp(34px, 4vw, 54px)' }}
            >
              Selling your property shouldn&rsquo;t be painful.
              <br />
              {/* 0.94em is an optical correction: Caslon regular reads larger
                  than Caslon bold at the same size. */}
              <span
                className="font-normal text-leaf"
                style={{ fontSize: '0.94em' }}
              >
                We make sure it isn&rsquo;t<span className="text-wax">.</span>
              </span>
            </h1>
            <p className="mt-5 max-w-[46ch] text-[#44403c] text-[17px] leading-[1.7]">
              Sell without agency fees, complete in as little as two weeks, and
              trust that your written cash offer won&rsquo;t change at the last
              minute.
            </p>
            <p className="mt-3.5 font-serif text-[19px] text-forest">
              Every promise, kept.
            </p>
          </div>

          <figure className="m-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <div className="relative">
              <div className="overflow-hidden rounded-[2px] border border-hair">
                <Image
                  src="/home/threshold.webp"
                  alt="An open front door on a wet afternoon, hall light on, a packing box just inside"
                  width={1100}
                  height={1375}
                  priority
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="block h-[44vh] min-h-[280px] w-full object-cover object-[50%_30%] lg:h-auto lg:max-h-none lg:object-contain"
                />
              </div>
              <Seal className="-bottom-[18px] -left-[18px] lg:-bottom-[30px] lg:-left-[30px] absolute h-[72px] w-[72px] bg-cream shadow-[0_14px_30px_-14px_rgba(36,28,26,0.45)] lg:h-[92px] lg:w-[92px]" />
            </div>
            {/* On phones the trust marks caption the photograph, set beside
                the seal. On lg they sit under the form, as in the handoff. */}
            <figcaption className="mt-3 pl-[64px] font-serif text-[13px] text-stone-500 leading-[1.6] lg:hidden">
              Property Redress Scheme &middot; HMRC AML supervised &middot; ICO
              registered &middot; No fees to you
            </figcaption>
          </figure>

          <div className="lg:col-start-1 lg:row-start-2">
            <OfferForm />
            <p className="mt-5 hidden font-serif text-[13px] text-stone-500 leading-[1.6] lg:block">
              Property Redress Scheme &middot; HMRC AML supervised &middot; ICO
              registered &middot; No fees to you
            </p>
          </div>
        </section>

        {/* ————— REASON INDEX ————— */}
        <section className="pt-12 pb-7">
          <Eyebrow tone="muted">why are you selling?</Eyebrow>
          <ul className="mt-3.5 grid list-none grid-cols-1 border-hair border-t p-0 md:grid-cols-2 md:gap-x-14">
            {REASONS.map((r) => (
              <li key={r.t} className="border-hair border-b">
                <Link
                  href={r.href}
                  className="group flex min-h-11 items-baseline gap-3 py-3.5 text-forest transition-colors hover:text-leaf"
                >
                  <span className="shrink-0 font-serif text-[18px]">{r.t}</span>
                  <span
                    aria-hidden
                    className="mb-[5px] flex-1 border-stone-400/40 border-b border-dotted"
                  />
                  <span className="shrink-0 text-[10.5px] text-stone-500 uppercase tracking-[0.14em] [font-family:var(--font-courier)]">
                    {r.s}
                  </span>
                  <span aria-hidden className="shrink-0 text-leaf">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>

      {/* ————— WHY WE EXIST — white sheet ————— */}
      <section id="why" className="scroll-mt-24 px-3 py-4 md:px-6">
        <div className="mx-auto max-w-[1500px] rounded-[28px] bg-white">
          <div className="mx-auto max-w-6xl px-6 py-14 md:px-12 md:py-[76px]">
            <Eyebrow tone="wax">why we exist</Eyebrow>
            <h2
              className="mt-4 max-w-3xl font-bold font-serif leading-[1.05] tracking-[-0.02em]"
              style={{ fontSize: 'clamp(32px, 4.2vw, 48px)' }}
            >
              The way we sell homes in this country is broken.
            </h2>

            <dl className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-[2px] border border-hair bg-hair sm:grid-cols-3">
              {STATS.map((s) => (
                <div key={s.t} className="bg-white p-7">
                  <p className="font-bold font-serif text-4xl text-forest tracking-[-0.02em]">
                    {s.stat}
                  </p>
                  <p className="mt-2 font-serif text-[17px] text-leaf">
                    {s.t}
                    <sup className="ml-1 text-[11px] text-stone-400">
                      {s.note}
                    </sup>
                  </p>
                  <p className="mt-2 text-[14px] text-stone-600 leading-[1.6]">
                    {s.d}
                  </p>
                </div>
              ))}
            </dl>

            <p className="mt-10 max-w-[62ch] text-[#44403c] text-[17px] leading-[1.7]">
              Months of uncertainty. A fee for the privilege. And a one in three
              chance that after all of it, you are back where you started.
            </p>

            <div className="mt-9 max-w-[66ch] border-hair border-t pt-[30px]">
              <h3
                className="font-bold font-serif leading-[1.1] tracking-[-0.02em]"
                style={{ fontSize: 'clamp(26px, 3vw, 34px)' }}
              >
                Kept does things differently.
              </h3>
              <p className="mt-5 text-[#44403c] text-[17px] leading-[1.75]">
                We know there&rsquo;s more to a home than bricks and mortar.
                Every property comes with lives lived, memories made and reasons
                for moving on. That&rsquo;s why we built Kept: because we
                don&rsquo;t just care about homes, we care about people.
              </p>
              <p className="mt-4 text-[#44403c] text-[17px] leading-[1.75]">
                When selling on the open market isn&rsquo;t right for you,
                we&rsquo;re here to make things simpler. We&rsquo;ll treat you
                with honesty and respect, give you a clear cash offer in writing
                and never reduce it at the last minute. That&rsquo;s our
                promise: a promise made is a promise Kept.
              </p>
              <p className="mt-6 text-[15px]">
                <Link
                  href="/about"
                  className="text-forest underline decoration-leaf/50 underline-offset-4 hover:decoration-leaf"
                >
                  Read Kept&rsquo;s story here →
                </Link>
              </p>
            </div>

            <ol className="mt-9 flex list-none flex-col gap-1 border-hair border-t p-0 pt-[18px] text-[11px] text-stone-500 leading-[1.6]">
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

      {/* ————— OUR PROMISE — forest sheet, seal straddling the top edge ————— */}
      <section id="promise" className="scroll-mt-24 px-3 py-4 md:px-6">
        <div className="relative mx-auto max-w-[1500px] rounded-[28px] bg-brand-deep text-white">
          <div className="-top-10 absolute right-14 hidden md:block">
            <Seal className="bg-cream shadow-[0_10px_24px_-12px_rgba(36,28,26,0.4)]" />
          </div>
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 pt-16 pb-14 md:px-12 md:pt-20 md:pb-[68px] lg:grid-cols-[1fr_1.4fr] lg:gap-14">
            <div>
              <Eyebrow tone="light">our promise</Eyebrow>
              <h2
                className="mt-4 font-bold font-serif leading-[1.05] tracking-[-0.02em]"
                style={{ fontSize: 'clamp(32px, 4.2vw, 48px)' }}
              >
                No renegotiation.
                <br />
                <span className="font-normal text-leaf">A promise Kept.</span>
              </h2>
              <p className="mt-6 text-[15px] text-white/70 leading-[1.65]">
                For sellers, few things are more frustrating than a cash offer
                that drops at the last minute. With Kept, you&rsquo;ll always
                know where you stand.
              </p>
            </div>
            <dl className="m-0 border-white/10 border-t">
              {PROMISE_ROWS.map((row, i) => (
                <div
                  key={row.k}
                  className={`grid grid-cols-1 gap-1.5 py-5 sm:grid-cols-[180px_1fr] sm:gap-8 ${
                    i === PROMISE_ROWS.length - 1
                      ? ''
                      : 'border-white/10 border-b'
                  }`}
                >
                  <dt className="m-0 font-serif text-[15px] text-leaf">
                    {row.k}
                  </dt>
                  <dd className="m-0 text-[15px] text-white/90 leading-[1.65]">
                    {row.v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ————— IS KEPT FOR ME? — page background ————— */}
      <section
        id="for-me"
        className="mx-auto max-w-7xl scroll-mt-24 px-6 py-16 md:px-10 md:py-[76px]"
      >
        <div className="mb-10 max-w-3xl">
          <Eyebrow>who we buy from</Eyebrow>
          <h2
            className="mt-4 font-bold font-serif leading-[1.05] tracking-[-0.02em]"
            style={{ fontSize: 'clamp(30px, 4vw, 46px)' }}
          >
            People who want certainty so they can focus on what matters most.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[2px] border border-hair bg-hair md:grid-cols-2">
          {SITUATIONS.map((c) => (
            <div key={c.k} className="bg-white p-8">
              <p className="m-0 text-[#8B9489] text-[10.5px] uppercase tracking-[0.16em] [font-family:var(--font-courier)]">
                {c.k}
              </p>
              <p className="mt-3.5 font-bold font-serif text-[21px]">{c.t}</p>
              <p className="mt-3 text-[14px] text-stone-600 leading-[1.65]">
                {c.b}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-7 text-[14px] text-stone-600">
          Dealing with probate and not sure what happens next?{' '}
          <Link
            href="/probate"
            className="underline decoration-leaf/50 underline-offset-4 hover:decoration-leaf"
          >
            Read our plain-English guide for executors →
          </Link>
        </p>

        {/* Merged into this section per the editorial pass */}
        <div className="mt-11 max-w-[70ch] border-hair border-t pt-[34px]">
          <h3
            className="font-bold font-serif leading-[1.15] tracking-[-0.01em]"
            style={{ fontSize: 'clamp(24px, 2.8vw, 32px)' }}
          >
            When we&rsquo;re probably not the right answer.
          </h3>
          <p className="mt-4 text-[#44403c] text-[16px] leading-[1.75]">
            We focus on sellers who need to prioritise speed and certainty. We
            buy for cash, complete in weeks rather than months, charge no fee,
            and carry the risk of the sale falling through, and our offers
            reflect this.
          </p>
          <p className="mt-4 text-[#44403c] text-[16px] leading-[1.75]">
            If you can wait months for the right buyer, or your property is in
            excellent condition and high demand, get in touch with a local agent
            first. If that&rsquo;s you, we&rsquo;ll say so.
          </p>
        </div>
      </section>

      {/* ————— HOW IT WORKS — white sheet ————— */}
      <section id="how" className="scroll-mt-24 px-3 py-4 md:px-6">
        <div className="mx-auto max-w-[1500px] rounded-[28px] bg-white">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 py-16 md:px-12 md:py-20 lg:grid-cols-[1fr_2fr] lg:gap-16">
            <div>
              <Eyebrow>how it works</Eyebrow>
              <h2
                className="mt-4 font-bold font-serif leading-[1] tracking-[-0.02em]"
                style={{ fontSize: 'clamp(34px, 4.6vw, 54px)' }}
              >
                Four steps. No surprises.
              </h2>
              <p className="mt-6 text-[15px] text-stone-600 leading-[1.65]">
                We never price a home we have not visited, and all our offers
                are checked by a real person.
              </p>
            </div>
            <ol className="m-0 list-none border-hair border-t p-0">
              {STEPS.map((s) => (
                <li
                  key={s.n}
                  className="grid grid-cols-[44px_1fr] items-start gap-5 border-hair border-b py-6 md:grid-cols-[56px_1fr_170px] md:gap-7"
                >
                  <span className="font-normal font-serif text-[30px] text-brand-deep/30">
                    {s.n}
                  </span>
                  <div>
                    <h3 className="m-0 font-bold font-serif text-[20px]">
                      {s.t}
                    </h3>
                    <p className="mt-2 text-[14px] text-stone-600 leading-[1.65]">
                      {s.d}
                    </p>
                  </div>
                  <p className="col-start-2 m-0 font-serif text-[14px] text-leaf md:col-start-3 md:text-right">
                    {s.sla}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ————— FAQ — sand sheet ————— */}
      <section id="faq" className="scroll-mt-24 px-3 py-4 md:px-6">
        <div className="mx-auto max-w-[1500px] rounded-[28px] bg-soft">
          <div className="mx-auto max-w-6xl px-6 py-14 md:px-12 md:py-[76px]">
            <Eyebrow tone="wax">honest answers</Eyebrow>
            <h2
              className="mt-4 max-w-3xl font-bold font-serif leading-[1.1] tracking-[-0.02em]"
              style={{ fontSize: 'clamp(30px, 4vw, 46px)' }}
            >
              Questions sellers ask us most.
            </h2>
            <div className="mt-9 max-w-[860px] border-hair border-t">
              {FAQ.map((item) => (
                <details
                  key={item.q}
                  className="group border-hair border-b py-[18px]"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-serif text-[18px] text-forest">
                    <span>{item.q}</span>
                    <span className="ml-4 font-normal font-serif text-2xl text-leaf transition-transform duration-200 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3.5 max-w-[70ch] text-[15px] text-stone-600 leading-[1.7]">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ————— CLOSING CTA — page background ————— */}
      <section className="mx-auto max-w-7xl px-6 pt-16 md:px-10 md:pt-[72px]">
        <div className="grid grid-cols-1 items-end gap-8 border-hair border-t pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          <h2
            className="m-0 font-bold font-serif leading-[1] tracking-[-0.025em]"
            style={{ fontSize: 'clamp(40px, 6vw, 72px)' }}
          >
            A real offer{' '}
            <span className="font-normal text-leaf">in writing.</span>
          </h2>
          <div>
            <Button href="#offer">Get my offer</Button>
            <p className="mt-4 text-[14px] text-stone-600 leading-[1.6]">
              Or, if you&rsquo;re an estate agent with a chain coming apart:{' '}
              <Link
                href="/agents"
                className="underline decoration-leaf/50 underline-offset-4 hover:decoration-leaf"
              >
                the partner programme
              </Link>
              . Fee agreed per deal, in writing.
            </p>
          </div>
        </div>
      </section>

      {/* ————— FOOTER — no "Est. 2026" strapline, removed deliberately ————— */}
      <footer className="bg-cream px-6 py-14 md:px-10 md:pt-[60px] md:pb-[52px]">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-8">
            <div className="flex items-center gap-5">
              <Seal />
              <div>
                <LogoLockup wordmarkClassName="text-base" />
                <p className="mt-2 font-serif text-sm text-stone-500">
                  Direct-to-vendor property buyers &middot; UK
                </p>
              </div>
            </div>
            <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-stone-600">
              <a href="#offer" className="hover:text-brand-deep">
                Get an offer
              </a>
              <Link href="/about" className="hover:text-brand-deep">
                Kept&rsquo;s story
              </Link>
              <Link
                href="/instant-offer/methodology"
                className="hover:text-brand-deep"
              >
                Methodology
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
          <div className="mt-11 border-hair border-t pt-6">
            <p className="max-w-[96ch] text-[11px] text-stone-500 leading-[1.7]">
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
