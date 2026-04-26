import Link from 'next/link';
import { AgentQuickForm } from './components/agent-quick-form';
import { LivePill } from '../instant-offer/components/live-pill';

export const revalidate = 300;

const SITUATIONS_WE_BUY: Array<{ k: string; b: string }> = [
  {
    k: 'Chain break',
    b: 'Buyer pulled out at exchange. We complete in 14\u201328 days so the chain holds and your fee survives.',
  },
  {
    k: 'Probate',
    b: 'IHT clock ticking, executors scattered. We flex completion to the grant date and absorb the AML weight.',
  },
  {
    k: 'Problem property',
    b: 'Knotweed, short lease, cladding, structural. Stock high-street lenders won\u2019t mortgage \u2014 we buy at fair value and carry the risk.',
  },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Will my client think I sold them short?',
    a: "No \u2014 because the offer is below open-market by a published, defensible margin (a speed premium for cash + 14\u201328 day completion + zero fall-through risk). You hand them the methodology page and a signed offer. They make the call.",
  },
  {
    q: 'When and how do I get paid?',
    a: 'On completion of our purchase from your client. We pay your standard sale fee, plus 1% + VAT introducer fee. When we resell through you, that\u2019s another 1% + VAT. All disclosed to the seller in writing per NTSELAT guidance.',
  },
  {
    q: 'How are you different from other cash buyers?',
    a: 'Three ways. (1) We pay you up to 3% + VAT \u2014 most national cash buyers cut the agent out entirely. (2) Our offer is contractually fixed in the seller\u2019s offer document; if we walk without cause, we pay you \u00a31,000 plus your costs. (3) When we resell the property, we instruct you. National cash buyers flip through their own channels and the property never comes back to you.',
  },
  {
    q: 'What if you re-trade my client at exchange?',
    a: 'You collect \u00a31,000 from us, plus your costs, in writing. The price in your client\u2019s offer document is the price at completion. The single legitimate exception is a RICS-survey-disclosed material defect \u2014 and your client gets 48 hours to walk away free of charge.',
  },
  {
    q: 'What about my AML obligations on the seller?',
    a: 'We carry the load. Bellwoods Lane is HMRC-registered for AML supervision. We run KYC and source-of-funds checks, then issue a written compliance receipt for your file.',
  },
  {
    q: 'What\u2019s your completion rate?',
    a: 'We are a new firm and committed to publishing our completion rate quarterly from launch \u2014 including failures. Our promise: any offer issued is binding for 72 hours, and any post-survey adjustment requires a disclosed material defect. If we walk without cause, we pay \u00a31,000 plus your costs.',
  },
  {
    q: 'What if my client decides to stay on the open market?',
    a: 'You instruct the property as normal. We pay you a small introducer fee for the warm lead. No referral wasted, no awkward conversation.',
  },
  {
    q: 'Are you regulated?',
    a: 'Cash property buying is unregulated by the FCA. We voluntarily follow The Property Ombudsman code and are NAPB members. See our regulatory disclosure for full detail.',
  },
];

function SampleOfferDocument() {
  return (
    <div className="relative mx-auto max-w-md rotate-[-1.5deg] rounded-2xl border border-slate-200 bg-white p-7 shadow-xl">
      <div className="absolute right-5 top-5 rounded-full border border-[#C6A664] px-3 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-[#C6A664]">
        Sample
      </div>
      <p className="font-serif text-base font-semibold tracking-tight">
        BELLWOODS
        <span className="mx-1.5 inline-block h-px w-5 bg-[#C6A664] align-middle" />
        <span className="text-[10px] font-normal tracking-[0.22em] text-slate-500">
          LANE
        </span>
      </p>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400">
        Binding offer document &middot; Ref BW-2026-0142
      </p>

      <div className="mt-6 space-y-1 border-t border-slate-100 pt-5">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400">
          Property
        </p>
        <p className="font-serif text-[15px] leading-snug text-slate-700">
          14 Acacia Avenue, Stockport, SK4 3HQ
        </p>
      </div>

      <div className="mt-5 rounded-xl bg-[#FAF6EA] px-5 py-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#C6A664]">
          Our cash offer
        </p>
        <p className="mt-1 font-serif text-4xl font-semibold tracking-[-0.025em] text-[#0A1020]">
          £244,000
        </p>
        <p className="mt-1 text-[10px] text-slate-500">
          83% of mid AVM &middot; locked 72h
        </p>
      </div>

      <dl className="mt-5 space-y-2 text-[12px]">
        <div className="flex justify-between">
          <dt className="text-slate-500">Completion</dt>
          <dd className="font-medium text-slate-700">21 days</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Survey adjustment</dt>
          <dd className="font-medium text-slate-700">
            RICS material defect only
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Walk-away cover</dt>
          <dd className="font-medium text-slate-700">£1,000 + costs</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Introducer (your firm)</dt>
          <dd className="font-medium text-slate-700">2% + VAT</dd>
        </div>
      </dl>

      <p className="mt-6 border-t border-slate-100 pt-4 font-serif text-[11px] italic leading-relaxed text-slate-500">
        Signed for and on behalf of Bellwoods Lane Ltd. This offer is legally
        binding upon Bellwoods Lane Ltd for 72 hours from issue.
      </p>
    </div>
  );
}

