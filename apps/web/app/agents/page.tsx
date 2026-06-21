import Link from 'next/link';
import { AgentQuickForm } from './components/agent-quick-form';
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

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Will my client think I sold them short?',
    a: "No — because the offer is below open-market by a published, defensible margin (a speed premium for cash + 14–28 day completion + zero fall-through risk). You hand them the methodology page and a signed offer. They make the call.",
  },
  {
    q: 'My buyer’s mortgage was just refused. Can you replace them at the same price?',
    a: 'Almost certainly not at the original asking price — our offer is below open-market by a published margin in exchange for cash and certainty. But for a vendor whose buyer just collapsed, that trade-off is often worth it: a quick completion at 75–87% of market value, instead of 4–8 months of re-marketing with no guarantee.',
  },
  {
    q: 'The survey came back and the buyer wants a £15k reduction. What now?',
    a: 'If the buyer has held the price down, we’ll quote independently against the same comparables their surveyor used. Often we land within £5k of where the renegotiation was heading anyway, but with a fixed completion date and no further wobbles. Send us the property + the survey notes.',
  },
  {
    q: 'When and how do I get paid?',
    a: 'On completion of our purchase from your client. Your partner fee is agreed in writing per deal — typically your standard sale fee plus an introducer fee, with a separate sale instruction when we resell. All disclosed to the seller in writing per NTSELAT guidance.',
  },
  {
    q: 'How are you different from other cash buyers?',
    a: 'Three ways. (1) Your partner fee is agreed in writing per deal — most national cash buyers cut the agent out entirely. (2) The price we confirm is the price we complete at; if we walk without cause, we pay you £1,000 plus your costs. (3) When we resell the property, we instruct you. National cash buyers flip through their own channels and the property never comes back to you.',
  },
  {
    q: 'What if you re-trade my client at exchange?',
    a: 'You collect £1,000 from us, plus your costs, in writing. The price in your client’s offer document is the price at completion. The single legitimate exception is a RICS-survey-disclosed material defect — and your client gets 48 hours to walk away free of charge.',
  },
  {
    q: 'What if my client decides to stay on the open market?',
    a: 'No problem. You instruct the property as normal. There’s no contract with us and nothing to unwind — you simply carry on, and we wish your client the best.',
  },
  {
    q: 'What about my AML obligations on the seller?',
    a: 'We carry the load. Bellwoods Lane is HMRC-registered for AML supervision. We run KYC and source-of-funds checks, then issue a written compliance receipt for your file.',
  },
  {
    q: 'Are you regulated?',
    a: 'Cash property buying is unregulated by the FCA. We are members of the Property Redress Scheme (PRS) — a government-approved independent redress body — voluntarily follow The Property Ombudsman code, are HMRC-registered for AML supervision, and ICO-registered as a data controller. See our regulatory disclosure for full detail.',
  },
];

