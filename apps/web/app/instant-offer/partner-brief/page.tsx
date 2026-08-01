import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agent Partner Brief · Kept',
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

      <div className="no-print mb-10 flex items-center justify-between rounded-xl bg-stone-100 p-4 text-sm">
        <span className="text-stone-600">
          Press{' '}
          <kbd className="rounded bg-white px-2 py-1 text-xs">Ctrl + P</kbd> (or{' '}
          <kbd className="rounded bg-white px-2 py-1 text-xs">⌘ + P</kbd>) to
          save this as a PDF.
        </span>
        <a
          href="/instant-offer"
          className="text-sm text-stone-600 underline underline-offset-4"
        >
          ← Back
        </a>
      </div>

      <header className="border-leaf border-b-2 pb-6">
        <p className="font-semibold font-serif text-xl tracking-tight">
          BELLWOODS
          <span className="mx-2 inline-block h-px w-8 bg-wax align-middle" />
          <span className="font-normal text-sm text-stone-500 tracking-widest">
            LANE
          </span>
        </p>
        <p className="mt-4 text-leaf text-xs uppercase tracking-widest">
          Agent Partner Brief
        </p>
        <h1 className="mt-2 font-semibold font-serif text-4xl leading-tight">
          The UK cash buyer built for estate agents.
        </h1>
      </header>

      <section className="mt-10 space-y-6">
        <p className="text-base text-stone-700 leading-relaxed">
          Kept is a UK direct-to-vendor cash property buyer. We
          partner exclusively with estate agents to rescue chain breaks, probate
          sales, repossessions, and problem properties that conventional buyers
          will not touch.
        </p>

        <div className="grid grid-cols-2 gap-4 border-stone-200 border-y py-8">
          {[
            ['In writing', 'Every confirmed offer'],
            ['Weeks not months', 'Target completion'],
            ['Per deal, in writing', 'Partner fee terms'],
            ['Zero', 'Fees charged to the seller'],
          ].map(([v, l]) => (
            <div key={l}>
              <p className="font-semibold font-serif text-3xl text-forest">
                {v}
              </p>
              <p className="text-stone-500 text-xs uppercase tracking-widest">
                {l}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-semibold font-serif text-2xl">
          What you earn per referral
        </h2>
        <p className="mt-3 text-sm text-stone-600">
          Your terms are agreed in writing per deal. You keep your commission on
          the sale, and when we resell we instruct you. Exact figures are
          confirmed before the deal proceeds and disclosed to the seller in
          writing per NTSELAT guidance.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-semibold font-serif text-2xl">The four promises</h2>
        <ol className="mt-4 space-y-4 text-sm text-stone-700">
          {[
            {
              t: '1. Indicative offer, fast',
              b: 'Submit the property details and receive an indicative offer range based on comparable sales and PropertyData. We aim to make a confirmed offer within 24–48 hours of viewing the property.',
            },
            {
              t: '2. No price cuts',
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
            <li key={p.t} className="rounded-xl bg-soft p-5">
              <p className="font-semibold">{p.t}</p>
              <p className="mt-2 text-stone-600">{p.b}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="font-semibold font-serif text-2xl">Who we buy from</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-stone-700 md:grid-cols-3">
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
              className="rounded-lg border border-stone-200 bg-white px-3 py-2"
            >
              {t}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-semibold font-serif text-2xl">How to refer</h2>
        <ol className="mt-4 space-y-3 text-sm text-stone-700">
          <li>
            <strong>1.</strong> Send us the property address + seller situation
            by email, WhatsApp, or via our indicative offer tool.
          </li>
          <li>
            <strong>2.</strong> We send you the indicative offer, and we aim to
            confirm the price within 24–48 hours of viewing.
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

      <section className="mt-10 rounded-2xl border-2 border-forest bg-forest p-8 text-white">
        <p className="text-leaf text-xs uppercase tracking-widest">Contact</p>
        <p className="mt-3 font-semibold font-serif text-2xl">Anthony</p>
        <p className="text-sm text-white/70">Founder · Kept</p>
        <div className="mt-4 grid grid-cols-1 gap-1 text-sm md:grid-cols-2">
          <p>Email: anthony@bellwoodslane.co.uk</p>
          <p>Web: bellwoodslane.co.uk/agents</p>
        </div>
      </section>

      <footer className="mt-10 border-stone-200 border-t pt-6 text-stone-500 text-xs">
        <p>
          Kept is a UK cash property buyer. Member of the Property
          Redress Scheme (PRS), HMRC-registered for AML supervision under the
          Money Laundering Regulations 2017, and ICO-registered as a data
          controller. Fees disclosed to sellers in writing per NTSELAT /
          National Trading Standards guidance and the Digital Markets,
          Competition and Consumers Act 2024. This
          document is intended for professional recipients only.
        </p>
      </footer>
    </div>
  );
}
