import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agent Partner Brief · Bellwoods Lane',
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
          BELLWOODS
          <span className="mx-2 inline-block h-px w-8 bg-[#C6A664] align-middle" />
          <span className="text-sm font-normal tracking-widest text-slate-500">
            LANE
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
          Bellwoods Lane is a UK direct-to-vendor cash property buyer. We
          partner exclusively with estate agents to rescue chain breaks,
          probate sales, repossessions, and problem properties that
          conventional buyers will not touch.
        </p>

        <div className="grid grid-cols-2 gap-4 border-y border-slate-200 py-8">
          {[
            ['4 business hours', 'Indicative offer ack'],
            ['Weeks not months', 'Target completion'],
            ['Per deal, in writing', 'Partner fee terms'],
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
        <p className="mt-3 text-sm text-slate-600">
          Your partner fee is agreed in writing per deal — typically a sale fee
          on our purchase completion, an introducer fee on the same day, and a
          separate sale instruction when we resell. Exact figures are confirmed
          before the deal proceeds and disclosed to the seller in writing per
          NTSELAT guidance.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl font-semibold">
          The four promises
        </h2>
        <ol className="mt-4 space-y-4 text-sm text-slate-700">
          {[
            {
              t: '1. Indicative offer in 4 business hours',
              b: 'Submit the property details — receive an indicative offer range within 4 business hours, based on comparable sales and PropertyData. Confirmed price issued within 24 hours of viewing.',
            },
            {
              t: '2. No re-trade',
              b: 'The price we confirm is the price we complete at. Adjustable only for the three documented exceptions: structural survey defect, title issue at conveyancing, or materially incorrect information disclosed by the seller.',
            },
            {
              t: '3. AML handled',
              b: 'We conduct KYC, source-of-funds checks, and HMRC-compliant AML on the seller. You receive a signed compliance receipt for your file.',
            },
            {
              t: '4. Resale instruction',
              b: 'When we resell the property, we instruct you. One referral, two transactions on your books.',
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
            by email, WhatsApp, or via our indicative offer tool.
          </li>
          <li>
            <strong>2.</strong> We send you the indicative offer within 4
            business hours, confirmed price within 24 hours of viewing.
          </li>
          <li>
            <strong>3.</strong> You present the offer to your seller using our
            written disclosure form (we provide one).
          </li>
          <li>
            <strong>4.</strong> On acceptance, we instruct solicitors and
            complete in weeks not months. Your fee is paid on completion.
          </li>
        </ol>
      </section>

      <section className="mt-10 rounded-2xl border-2 border-[#0A2540] bg-[#0A2540] p-8 text-white">
        <p className="text-xs uppercase tracking-widest text-[#C6A664]">
          Contact
        </p>
        <p className="mt-3 font-serif text-2xl font-semibold">
          Anthony
        </p>
        <p className="text-sm text-white/70">Founder · Bellwoods Lane</p>
        <div className="mt-4 grid grid-cols-1 gap-1 text-sm md:grid-cols-2">
          <p>Email: anthony@bellwoodslane.co.uk</p>
          <p>Phone: +44 (0)&nbsp;[phone]</p>
          <p>Web: bellwoodslane.co.uk/instant-offer</p>
        </div>
      </section>

      <footer className="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-500">
        <p>
          Bellwoods Lane Ltd is a UK cash property buyer. Member of the
          Property Redress Scheme (PRS), HMRC-registered for AML supervision
          under the Money Laundering Regulations 2017, and ICO-registered as
          a data controller. Fees disclosed to sellers in writing per
          NTSELAT / National Trading Standards guidance and the DMCC Act
          2025. This document is intended for professional recipients only.
        </p>
      </footer>
    </div>
  );
}
