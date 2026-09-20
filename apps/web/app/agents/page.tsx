import {
  Button,
  Eyebrow,
  LogoLockup,
  Seal,
  SectionNumber,
  StatusNote,
  Wordmark,
} from '@/components/brand';
import { ProofBand } from '@/components/proof-band';
import { TimelineMock } from '@/components/timeline-mock';
import Image from 'next/image';
import Link from 'next/link';
import { AgentQuickForm } from './components/agent-quick-form';

export const revalidate = 300;

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Will my client think I sold them short?',
    a: 'No, because the offer is below open-market by a defensible margin: a price that reflects the speed and certainty of a cash purchase with zero fall-through risk. You hand them the methodology page and a signed offer. They make the call.',
  },
  {
    q: 'My buyer’s mortgage was just refused. Can you replace them at the same price?',
    a: 'Almost certainly not at the original asking price. Our offer is below open-market in exchange for cash and certainty. But for a vendor whose buyer just collapsed, that trade-off is often worth it: a quick completion at a price that reflects the speed and certainty of the transaction, instead of months of re-marketing with no guarantee.',
  },
  {
    q: 'The survey came back and the buyer wants a £15k reduction. What now?',
    a: 'If the buyer has held the price down, we’ll quote independently against the same comparables their surveyor used, and provide a price with a fixed completion date and no further wobbles. Send us the property and the survey notes.',
  },
  {
    q: 'When and how do I get paid?',
    a: 'On completion of our purchase from your client. You keep your commission on the sale, agreed in writing per deal. All disclosed to the seller in writing per NTSELAT guidance.',
  },
  {
    q: 'How are you different from other cash buyers?',
    a: 'Two ways. (1) You keep your commission, agreed in writing per deal; most national cash buyers cut the agent out entirely. (2) The price we confirm is the price we complete at, with no renegotiation.',
  },
  {
    q: 'What if you cut the price before completion?',
    a: 'We do not renegotiate. The price in your client’s offer document is the price at completion. There are three documented exceptions: a structural survey reveals a material defect that was not visible or disclosed at viewing, a title issue emerges that materially affects value, or information provided about the property proves materially incorrect. In each case your client gets 48 hours to walk away free of charge and we share the survey report or title note in full.',
  },
  {
    q: 'What if my client decides to stay on the open market?',
    a: 'No problem. You instruct the property as normal. There’s no contract with us and nothing to unwind — you simply carry on, and we wish your client the best.',
  },
  {
    q: 'Are you regulated?',
    a: 'Cash property buying is unregulated by the FCA. We are members of the Property Redress Scheme (PRS) — a government-approved independent redress body — voluntarily follow The Property Ombudsman code, are HMRC-registered for AML supervision, and ICO-registered as a data controller. See our regulatory disclosure for full detail.',
  },
];

