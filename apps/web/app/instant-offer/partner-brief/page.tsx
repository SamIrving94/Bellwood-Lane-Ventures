import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agent Partner Brief · Bellwood Ventures',
  robots: 'noindex',
};

export default function PartnerBriefPage() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-14 print:px-0 print:py-0">
      <style>{`
        @media print {
          @page { size: A4; margin: 18mm; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print mb-10 flex items-center justify-between rounded-xl bg-slate-100 p-4 text-sm">
        <span className="text-slate-600">
          Press <kbd className="rounded bg-white px-2 py-1 text-xs">Ctrl + P</kbd>{' '}
          (or <kbd className="rounded bg-white px-2 py-1 text-xs">⌘ + P</kbd>) to
          save this as a PDF.
        </span>
        <a
          href="/instant-offer"
          className="text-sm text-slate-600 underline underline-offset-4"
        >
          ← Back
        </a>
      </div>

      <header className="border-b-2 border-[#C6A664] pb-6">
        <p className="font-serif text-xl font-semibold tracking-tight">
          BELLWOOD
          <span className="mx-2 inline-block h-px w-8 bg-[#C6A664] align-middle" />
          <span className="text-sm font-normal tracking-widest text-slate-500">
            VENTURES
          </span>
        </p>
        <p className="mt-4 text-xs uppercase tracking-widest text-[#C6A664]">
          Agent Partner Brief
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight">
          The UK cash buyer built for estate agents.
        </h1>
      </header>

      <section className="mt-10 space-y-6">
        <p className="text-base leading-relaxed text-slate-700">
          Bellwood Ventures is a UK direct-to-vendor cash property buyer. We
          partner exclusively with estate agents to rescue chain breaks,
          probate sales, repossessions, and problem properties that
          conventional buyers will not touch.
        </p>

        <div className="grid grid-cols-2 gap-4 border-y border-slate-200 py-8">
          {[
            ['24 hours', 'Offer turnaround'],
            ['14–28 days', 'Target completion'],
            ['Up to 3% + VAT', 'Your commission stack'],
            ['Zero', 'Fees charged to the seller'],
          ].map(([v, l]) => (
            <div key={l}>
              <p className="font-serif text-3xl font-semibold text-[#0A2540]">
                {v}
              </p>
              <p className="text-xs uppercase tracking-widest text-slate-500">
                {l}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl font-semibold">
          What you earn per referral
        </h2>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[#C6A664] text-left text-xs uppercase tracking-widest text-slate-500">
              <th className="py-2">Fee</th>
              <th className="py-2 text-right">Amount</th>
              <th className="py-2 text-right">When paid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            <tr>
              <td className="py-3">Sale fee (standard seller commission)</td>
              <td className="py-3 text-right font-medium">1% + VAT</td>
              <td className="py-3 text-right text-slate-500">
                Our purchase completion
              </td>
            </tr>
            <tr>
              <td className="py-3">Introducer fee</td>
              <td className="py-3 text-right font-medium">1% + VAT</td>
              <td className="py-3 text-right text-slate-500">
                Our purchase completion
              </td>
            </tr>
            <tr>
              <td className="py-3">Resale instruction</td>
              <td className="py-3 text-right font-medium">1% + VAT</td>
              <td className="py-3 text-right text-slate-500">
                Resale completion
              </td>
            </tr>
            <tr className="border-t-2 border-[#C6A664]">
              <td className="py-3 font-semibold">Total per referral</td>
              <td className="py-3 text-right font-semibold text-[#C6A664]">
                Up to 3% + VAT
              </td>
              <td className="py-3 text-right text-slate-500">
                Across two transactions
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl font-semibold">
          The four promises
        </h2>
        <ol className="mt-4 space-y-4 text-sm text-slate-700">
          {[
            {
              t: '1. 24-hour offer',
              b: 'Submit property details — receive a legally binding written offer within 24 hours.',
            },
            {
              t: '2. No re-trade',
              b: 'The price in the offer is the price at completion. Adjustable only if a survey reveals material issues previously undisclosed.',
            },
            {
              t: '3. AML handled',
              b: 'We conduct KYC, source-of-funds checks, and HMRC-compliant AML on the seller. You receive a signed compliance receipt for your file.',
            },
            {
              t: '4. Either outcome',
              b: 'If the seller declines our cash offer, we instruct you to list open-market on standard terms. You earn no matter which route they choose.',
            },
          ].map((p) => (
            <li key={p.t} className="rounded-xl bg-[#FAF6EA] p-5">
              <p className="font-semibold">{p.t}</p>
              <p className="mt-2 text-slate-600">{p.b}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl font-semibold">
          Who we buy from
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-700 md:grid-cols-3">
          {[
            'Chain-break sellers',
            'Probate / executors',
            'Repossession / LPA receivers',
            'Short lease (<80 yrs)',
            'Japanese knotweed',
            'Cladding / EWS1 issues',
            'Subsidence / structural',
            'Non-standard construction',
            'International sellers',
            'Divorce / bankruptcy',
            'Sole-agency expiry',
            'Any cash-only situation',
          ].map((t) => (
            <div
              key={t}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              {t}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl font-semibold">
          How to refer
        </h2>
        <ol className="mt-4 space-y-3 text-sm text-slate-700">
          <li>
            <strong>1.</strong> Send us the property address + seller situation
            by email, WhatsApp, or via our instant offer tool.
          </li>
          <li>
            <strong>2.</strong> We send you the offer within 24 hours.
          </li>
          <li>
            <strong>3.</strong> You present the offer to your seller using our
            written disclosure form (we provide one).
          </li>
          <li>
            <strong>4.</strong> On acceptance, we instruct solicitors and
            complete in 14–28 days. Your fee is paid on completion.
          </li>
        </ol>
      </section>

      <section className="mt-10 rounded-2xl border-2 border-[#0A2540] bg-[#0A2540] p-8 text-white">
        <p className="text-xs uppercase tracking-widest text-[#C6A664]">
          Contact
        </p>
        <p className="mt-3 font-serif text-2xl font-semibold">
          Samir Irving
        </p>
        <p className="text-sm text-white/70">Founder · Bellwood Ventures</p>
        <div className="mt-4 grid grid-cols-1 gap-1 text-sm md:grid-cols-2">
          <p>Email: samir@bellwoodlane.com</p>
          <p>Phone: +44 (0)&nbsp;[phone]</p>
          <p>Web: bellwoodlane.com/instant-offer</p>
        </div>
      </section>

      <footer className="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-500">
        <p>
          Bellwood Ventures Ltd is a UK cash property buyer, registered for
          anti-money-laundering supervision with HMRC, a member of The
          Property Ombudsman (TPO) and the National Association of Property
          Buyers (NAPB). Fees disclosed to sellers in writing per National
          Trading Standards guidance. This document is intended for
          professional recipients only.
        </p>
      </footer>
    </div>
  );
}
