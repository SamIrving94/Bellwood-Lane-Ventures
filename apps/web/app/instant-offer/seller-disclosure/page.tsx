import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Seller Disclosure Form · Bellwoods Lane',
  robots: 'noindex',
};

export default function SellerDisclosurePage() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-14 print:px-0 print:py-0">
      <style>{`
        @media print {
          @page { size: A4; margin: 18mm; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .no-print { display: none !important; }
          input, textarea { border: 1px solid #94a3b8 !important; }
        }
      `}</style>

      <div className="no-print mb-10 flex items-center justify-between rounded-xl bg-slate-100 p-4 text-sm">
        <span className="text-slate-600">
          Print this form. Your seller signs it before the offer is accepted.
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
          Seller disclosure form
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight">
          Cash offer disclosure &amp; acknowledgement
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Required under Consumer Protection from Unfair Trading Regulations
          2008, Digital Markets, Competition and Consumers Act 2024, and
          National Trading Standards guidance on referral fees.
        </p>
      </header>

      {/* Property + parties */}
      <section className="mt-8">
        <h2 className="mb-3 font-serif text-lg font-semibold">
          Property and parties
        </h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ['Property address', ''],
            ['Seller name(s)', ''],
            ['Referring estate agent firm', ''],
            ['Referring agent contact', ''],
          ].map(([label]) => (
            <label key={label as string} className="block">
              <span className="text-xs uppercase tracking-widest text-slate-500">
                {label}
              </span>
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </label>
          ))}
        </div>
      </section>

      {/* Offer */}
      <section className="mt-8 rounded-xl border-2 border-[#C6A664] bg-[#FAF6EA] p-6">
        <h2 className="mb-3 font-serif text-lg font-semibold">
          Bellwoods Lane cash offer
        </h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-slate-500">
              Offer (£, all-in)
            </span>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-slate-500">
              Offer as % of open-market value
            </span>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-slate-500">
              Target completion date
            </span>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-slate-500">
              Offer valid until
            </span>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </label>
        </div>
      </section>

      {/* Referral fee disclosure */}
      <section className="mt-8">
        <h2 className="mb-3 font-serif text-lg font-semibold">
          Referral fee disclosure
        </h2>
        <p className="text-sm text-slate-700">
          Your estate agent will receive a referral fee if this sale completes
          with Bellwoods Lane. The amount is stated below. This fee is paid by
          Bellwoods Lane and is separate from any standard estate agency commission.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-slate-500">
              Referral fee (% of purchase price)
            </span>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-slate-500">
              Sale fee paid to agent (% of purchase price)
            </span>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </label>
        </div>
      </section>

      {/* Key acknowledgements */}
      <section className="mt-8">
        <h2 className="mb-3 font-serif text-lg font-semibold">
          Acknowledgements (initial each)
        </h2>
        <ol className="space-y-3 text-sm">
          {[
            'I understand the offer is below open-market value and the reasons (speed, certainty, cash completion, no chain).',
            'I understand I have the right to seek independent legal advice before accepting.',
            'I understand I may withdraw without penalty at any time before exchange of contracts.',
            'I understand Bellwoods Lane is paying a referral fee to my estate agent as disclosed above.',
            'I understand Bellwoods Lane is a cash buyer, not an FCA-authorised firm, and is registered for AML supervision with HMRC.',
            'I understand Bellwoods Lane will only adjust the offer if a survey reveals material issues previously undisclosed — and I have 48 hours to withdraw free of charge in that scenario.',
            'I have not been pressured and have had reasonable time to consider this decision.',
          ].map((t, i) => (
            <li key={i} className="flex items-start gap-3 rounded-lg bg-white p-4">
              <input
                type="text"
                maxLength={3}
                className="mt-0.5 h-9 w-16 shrink-0 rounded border border-slate-300 bg-slate-50 text-center text-xs uppercase"
                placeholder="Init."
              />
              <span className="text-slate-700">{t}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Vulnerable seller declaration */}
      <section className="mt-8 rounded-xl bg-slate-50 p-6">
        <h2 className="mb-3 font-serif text-lg font-semibold">
          Vulnerability declaration
        </h2>
        <p className="text-sm text-slate-700">
          In line with the Digital Markets, Competition and Consumers Act
          2024, Bellwoods Lane operates additional safeguards where a seller may be
          in a vulnerable position (recent bereavement, financial distress,
          health-related, language barrier, elderly). If you wish to
          indicate that you are in a vulnerable position, please tick below
          — this will not affect your offer, but may slow the process to
          ensure you have appropriate time and support.
        </p>
        <label className="mt-4 flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1 h-4 w-4" />
          <span className="text-slate-700">
            I identify as a vulnerable seller and wish Bellwoods Lane&apos;s
            additional safeguards to apply.
          </span>
        </label>
      </section>

      {/* Signatures */}
      <section className="mt-10 grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">
            Seller signature
          </p>
          <div className="mt-1 h-16 border-b-2 border-slate-400" />
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <label className="block">
              <span className="text-slate-500">Name</span>
              <input
                type="text"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1"
              />
            </label>
            <label className="block">
              <span className="text-slate-500">Date</span>
              <input
                type="text"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1"
              />
            </label>
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">
            Witness (estate agent)
          </p>
          <div className="mt-1 h-16 border-b-2 border-slate-400" />
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <label className="block">
              <span className="text-slate-500">Name</span>
              <input
                type="text"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1"
              />
            </label>
            <label className="block">
              <span className="text-slate-500">Date</span>
              <input
                type="text"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1"
              />
            </label>
          </div>
        </div>
      </section>

      <footer className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-500">
        Bellwoods Lane Ltd · NAPB member · TPO redress scheme member · HMRC
        AML supervised · Disclosure compliant with CPR 2008, DMCC 2024, NTS
        referral-fee guidance.
      </footer>
    </div>
  );
}
