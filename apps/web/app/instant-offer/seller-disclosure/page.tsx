import { Wordmark } from '@/components/brand';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Seller Disclosure Form · Kept',
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

      <div className="no-print mb-10 flex items-center justify-between rounded-xl bg-stone-100 p-4 text-sm">
        <span className="text-stone-600">
          Print this form. Your seller signs it before the offer is accepted.
        </span>
        <a
          href="/instant-offer"
          className="text-sm text-stone-600 underline underline-offset-4"
        >
          ← Back
        </a>
      </div>

      <header className="border-wax border-b-2 pb-6">
        <Wordmark className="text-xl" />
        <p className="mt-4 text-leaf text-xs uppercase tracking-widest">
          Seller disclosure form
        </p>
        <h1 className="mt-2 font-semibold font-serif text-3xl leading-tight">
          Cash offer disclosure &amp; acknowledgement
        </h1>
        <p className="mt-3 text-sm text-stone-600">
          Required under Consumer Protection from Unfair Trading Regulations
          2008, Digital Markets, Competition and Consumers Act 2024, and
          National Trading Standards guidance on referral fees.
        </p>
      </header>

      {/* Property + parties */}
      <section className="mt-8">
        <h2 className="mb-3 font-semibold font-serif text-lg">
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
              <span className="text-stone-500 text-xs uppercase tracking-widest">
                {label}
              </span>
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
              />
            </label>
          ))}
        </div>
      </section>

      {/* Offer */}
      <section className="mt-8 rounded-xl border-2 border-wax bg-soft p-6">
        <h2 className="mb-3 font-semibold font-serif text-lg">
          Kept cash offer
        </h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="block">
            <span className="text-stone-500 text-xs uppercase tracking-widest">
              Offer (£, all-in)
            </span>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-stone-500 text-xs uppercase tracking-widest">
              Offer as % of open-market value
            </span>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-stone-500 text-xs uppercase tracking-widest">
              Target completion date
            </span>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-stone-500 text-xs uppercase tracking-widest">
              Offer valid until
            </span>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
            />
          </label>
        </div>
      </section>

      {/* Referral fee disclosure */}
      <section className="mt-8">
        <h2 className="mb-3 font-semibold font-serif text-lg">
          Referral fee disclosure
        </h2>
        <p className="text-sm text-stone-700">
          Your estate agent will receive a referral fee if this sale completes
          with Kept. The amount is stated below. This fee is paid by
          Kept and is separate from any standard estate agency
          commission.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <label className="block">
            <span className="text-stone-500 text-xs uppercase tracking-widest">
              Referral fee (% of purchase price)
            </span>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-stone-500 text-xs uppercase tracking-widest">
              Sale fee paid to agent (% of purchase price)
            </span>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
            />
          </label>
        </div>
      </section>

      {/* Key acknowledgements */}
      <section className="mt-8">
        <h2 className="mb-3 font-semibold font-serif text-lg">
          Acknowledgements (initial each)
        </h2>
        <ol className="space-y-3 text-sm">
          {[
            'I understand the offer is below open-market value and the reasons (speed, certainty, cash completion, no chain).',
            'I understand I have the right to seek independent legal advice before accepting.',
            'I understand I may withdraw without penalty at any time before exchange of contracts.',
            'I understand Kept is paying a referral fee to my estate agent as disclosed above.',
            'I understand Kept is a cash buyer, not an FCA-authorised firm, and is registered for AML supervision with HMRC.',
            'I understand Kept will only adjust the offer if a survey reveals material issues previously undisclosed — and I have 48 hours to withdraw free of charge in that scenario.',
            'I have not been pressured and have had reasonable time to consider this decision.',
          ].map((t, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-lg bg-white p-4"
            >
              <input
                type="text"
                maxLength={3}
                className="mt-0.5 h-9 w-16 shrink-0 rounded border border-stone-300 bg-stone-50 text-center text-xs uppercase"
                placeholder="Init."
              />
              <span className="text-stone-700">{t}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Vulnerable seller declaration */}
      <section className="mt-8 rounded-xl bg-stone-50 p-6">
        <h2 className="mb-3 font-semibold font-serif text-lg">
          Vulnerability declaration
        </h2>
        <p className="text-sm text-stone-700">
          In line with the Digital Markets, Competition and Consumers Act 2024,
          Kept operates additional safeguards where a seller may be in
          a vulnerable position (recent bereavement, financial distress,
          health-related, language barrier, elderly). If you wish to indicate
          that you are in a vulnerable position, please tick below — this will
          not affect your offer, but may slow the process to ensure you have
          appropriate time and support.
        </p>
        <label className="mt-4 flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1 h-4 w-4" />
          <span className="text-stone-700">
            I identify as a vulnerable seller and wish Kept&apos;s
            additional safeguards to apply.
          </span>
        </label>
      </section>

      {/* Signatures */}
      <section className="mt-10 grid grid-cols-2 gap-6">
        <div>
          <p className="text-stone-500 text-xs uppercase tracking-widest">
            Seller signature
          </p>
          <div className="mt-1 h-16 border-stone-400 border-b-2" />
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <label className="block">
              <span className="text-stone-500">Name</span>
              <input
                type="text"
                className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2 py-1"
              />
            </label>
            <label className="block">
              <span className="text-stone-500">Date</span>
              <input
                type="text"
                className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2 py-1"
              />
            </label>
          </div>
        </div>
        <div>
          <p className="text-stone-500 text-xs uppercase tracking-widest">
            Witness (estate agent)
          </p>
          <div className="mt-1 h-16 border-stone-400 border-b-2" />
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <label className="block">
              <span className="text-stone-500">Name</span>
              <input
                type="text"
                className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2 py-1"
              />
            </label>
            <label className="block">
              <span className="text-stone-500">Date</span>
              <input
                type="text"
                className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2 py-1"
              />
            </label>
          </div>
        </div>
      </section>

      <footer className="mt-12 border-stone-200 border-t pt-6 text-stone-500 text-xs">
        Kept · Property Redress Scheme (PRS) · HMRC AML supervised
        · ICO registered · Disclosure compliant with CPR 2008, DMCC Act 2025,
        NTSELAT referral-fee guidance.
      </footer>
    </div>
  );
}