/** A signed cash-offer document — rendered as a real letter, not a web card. */
function SampleOfferDocument() {
  return (
    <div className="-rotate-[1.2deg] relative mx-auto w-full max-w-md rounded-[2px] border border-hair bg-[linear-gradient(175deg,#fdfaf2_0%,#f7f2e6_70%,#f3edde_100%)] p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(36,28,26,0.08),0_30px_60px_-30px_rgba(36,28,26,0.6)]">
      {/* Wax seal — solid, irregular, embossed */}
      <div className="-right-5 -top-5 absolute hidden rotate-[7deg] sm:block">
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
        <Wordmark ventures className="text-[13px]" />
        <p className="text-[10.5px] text-stone-400 [font-family:var(--font-courier)]">
          Ref BW-2026-0142
        </p>
      </div>
      <p className="mt-1 text-[10.5px] text-stone-400 [font-family:var(--font-courier)]">
        Binding offer document
      </p>

      <div className="mt-6 border-stone-300/60 border-t border-dashed pt-4">
        <p className="text-[10.5px] text-stone-400 tracking-[0.08em] [font-family:var(--font-courier)]">
          PROPERTY
        </p>
        <p className="mt-1 font-serif text-[15px] text-stone-700 leading-snug">
          14 Acacia Avenue, Stockport SK4&nbsp;3HQ
        </p>
      </div>

      <div className="mt-4 border-stone-300/60 border-t border-dashed pt-4">
        <p className="text-[10.5px] text-brand tracking-[0.08em] [font-family:var(--font-courier)]">
          OUR CASH OFFER
        </p>
        <p className="mt-1.5 font-bold font-serif text-[44px] text-forest leading-none tracking-[-0.02em]">
          £244,000
        </p>
        <p className="mt-2 inline-block rotate-[-1.5deg] border border-wax/60 px-2 py-0.5 text-[10px] text-wax tracking-[0.14em] [font-family:var(--font-courier)]">
          HELD · ONE WEEK
        </p>
      </div>

      <dl className="mt-5 space-y-2.5 border-stone-300/60 border-t border-dashed pt-4 text-[12px] text-stone-600 [font-family:var(--font-courier)]">
        {[
          ['Completion', 'Weeks not months'],
          ['Price changes', 'Documented exceptions only'],
          ['Your commission', 'Agreed per deal, in writing'],
        ].map(([k, v]) => (
          <div key={k} className="flex items-baseline gap-2">
            <dt className="shrink-0">{k}</dt>
            <span
              aria-hidden
              className="mb-[3px] flex-1 border-stone-400/50 border-b border-dotted"
            />
            <dd className="shrink-0 text-right text-forest">{v}</dd>
          </div>
        ))}
      </dl>

      {/* Ink signature */}
      <svg viewBox="0 0 150 34" className="mt-5 h-7 w-32" aria-hidden="true">
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
          Signed for and on behalf of Kept
        </p>
        <p className="text-[10px] text-stone-400 [font-family:var(--font-courier)]">
          A. Taylor
        </p>
      </div>
      <p className="mt-3 border-stone-300/60 border-t border-dashed pt-3 text-[10px] text-stone-500 leading-relaxed [font-family:var(--font-courier)]">
        This offer is binding upon Kept for a week from issue.
      </p>
    </div>
  );
}

// Co-founder note, 20 Sep 2026: the Kept Score tab is gone. It offered an
// indicative range, which the no-indicative-offers rule (Aug 2026) forbids
// on every surface. The route still exists, noindexed, until it is deleted.
const NAV = [
  { href: '#how', label: 'How it works' },
  { href: '#faq', label: 'FAQ' },
  { href: '/sell', label: 'For sellers' },
  { href: '/partners/login', label: 'Partner sign in' },
];