/** A signed cash-offer document — rendered as a real letter, not a web card. */
function SampleOfferDocument() {
  return (
    <div className="relative mx-auto max-w-md rounded-sm border border-[#E4D8D1] bg-white p-8 shadow-[0_30px_60px_-30px_rgba(43,34,32,0.35)]">
      {/* corner seal */}
      <div className="absolute -right-5 -top-5 hidden sm:block">
        <Seal />
      </div>

      <Wordmark ventures className="text-[13px]" />
      <p className="mt-1.5 font-serif text-[11px] italic text-stone-400">
        Binding offer document &middot; Ref BW-2026-0142
      </p>

      <div className="mt-7 space-y-1 border-t border-[#EBE1DB] pt-5">
        <p className="font-serif text-[11px] italic text-stone-400">Property</p>
        <p className="font-serif text-[15px] leading-snug text-stone-700">
          14 Acacia Avenue, Stockport, SK4 3HQ
        </p>
      </div>

      <div className="mt-5 border-t border-[#EBE1DB] pt-5">
        <p className="font-serif text-[11px] italic text-brand">Our cash offer</p>
        <p className="mt-1.5 font-serif text-[44px] font-semibold leading-none tracking-[-0.03em] text-[#2B2220]">
          £244,000
        </p>
        <p className="mt-2 text-[11px] text-stone-500">
          83% of mid AVM &middot; locked 72 hours
        </p>
      </div>

      <dl className="mt-6 space-y-2.5 border-t border-[#EBE1DB] pt-5 text-[12px]">
        {[
          ['Completion', 'Weeks not months'],
          ['Survey adjustment', 'RICS material defect only'],
          ['Walk-away cover', '£1,000 + costs'],
          ['Introducer (your firm)', 'Agreed per deal'],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-6">
            <dt className="text-stone-500">{k}</dt>
            <dd className="text-right font-medium text-stone-700">{v}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-6 border-t border-[#EBE1DB] pt-4 font-serif text-[11px] italic leading-relaxed text-stone-500">
        Signed for and on behalf of Bellwoods Lane Ltd. This offer is legally
        binding upon Bellwoods Lane Ltd for 72 hours from issue.
      </p>
    </div>
  );
}

const NAV = [
  { href: '/agents/score', label: 'Bellwood Score' },
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
        className="group block bg-brand-deep px-6 py-2.5 text-center text-[13px] text-white/85 transition hover:bg-[#743a3a] md:px-12"
      >
        <span className="font-serif italic text-[#f0c9c0]">
          Sale fallen through?
        </span>
        <span className="ml-3">
          Buyer pulled out, mortgage refused, survey down-valued or chain broken
          &mdash; we&rsquo;re your replacement buyer.
        </span>
        <span className="ml-2 underline decoration-white/30 underline-offset-4 group-hover:decoration-white">
          Save the sale
        </span>
      </Link>

      {/* ————— NAV ————— */}
      <header className="sticky top-0 z-40 border-b border-[#EBE1DB]/70 bg-[#FBF8F5]/85 backdrop-blur-md">
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

      {/* ————— HERO ————— */}
      <section className="relative overflow-hidden px-6 pt-24 pb-20 md:px-12 md:pt-28 md:pb-24">
        {/* oversized faint monogram watermark */}
        <Monogram
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-10 h-72 w-auto opacity-[0.05] md:h-[26rem]"
        />
        <div className="relative mx-auto max-w-4xl">
          <Eyebrow>for UK estate agents</Eyebrow>
          <h1
            className="mt-7 font-serif font-semibold leading-[0.95] tracking-[-0.03em] text-[#2B2220]"
            style={{ fontSize: 'clamp(44px, 6.5vw, 78px)' }}
          >
            Save the sale.
            <br />
            <span className="italic font-normal text-brand">
              Before you re-list.
            </span>
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-stone-600">
            Buyer pulled out, mortgage refused, survey down-valued, chain broken.
            We&rsquo;re the replacement buyer agents call <em>before</em> they
            relist &mdash; not after weeks of trying. A real cash figure in 60
            seconds, a signed binding offer within 24 hours.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4">
            <Button href="#refer">Send the address</Button>
            <StatusNote>Five fields. No portal login.</StatusNote>
          </div>
        </div>
      </section>

      {/* ————— TWO OPTIONS. BOTH BAD. ————— */}
      <section className="relative overflow-hidden border-y border-[#EBE1DB]/70 bg-brand-deep px-6 py-24 text-white md:px-12 md:py-28">
        <Monogram
          aria-hidden
          className="pointer-events-none absolute -bottom-16 -left-16 h-80 w-auto opacity-[0.06]"
        />
        <div className="relative mx-auto max-w-6xl">
          <SectionNumber tone="light">01</SectionNumber>
          <Eyebrow tone="light" className="mt-5">
            the agent&rsquo;s dilemma
          </Eyebrow>
          <h2 className="mt-4 max-w-3xl font-serif text-4xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-6xl">
            When a sale collapses, you have two options.{' '}
            <span className="italic font-normal text-[#f0c9c0]">
              Both are bad.
            </span>
          </h2>
          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-white/70">
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
                  '4–8 months on average to find a new buyer',
                  'Vendor confidence is already cratered',
                  'You start the chain-build from zero',
                  'Your commission is delayed by months',
                ],
              },
              {
                n: 'Option two',
                t: 'Send to a national cash buyer',
                pts: [
                  '70–85% of market value, no negotiation',
                  'Re-trading at exchange is endemic',
                  'Your commission usually isn’t paid',
                  'You never see the property again on resale',
                ],
              },
            ].map((o) => (
              <div key={o.n} className="bg-brand-deep p-7 md:p-9">
                <p className="font-serif text-sm italic text-white/55">{o.n}</p>
                <p className="mt-2 font-serif text-2xl font-semibold">{o.t}</p>
                <ul className="mt-5 space-y-2.5 text-[14px] leading-relaxed text-white/70">
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
            <Eyebrow tone="light">we&rsquo;re trying to be option three</Eyebrow>
            <h3 className="mt-4 max-w-3xl font-serif text-3xl font-semibold leading-[1.1] md:text-4xl">
              Speed without re-trading. Full commission stack. Resale
              instruction back to you.
            </h3>
            <p className="mt-6 text-[11px] leading-relaxed text-white/40">
              Sources: TwentyCi (2025 fall-through rate), Santander &laquo;Fixing
              the Broken Chain&raquo; (cost per fall-through), HomeOwners Alliance
              (UK quick-sale market norms).
            </p>
          </div>
        </div>
      </section>

      {/* ————— THE WEDGE: TWO COMMISSIONS ————— */}
      <section
        id="how"
        className="border-b border-[#EBE1DB]/70 bg-[#F6ECE7] px-6 py-24 md:px-12 md:py-28"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
          <div>
            <SectionNumber>02</SectionNumber>
            <Eyebrow className="mt-5">the honest version</Eyebrow>
            <h2 className="mt-4 font-serif text-4xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-5xl">
              You don&rsquo;t lose a commission.{' '}
              <span className="italic font-normal text-brand">
                You earn two.
              </span>
            </h2>
            <p className="mt-6 text-[15px] leading-relaxed text-stone-600">
              The reason agents avoid cash-buyer referrals isn&rsquo;t the fee
              &mdash; it&rsquo;s the second commission they lose: the onward
              purchase, the part-exchange chain, the resale instruction.
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-stone-600">
              We solve that one explicit way:{' '}
              <strong className="font-medium text-[#2B2220]">
                when we resell the property, you list it.
              </strong>{' '}
              One referral, two transactions on your books.
            </p>
          </div>
          <div className="rounded-sm border border-[#E4D8D1] bg-white p-8 md:p-10">
            <p className="font-serif text-sm italic text-stone-500">
              Worked example &middot; £280k chain-break sale
            </p>
            <dl className="mt-6 space-y-5">
              <div className="flex items-baseline justify-between gap-6 border-b border-[#EBE1DB] pb-4">
                <dt>
                  <p className="font-serif text-[17px]">Sale fee</p>
                  <p className="text-[12px] text-stone-500">
                    Paid on our purchase completion
                  </p>
                </dt>
                <dd className="font-serif text-2xl font-semibold text-[#2B2220]">
                  £2,800
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-6 border-b border-[#EBE1DB] pb-4">
                <dt>
                  <p className="font-serif text-[17px]">Resale instruction</p>
                  <p className="text-[12px] text-stone-500">
                    Paid on resale &mdash; conditional
                  </p>
                </dt>
                <dd className="font-serif text-2xl font-semibold text-stone-400">
                  £4,480
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-6 pt-2">
                <dt className="font-serif text-sm italic text-brand">
                  Total earnings
                </dt>
                <dd className="font-serif text-3xl font-semibold text-brand">
                  Up to £7,280
                </dd>
              </div>
            </dl>
            <p className="mt-6 text-[11px] leading-relaxed text-stone-500">
              All figures + VAT. All disclosed to the seller in writing per
              NTSELAT guidance.
            </p>
          </div>
        </div>
      </section>

      {/* ————— THE PROMISE ————— */}
      <section
        id="promise"
        className="relative overflow-hidden border-b border-[#EBE1DB]/70 px-6 py-24 md:px-12 md:py-28"
      >
        <div className="mx-auto max-w-4xl">
          <div className="flex items-start justify-between gap-8">
            <div>
              <SectionNumber>03</SectionNumber>
              <Eyebrow className="mt-5">the written promise</Eyebrow>
              <h2 className="mt-4 font-serif text-4xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-5xl">
                No re-trade.{' '}
                <span className="italic font-normal text-brand">In writing.</span>
              </h2>
            </div>
            <Seal label="Bellwoods Lane" className="mt-2 hidden shrink-0 sm:inline-flex" />
          </div>
          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-stone-600">
            Quietly cutting the offer days before exchange is the most-cited
            complaint UK estate agents have about cash buyers. We make it
            contractually impossible &mdash; with one transparent exception.
          </p>
          <dl className="mt-12 divide-y divide-[#EBE1DB] border-y border-[#EBE1DB]">
            {[
              {
                t: 'The price is the price',
                d: 'The figure in your client’s offer document is the figure at completion. We are contractually liable for £1,000 plus your costs if we walk without cause.',
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
                <dt className="font-serif text-[17px] italic text-brand-deep">
                  {row.t}
                </dt>
                <dd className="text-[15px] leading-relaxed text-stone-700">
                  {row.d}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ————— THE 5-STEP PROCESS ————— */}
      <section
        id="process"
        className="border-b border-[#EBE1DB]/70 bg-white px-6 py-24 md:px-12 md:py-28"
      >
        <div className="mx-auto max-w-5xl">
          <SectionNumber>04</SectionNumber>
          <Eyebrow className="mt-5">how the process actually runs</Eyebrow>
          <h2 className="mt-4 font-serif text-4xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-5xl">
            Five steps. Published timelines.{' '}
            <span className="italic font-normal text-brand">
              Honest about what each one means.
            </span>
          </h2>
          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-stone-600">
            We never describe our offers as &ldquo;instant&rdquo; or
            &ldquo;guaranteed&rdquo; at enquiry &mdash; the indicative offer is a
            starting point, the confirmed offer comes after we&rsquo;ve viewed.
            Here&rsquo;s exactly what happens, in order, with the SLAs we commit
            to.
          </p>
          <ol className="mt-12 divide-y divide-[#EBE1DB] border-y border-[#EBE1DB]">
            {[
              {
                n: '01',
                t: 'Acknowledgement',
                sla: '4 business hours',
                d: 'Seller or agent submits the property. We acknowledge receipt and may ask clarifying questions. Where we can pull from public records (Land Registry, EPC register, planning portal), we do — we only ask the seller for what we genuinely need.',
              },
              {
                n: '02',
                t: 'Indicative offer',
                sla: 'After desk research',
                d: 'We send an indicative offer range based on comparable sales, PropertyData valuation, and public property records. Clearly labelled INDICATIVE. Our honest starting point — not a number we intend to change, but one that must be confirmed after viewing.',
              },
              {
                n: '03',
                t: 'Property viewing',
                sla: 'Required before confirmed offer',
                d: 'We physically view every property before issuing a confirmed offer. We assess overall condition, visible defects, and anything not clear from public records. We tell the seller in advance what we are looking for.',
              },
              {
                n: '04',
                t: 'Confirmed offer in writing',
                sla: 'Within 24 hours of viewing',
                d: 'After viewing, we issue our confirmed purchase price in writing. This is the price we complete at. We share the survey notes that informed it. Locked for 72 hours, walk-away cover £1,000 + costs.',
              },
              {
                n: '05',
                t: 'Conveyancing and completion',
                sla: 'Weeks not months',
                d: 'We instruct our solicitors same day. The seller instructs theirs (their choice — we never require a specific firm). We provide regular updates through to exchange and completion, surfaced on the live timeline page the seller can share with anyone.',
              },
            ].map((s) => (
              <li
                key={s.n}
                className="grid grid-cols-[48px_1fr] items-start gap-6 py-7 md:grid-cols-[72px_1fr_220px] md:gap-8"
              >
                <span className="font-serif text-3xl font-light text-brand-deep/30 tabular-nums md:text-4xl">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-serif text-xl font-semibold md:text-2xl">
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

      {/* ————— THE PROOF ————— */}
      <section className="border-b border-[#EBE1DB]/70 bg-brand-deep px-6 py-24 text-white md:px-12 md:py-28">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 lg:grid-cols-2">
          <div>
            <Eyebrow tone="light">what your client receives</Eyebrow>
            <h2 className="mt-4 font-serif text-4xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-5xl">
              A signed offer document.
              <br />
              <span className="italic font-normal text-[#f0c9c0]">
                Not a phone call.
              </span>
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-white/70">
              After viewing, within 24 hours you and your client both receive a
              PDF offer document. Reference number, confirmed amount, completion
              timeline, walk-away cover. The price we confirm is the price we
              complete at. No ambiguity. No verbal commitments to remember.
            </p>
          </div>
          <div className="lg:pl-6">
            <SampleOfferDocument />
          </div>
        </div>
      </section>

      {/* ————— REFER ————— */}
      <section
        id="refer"
        className="border-b border-[#EBE1DB]/70 px-6 py-24 md:px-12 md:py-28"
      >
        <div className="mx-auto max-w-4xl">
          <Eyebrow>60 seconds to a real number</Eyebrow>
          <h2 className="mt-4 font-serif text-4xl font-semibold tracking-[-0.02em] md:text-5xl">
            Send the address.
          </h2>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-stone-600">
            Five fields. The indicative figure appears as soon as you submit
            &mdash; pulled from HM Land Registry comps. The signed binding offer
            document follows by email within 24 hours.
          </p>
          <div className="mt-10">
            <AgentQuickForm />
          </div>
          <p className="mt-6 text-center text-[13px] text-stone-500">
            Prefer email?{' '}
            <a
              href="mailto:hello@bellwoodslane.co.uk?subject=Agent%20referral"
              className="text-brand-deep underline underline-offset-4"
            >
              hello@bellwoodslane.co.uk
            </a>{' '}
            &mdash; same 4-hour turnaround in working hours.
          </p>
        </div>
      </section>

      {/* ————— FAQ ————— */}
      <section
        id="faq"
        className="border-b border-[#EBE1DB]/70 px-6 py-24 md:px-12 md:py-28"
      >
        <div className="mx-auto max-w-3xl">
          <Eyebrow>honest answers</Eyebrow>
          <h2 className="mt-4 font-serif text-4xl font-semibold tracking-[-0.02em] md:text-5xl">
            Questions agents ask first.
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

      {/* ————— SELLERS LINK ————— */}
      <section className="border-b border-[#EBE1DB]/70 bg-[#F6ECE7] px-6 py-14 md:px-12">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-5 text-center md:flex-row md:text-left">
          <div>
            <Eyebrow tone="muted">not an agent?</Eyebrow>
            <p className="mt-2 font-serif text-xl text-[#2B2220]">
              Selling your own property?
            </p>
          </div>
          <Button href="/sell" variant="ghost">
            Get a cash offer for your home
          </Button>
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
              <a href="#refer" className="hover:text-brand-deep">
                Send a deal
              </a>
              <Link href="/instant-offer/methodology" className="hover:text-brand-deep">
                Methodology
              </Link>
              <Link href="/why-we-wont-buy-any-home" className="hover:text-brand-deep">
                What we won&rsquo;t buy
              </Link>
              <Link href="/sell" className="hover:text-brand-deep">
                For sellers
              </Link>
              <Link href="/legal/fca-disclosure" className="hover:text-brand-deep">
                Regulatory
              </Link>
              <Link href="/partners/login" className="hover:text-brand-deep">
                Partner sign in
              </Link>
            </nav>
          </div>
          <div className="mt-10 border-t border-[#EBE1DB] pt-6">
            <p className="font-serif text-[12px] italic text-stone-500">
              Property Redress Scheme (PRS) &middot; HMRC AML supervised &middot;
              ICO registered
            </p>
            <p className="mt-4 text-[11px] leading-relaxed text-stone-500">
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