export default function AgentsPage() {
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
            <a href="#how" className="hover:text-[#0A2540]">
              How it works
            </a>
            <a href="#faq" className="hover:text-[#0A2540]">
              FAQ
            </a>
            <Link href="/sell" className="hover:text-[#0A2540]">
              For sellers
            </Link>
            <Link
              href="/partners/login"
              className="hover:text-[#0A2540]"
            >
              Partner sign in
            </Link>
            <a
              href="#refer"
              className="rounded-full bg-[#0A2540] px-5 py-2 text-white transition hover:bg-[#13365c]"
            >
              Send a deal
            </a>
          </nav>
        </div>
      </header>

      {/* ————— HERO ————— */}
      <section className="px-6 pt-20 pb-16 md:px-12 md:pt-28 md:pb-24">
        <div className="mx-auto max-w-4xl">
          <LivePill>For UK estate agents</LivePill>
          <h1
            className="mt-8 font-serif font-semibold leading-[0.98] tracking-[-0.025em] text-[#0A1020]"
            style={{ fontSize: 'clamp(40px, 6vw, 72px)' }}
          >
            Save the deal.
            <br />
            <span className="italic text-[#C6A664]">No re-trade. In writing.</span>
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-slate-600">
            A binding cash offer for chain-break, probate and problem
            properties. The price your client accepts is the price they
            complete at &mdash; or we pay you £1,000 plus your costs.
          </p>
          <div className="mt-10">
            <a
              href="#refer"
              className="inline-flex items-center gap-2 rounded-full bg-[#0A2540] px-8 py-4 text-[15px] font-medium text-white shadow-sm transition hover:bg-[#13365c]"
            >
              Send us a property
              <span aria-hidden>→</span>
            </a>
          </div>
        </div>
      </section>

      {/* ————— THE WEDGE: TWO COMMISSIONS ————— */}
      <section
        id="how"
        className="border-y border-slate-200/60 bg-[#FAF6EA] px-6 py-24 md:px-12 md:py-28"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
              The honest version
            </p>
            <h2 className="mt-3 font-serif text-4xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-5xl">
              You don&rsquo;t lose a commission.
              <br />
              <span className="italic text-[#C6A664]">You earn two.</span>
            </h2>
            <p className="mt-6 text-[15px] leading-relaxed text-slate-600">
              The reason agents avoid cash-buyer referrals isn&rsquo;t the
              fee &mdash; it&rsquo;s the second commission they lose: the
              onward purchase, the part-exchange chain, the resale instruction.
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
              We solve that one explicit way:{' '}
              <strong className="text-[#0A1020]">
                when we resell the property, you list it.
              </strong>{' '}
              One referral, two transactions on your books.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-8 md:p-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
              Worked example, £280k chain-break sale
            </p>
            <dl className="mt-6 space-y-5">
              <div className="flex items-baseline justify-between gap-6 border-b border-slate-100 pb-4">
                <dt>
                  <p className="font-serif text-[17px]">Sale fee</p>
                  <p className="text-[12px] text-slate-500">
                    Paid on our purchase completion
                  </p>
                </dt>
                <dd className="font-serif text-2xl font-semibold text-[#0A1020]">
                  £2,800
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-6 border-b border-slate-100 pb-4">
                <dt>
                  <p className="font-serif text-[17px]">Introducer fee</p>
                  <p className="text-[12px] text-slate-500">
                    Same day as the sale fee
                  </p>
                </dt>
                <dd className="font-serif text-2xl font-semibold text-[#0A1020]">
                  £2,800
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-6 border-b border-slate-100 pb-4">
                <dt>
                  <p className="font-serif text-[17px]">Resale instruction</p>
                  <p className="text-[12px] text-slate-500">
                    Paid on resale &mdash; conditional
                  </p>
                </dt>
                <dd className="font-serif text-2xl font-semibold text-slate-400">
                  £4,480
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-6 pt-2">
                <dt>
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#C6A664]">
                    Total earnings
                  </p>
                </dt>
                <dd className="font-serif text-3xl font-semibold text-[#C6A664]">
                  Up to £10,080
                </dd>
              </div>
            </dl>
            <p className="mt-6 text-[11px] leading-relaxed text-slate-500">
              All figures + VAT. All disclosed to the seller in writing per
              NTSELAT guidance.
            </p>
          </div>
        </div>
      </section>

      {/* ————— THE PROMISE ————— */}
      <section
        id="promise"
        className="border-b border-slate-200/60 px-6 py-24 md:px-12 md:py-28"
      >
        <div className="mx-auto max-w-4xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
            The written promise
          </p>
          <h2 className="mt-3 font-serif text-4xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-5xl">
            No re-trade. In writing.
          </h2>
          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-slate-600">
            Quietly cutting the offer days before exchange is the most-cited
            complaint UK estate agents have about cash buyers. We make it
            contractually impossible &mdash; with one transparent exception.
          </p>
          <dl className="mt-12 divide-y divide-slate-200 border-y border-slate-200">
            <div className="grid grid-cols-1 gap-2 py-6 sm:grid-cols-[260px_1fr] sm:gap-12">
              <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
                The price is the price
              </dt>
              <dd className="text-[15px] leading-relaxed text-slate-700">
                The figure in your client&rsquo;s offer document is the figure
                at completion. We are contractually liable for £1,000 plus
                your costs if we walk without cause.
              </dd>
            </div>
            <div className="grid grid-cols-1 gap-2 py-6 sm:grid-cols-[260px_1fr] sm:gap-12">
              <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
                The one exception
              </dt>
              <dd className="text-[15px] leading-relaxed text-slate-700">
                The offer is adjustable only if a RICS survey reveals a
                material defect your client did not disclose. In which case
                they get 48 hours to walk away free of charge.
              </dd>
            </div>
            <div className="grid grid-cols-1 gap-2 py-6 sm:grid-cols-[260px_1fr] sm:gap-12">
              <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Published quarterly
              </dt>
              <dd className="text-[15px] leading-relaxed text-slate-700">
                We commit to publishing our completion rate every quarter
                &mdash; including failures. No competitor in the UK does
                this.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ————— THE PROOF ————— */}
      <section className="border-b border-slate-200/60 bg-[#0A2540] px-6 py-24 text-white md:px-12 md:py-28">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
              What your client receives
            </p>
            <h2 className="mt-3 font-serif text-4xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-5xl">
              A signed offer document.
              <br />
              Not a phone call.
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-white/70">
              Within 24 hours of you sending us the address, you and your
              client both receive a PDF offer document. Reference number,
              binding amount, completion timeline, walk-away cover. No
              ambiguity. No verbal commitments to remember.
            </p>
          </div>
          <div>
            <SampleOfferDocument />
          </div>
        </div>
      </section>

      {/* ————— REFER ————— */}
      <section
        id="refer"
        className="border-b border-slate-200/60 px-6 py-24 md:px-12 md:py-28"
      >
        <div className="mx-auto max-w-4xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
            Send us a property
          </p>
          <h2 className="mt-3 font-serif text-4xl font-semibold md:text-5xl">
            One short form.
          </h2>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-slate-600">
            Tell us where the property is and what&rsquo;s going on. We email
            you a signed offer document within 24 hours. No portal logins,
            no contract to sign.
          </p>
          <div className="mt-10">
            <AgentQuickForm />
          </div>
          <p className="mt-6 text-center text-[13px] text-slate-500">
            Or email{' '}
            <a
              href="mailto:hello@bellwoodslane.co.uk?subject=Agent%20referral"
              className="text-[#0A2540] underline underline-offset-4"
            >
              hello@bellwoodslane.co.uk
            </a>
            {' '}&mdash; same 24-hour turnaround.
          </p>
        </div>
      </section>

      {/* ————— SITUATIONS ————— */}
      <section className="border-b border-slate-200/60 bg-[#FAF6EA] px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-5xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
            What we buy
          </p>
          <h2 className="mt-3 font-serif text-3xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-4xl">
            The deals other buyers can&rsquo;t do.
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {SITUATIONS_WE_BUY.map((s) => (
              <div key={s.k}>
                <p className="font-serif text-xl font-semibold">{s.k}</p>
                <p className="mt-3 text-[14px] leading-relaxed text-slate-600">
                  {s.b}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ————— FAQ ————— */}
      <section
        id="faq"
        className="border-b border-slate-200/60 px-6 py-24 md:px-12 md:py-28"
      >
        <div className="mx-auto max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
            Honest answers
          </p>
          <h2 className="mt-3 font-serif text-4xl font-semibold md:text-5xl">
            Questions agents ask first.
          </h2>
          <div className="mt-12 divide-y divide-slate-200 border-y border-slate-200">
            {FAQ.map((item, i) => (
              <details key={item.q} className="group py-5" open={i === 0}>
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-serif text-[17px] font-semibold">
                  <span>{item.q}</span>
                  <span className="ml-4 text-xl text-slate-400 transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-4 leading-relaxed text-slate-600">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
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
              <a href="#refer">Send a deal</a>
              <Link href="/instant-offer/methodology">Methodology</Link>
              <Link href="/sell">For sellers</Link>
              <Link href="/legal/fca-disclosure">Regulatory</Link>
              <Link href="/partners/login">Partner sign in</Link>
            </nav>
          </div>
          <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
            HMRC AML supervised &middot; NAPB &middot; TPO redress
          </p>
          <p className="mt-6 font-mono text-[11px] leading-relaxed text-slate-500">
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