export default function AgentsPage() {
  return (
    <>
      {/* ————— PANIC-MODE BAND ————— */}
      <Link
        href="/save-the-sale"
        className="group block bg-brand-deep px-6 py-2.5 text-center text-[13px] text-white/85 transition hover:bg-leaf-dark md:px-12"
      >
        <span className="font-serif text-leaf">Sale fallen through?</span>
        <span className="ml-3">
          Buyer pulled out, mortgage refused, survey down-valued or chain broken
          &mdash; we&rsquo;re your replacement buyer.
        </span>
        <span className="ml-2 underline decoration-white/30 underline-offset-4 group-hover:decoration-white">
          Save the sale
        </span>
      </Link>

      {/* ————— NAV ————— */}
      <header className="sticky top-0 z-40 border-hair/70 border-b bg-cream/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5 md:px-10">
          <LogoLockup />
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
            <Button href="#refer" className="px-5 py-2 text-sm">
              Send a deal
            </Button>
          </nav>
        </div>
      </header>

      {/* ————— HERO —————
          Same structural grammar as /sell (the anti-template composition):
          courier dateline row, giant full-width Caslon headline, an artefact
          laid over the composition, hairline baseline.

          Co-founder note, 20 Sep 2026: the commission docket (sale fee plus
          resale instruction, "up to £7,280") is retired and must not be
          reinstated. We source properties on, so we cannot promise the agent
          the resale instruction, and the page no longer mentions one
          anywhere. The artefact is now the same threshold photograph and
          seal as the /sell hero. */}
      <section className="relative overflow-hidden px-6 pt-10 pb-16 md:px-12 md:pt-12 md:pb-20">
        <div className="relative mx-auto max-w-6xl">
          {/* Dateline — the page opens like a document */}
          <div className="flex items-baseline justify-between gap-6 border-hair border-b pb-4">
            <Eyebrow>for UK estate agents</Eyebrow>
            <p className="text-[11px] text-stone-400 tracking-[0.18em] [font-family:var(--font-courier)]">
              EST. 2026 · UK
            </p>
          </div>
          <h1
            className="relative z-10 mt-10 font-bold font-serif text-forest leading-[0.98] tracking-[-0.03em] md:mt-12"
            style={{ fontSize: 'clamp(46px, 7.6vw, 92px)' }}
          >
            Save the sale<span className="text-wax">.</span>
            <br />
            <span className="font-normal text-brand">Before you re-list.</span>
          </h1>
          <div className="mt-10 grid items-start gap-12 md:mt-8 md:grid-cols-[1fr_auto] md:gap-16">
            <div className="max-w-md">
              <p className="text-[16px] text-stone-600 leading-[1.75]">
                Buyer pulled out, mortgage refused, survey down-valued, chain
                broken. We&rsquo;re the replacement buyer agents call before
                they relist, not after weeks of trying. Send the address, we
                view the property, and we confirm an offer in writing within
                two working days of viewing.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
                <Button href="#refer">Send the address</Button>
                <StatusNote>Five fields. No portal login.</StatusNote>
              </div>
            </div>
            <figure className="relative m-0 mx-auto w-full max-w-[340px] md:mx-0 md:w-[300px] lg:-mt-16 lg:w-[340px] xl:-mt-32">
              <div className="overflow-hidden rounded-[2px] border border-hair">
                <Image
                  src="/home/threshold.webp"
                  alt="An open front door on a wet afternoon, hall light on, a packing box just inside"
                  width={1100}
                  height={1375}
                  priority
                  sizes="(max-width: 768px) 100vw, 340px"
                  className="block h-auto w-full"
                />
              </div>
              <Seal className="-bottom-[18px] -left-[18px] absolute h-[72px] w-[72px] bg-cream shadow-[0_14px_30px_-14px_rgba(36,28,26,0.45)] lg:-bottom-[24px] lg:-left-[24px] lg:h-[84px] lg:w-[84px]" />
            </figure>
          </div>
          {/* Hairline baseline */}
          <div className="mt-14 border-hair border-t pt-5">
            <p className="font-serif text-[13px] text-stone-500">
              Property Redress Scheme &middot; HMRC AML supervised &middot;
              ICO registered &middot; Fees disclosed per NTSELAT guidance
            </p>
          </div>
        </div>
      </section>

      {/* ————— TWO OPTIONS. BOTH BAD. ————— */}
      <section className="px-3 py-4 md:px-6">
        <div className="relative mx-auto max-w-[1500px] rounded-[20px] bg-brand-deep text-white md:rounded-[28px]">
        <div className="mx-auto max-w-6xl px-6 py-24 md:px-12 md:py-28">
          <SectionNumber tone="light">01</SectionNumber>
          <Eyebrow tone="light" className="mt-5">
            the agent&rsquo;s dilemma
          </Eyebrow>
          <h2 className="mt-4 max-w-3xl font-semibold font-serif text-4xl leading-[1.05] tracking-[-0.02em] md:text-6xl">
            When a sale collapses, you have two options.{' '}
            <span className="font-normal text-leaf">Both are bad.</span>
          </h2>
          <p className="mt-6 max-w-2xl text-[15px] text-white/70 leading-relaxed">
            6,200 UK sales collapse every week. £3,000 commission gone per
            fall-through, on average. 43% fail at three months or later, after
            you&rsquo;ve invested the most time. And then you face this:
          </p>
          <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-white/15 bg-white/10 md:grid-cols-2">
            {[
              {
                n: 'Option one',
                t: 'Re-market the property',
                pts: [
                  'Potentially months to find a new buyer',
                  'Vendor confidence is already cratered',
                  'You start the chain-build from zero',
                  'Your commission is delayed by months',
                ],
              },
              {
                n: 'Option two',
                t: 'Your client takes it to a national cash buyer',
                pts: [
                  'Well below market value, no negotiation',
                  'Last-minute price cuts are endemic',
                  'You’re out of the picture, so no commission',
                ],
              },
            ].map((o) => (
              <div key={o.n} className="bg-brand-deep p-7 md:p-9">
                <p className="text-[11px] text-white/55 tracking-[0.14em] uppercase [font-family:var(--font-courier)]">
                  {o.n}
                </p>
                <p className="mt-2 font-semibold font-serif text-2xl">{o.t}</p>
                <ul className="mt-5 space-y-2.5 text-[14px] text-white/70 leading-relaxed">
                  {o.pts.map((p) => (
                    <li key={p} className="flex gap-3">
                      <span className="mt-2 h-px w-3 shrink-0 bg-brand" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 rounded-sm border border-brand/50 bg-brand/[0.08] p-8 md:p-10">
            <Eyebrow tone="light">
              we&rsquo;re trying to be option three
            </Eyebrow>
            <h3 className="mt-4 max-w-3xl font-semibold font-serif text-3xl leading-[1.1] md:text-4xl">
              Speed without renegotiation. Your commission on the sale, agreed
              in writing.
            </h3>
            <p className="mt-6 text-[11px] text-white/40 leading-relaxed">
              Sources: TwentyCi (2025 fall-through rate), Santander
              &laquo;Fixing the Broken Chain&raquo; (cost per fall-through),
              HomeOwners Alliance (UK quick-sale market norms).
            </p>
          </div>
        </div>
        </div>
      </section>

      {/* ————— WHY WE EXIST — the seller page's "Kept does things
          differently", in the agent's frame —————
          Co-founder note, 20 Sep 2026: this replaces the two-commissions
          wedge and its £280k worked example. Both are retired: the worked
          example put our buy-below-market, resell-at-market maths on the
          page in numbers, and the resale instruction is no longer something
          we can promise. The first two paragraphs are the signed-off /sell
          copy with "you" turned to "your client"; the closing line is new.
          For Beth's review. */}
      <section id="how" className="scroll-mt-24 px-3 py-4 md:px-6">
        <div className="mx-auto max-w-[1500px] rounded-[20px] bg-white md:rounded-[28px]">
        <div className="mx-auto max-w-6xl px-6 py-24 md:px-12 md:py-28">
          <SectionNumber>02</SectionNumber>
          <Eyebrow className="mt-5">why we exist</Eyebrow>
          <h2 className="mt-4 max-w-3xl font-semibold font-serif text-4xl leading-[1.05] tracking-[-0.02em] md:text-5xl">
            Kept does things{' '}
            <span className="font-normal text-brand">differently.</span>
          </h2>
          <p className="mt-6 max-w-[62ch] text-[#44403c] text-[17px] leading-[1.75]">
            We know there&rsquo;s more to your client&rsquo;s home than bricks
            and mortar. Every property comes with lives lived, memories made
            and reasons for moving on. That&rsquo;s why we built Kept: because
            we don&rsquo;t just care about homes, we care about people.
          </p>
          <p className="mt-4 max-w-[62ch] text-[#44403c] text-[17px] leading-[1.75]">
            When selling on the open market isn&rsquo;t right for your client,
            we&rsquo;re here to make things simpler. We&rsquo;ll treat them
            with honesty and respect, give them a clear cash offer in writing
            and never reduce it at the last minute. You keep your commission
            on the sale, agreed in writing per deal. That&rsquo;s our promise:
            a promise made is a promise Kept.
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
        </div>
      </section>

      {/* ————— THE PROMISE ————— */}
      <section
        id="promise"
        className="relative scroll-mt-24 px-6 py-20 md:px-12 md:py-24"
      >
        <div className="mx-auto max-w-4xl">
          <div className="flex items-start justify-between gap-8">
            <div>
              <SectionNumber>03</SectionNumber>
              <Eyebrow className="mt-5">the written promise</Eyebrow>
              <h2 className="mt-4 font-semibold font-serif text-4xl leading-[1.05] tracking-[-0.02em] md:text-5xl">
                No renegotiation.{' '}
                <span className="font-normal text-brand">
                  In writing.
                </span>
              </h2>
            </div>
            <Seal
              label="Kept"
              className="mt-2 hidden shrink-0 sm:inline-flex"
            />
          </div>
          <p className="mt-6 max-w-2xl text-[15px] text-stone-600 leading-relaxed">
            Quietly cutting the offer days before exchange is the cash-buyer
            move vendors fear most. If your client comes to us, we do not
            renegotiate. There are three transparent exceptions, documented
            below.
          </p>
          <dl className="mt-12 divide-y divide-hair border-hair border-y">
            {[
              {
                t: 'The price is the price',
                d: 'The figure in your client’s offer document is the figure at completion. If we walk away without cause, your client owes us nothing and loses nothing.',
              },
              {
                t: 'The only three exceptions',
                d: 'The confirmed price can only change for three documented reasons: (1) a structural survey reveals a material defect that was not visible or disclosed at viewing; (2) a title issue emerges during conveyancing that materially affects value; (3) information provided about the property turns out to be materially incorrect. Anything else? Price holds. If we adjust, your client gets 48 hours to walk free of charge and we share the survey report or title note in full.',
              },
              {
                t: 'Published quarterly',
                d: 'We commit to publishing our completion rate every quarter — including failures. No competitor in the UK does this.',
              },
            ].map((row) => (
              <div
                key={row.t}
                className="grid grid-cols-1 gap-2 py-6 sm:grid-cols-[240px_1fr] sm:gap-12"
              >
                <dt className="font-serif text-[17px] text-brand-deep">
                  {row.t}
                </dt>
                <dd className="text-[15px] text-stone-700 leading-relaxed">
                  {row.d}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ————— THE 5-STEP PROCESS ————— */}
      <section id="process" className="scroll-mt-24 px-3 py-4 md:px-6">
        <div className="mx-auto max-w-[1500px] rounded-[20px] bg-white md:rounded-[28px]">
        <div className="mx-auto max-w-6xl px-6 py-24 md:px-12 md:py-28">
          <SectionNumber>04</SectionNumber>
          <Eyebrow className="mt-5">how the process actually runs</Eyebrow>
          <h2 className="mt-4 font-semibold font-serif text-4xl leading-[1.05] tracking-[-0.02em] md:text-5xl">
            Four steps.{' '}
            <span className="font-normal text-brand">
              Honest about what each one means.
            </span>
          </h2>
          <p className="mt-6 max-w-2xl text-[15px] text-stone-600 leading-relaxed">
            We never describe our offers as &ldquo;instant&rdquo; or
            &ldquo;guaranteed&rdquo;. No figure reaches your client until we
            have viewed the property. Here&rsquo;s exactly what happens, in
            order.
          </p>
          <ol className="mt-12 divide-y divide-hair border-hair border-y">
            {[
              {
                n: '01',
                t: 'Acknowledgement',
                sla: 'Same day',
                d: 'Seller or agent submits the property. We come back the same day, Monday to Friday, and may ask clarifying questions. Where we can pull from public records (Land Registry, EPC register, planning portal), we do. We only ask the seller for what we genuinely need.',
              },
              {
                n: '02',
                t: 'Property viewing',
                sla: 'Before any figure',
                d: 'We physically view every property before issuing a confirmed offer. We assess overall condition, visible defects, and anything not clear from public records. We tell the seller in advance what we are looking for.',
              },
              {
                n: '03',
                t: 'Confirmed offer in writing',
                sla: 'Within two working days of viewing',
                d: 'After viewing, we issue our confirmed purchase price in writing. This is the price we complete at. We share the survey notes that informed it. Held for a week so your client can take advice.',
              },
              {
                n: '04',
                t: 'Conveyancing and completion',
                sla: 'Weeks not months',
                d: 'We instruct our solicitors straight away. The seller instructs theirs; we can recommend firms accustomed to working on expedited timelines. We provide regular updates through to exchange and completion, surfaced on the live timeline page the seller can share with anyone.',
              },
            ].map((s) => (
              <li
                key={s.n}
                className="grid grid-cols-[48px_1fr] items-start gap-6 py-7 md:grid-cols-[72px_1fr_220px] md:gap-8"
              >
                <span className="font-light font-serif text-3xl text-brand-deep/30 tabular-nums md:text-4xl">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-semibold font-serif text-xl md:text-2xl">
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
      </section>

      {/* ————— THE PROOF ————— */}
      <section className="px-3 py-4 md:px-6">
        <div className="mx-auto max-w-[1500px] rounded-[20px] bg-brand-deep text-white md:rounded-[28px]">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 px-6 py-24 md:px-12 md:py-28 lg:grid-cols-2">
          <div>
            <Eyebrow tone="light">what your client receives</Eyebrow>
            <h2 className="mt-4 font-semibold font-serif text-4xl leading-[1.05] tracking-[-0.02em] md:text-5xl">
              A signed offer document.
              <br />
              <span className="font-normal text-leaf">
                Not a phone call.
              </span>
            </h2>
            <p className="mt-6 max-w-md text-[15px] text-white/70 leading-relaxed">
              After viewing, you and your client both receive a signed PDF offer
              document. Reference number, confirmed amount, completion timeline.
              The price we confirm is the price we complete at. No ambiguity. No
              verbal commitments to remember.
            </p>
            <p className="mt-4 max-w-md text-[15px] text-white/70 leading-relaxed">
              And the maths behind the figure — market estimate, our margin,
              the number we sign — is shown to your client exactly as it is
              shown to you. Nothing reaches them that you haven&rsquo;t seen.
            </p>
          </div>
          <div className="lg:pl-6">
            <SampleOfferDocument />
          </div>
        </div>
        </div>
      </section>

      {/* ————— ONE TIMELINE, EVERYONE ————— */}
      <section
        id="timeline"
        className="scroll-mt-24 px-6 py-20 md:px-12 md:py-24"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 lg:grid-cols-2">
          <div>
            <Eyebrow>while the deal runs</Eyebrow>
            <h2 className="mt-4 font-semibold font-serif text-4xl leading-[1.05] tracking-[-0.02em] md:text-5xl">
              One timeline.{' '}
              <span className="font-normal text-brand">
                Everyone sees the same thing.
              </span>
            </h2>
            <p className="mt-6 max-w-lg text-[15px] text-stone-600 leading-relaxed">
              Every deal gets a live timeline page — no portal, no login, one
              link. Seller, agent and solicitor all see the same update at the
              same moment: solicitors instructed, searches ordered, survey
              booked, exchange targeted. When your client calls asking
              what&rsquo;s happening, the answer is already in their hand.
            </p>
            <p className="mt-4 max-w-lg text-[15px] text-stone-600 leading-relaxed">
              No chasing our side for updates. If a step slips, the timeline
              says so — we&rsquo;d rather show you a delay than hide one.
            </p>
          </div>
          <div className="flex justify-center lg:justify-end">
            <TimelineMock />
          </div>
        </div>
      </section>

      {/* ————— REFER ————— */}
      <section
        id="refer"
        className="scroll-mt-24 px-6 py-20 md:px-12 md:py-24"
      >
        <div className="mx-auto max-w-4xl">
          <Eyebrow>the fastest way to find out</Eyebrow>
          <h2 className="mt-4 font-semibold font-serif text-4xl tracking-[-0.02em] md:text-5xl">
            Send the address.
          </h2>
          <p className="mt-5 max-w-2xl text-[15px] text-stone-600 leading-relaxed">
            Five fields. We come back to you the same day, Monday to Friday.
            We then view the property and confirm a signed offer within two
            working days of viewing.
          </p>
          <div className="mt-10">
            <AgentQuickForm />
          </div>
        </div>
      </section>

      {/* ————— FAQ ————— */}
      <section
        id="faq"
        className="scroll-mt-24 px-6 py-20 md:px-12 md:py-24"
      >
        <div className="mx-auto max-w-3xl">
          <Eyebrow>honest answers</Eyebrow>
          <h2 className="mt-4 font-semibold font-serif text-4xl tracking-[-0.02em] md:text-5xl">
            Questions agents ask first.
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

      {/* ————— PROOF BAND ————— */}
      <ProofBand />

      {/* ————— SELLERS LINK — a quiet desk row ————— */}
      <section className="px-6 py-12 md:px-12">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-5 text-center md:flex-row md:text-left">
          <div>
            <Eyebrow tone="muted">not an agent?</Eyebrow>
            <p className="mt-2 font-serif text-forest text-xl">
              Selling your own property?
            </p>
          </div>
          <Button href="/sell" variant="ghost">
            Get a cash offer for your home
          </Button>
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
              <a href="#refer" className="hover:text-brand-deep">
                Send a deal
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
              <Link href="/sell" className="hover:text-brand-deep">
                For sellers
              </Link>
              <Link
                href="/legal/fca-disclosure"
                className="hover:text-brand-deep"
              >
                Regulatory
              </Link>
              <Link href="/partners/login" className="hover:text-brand-deep">
                Partner sign in
              </Link>
            </nav>
          </div>
          <div className="mt-10 border-hair border-t pt-6">
            <p className="font-serif text-[12px] text-stone-500">
              Property Redress Scheme (PRS) &middot; HMRC AML supervised
              &middot; ICO registered
            </p>
            <p className="mt-4 text-[11px] text-stone-500 leading-relaxed">
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
