import { LogoLockup } from '@/components/brand';
import type { Metadata } from 'next';
import Link from 'next/link';
import { KeyholeLookupForm } from './lookup-form';

/**
 * Keyhole — the free condition-and-value report for professionals
 * (docs/prds/keyhole-v1-2026-08.md, Phase 0).
 *
 * Closed pilot: noindex, reached by invitation link only. The page must stay
 * genuinely neutral to be usable by regulated professionals — it explains
 * what the report is, states plainly what it is not (a valuation, a
 * listing, an obligation), and the referral to us is opt-in on the report
 * page, never here.
 */

export const metadata: Metadata = {
  title: 'Keyhole: condition and value context for a property · Kept',
  description:
    'A one-page report for professionals: EPC condition, the street’s recorded sales, and typical refurbishment cost bands. Public data, shown honestly.',
  robots: { index: false, follow: false },
};

const AUDIENCES = [
  {
    title: 'Probate and private-client solicitors',
    body: 'Give executors a same-day, defensible view of an estate property’s condition and the street’s recorded sales, without waiting on three agent opinions.',
  },
  {
    title: 'Surveyors',
    body: 'A public-data appendix for reports you already write: EPC history, sold prices, refurbishment cost bands for the floor area.',
  },
  {
    title: 'Wealth managers and private bankers',
    body: 'A quiet, factual page for clients holding inherited or second homes, when the question of keeping or selling starts to form.',
  },
  {
    title: 'Later-life and care-transition advisers',
    body: 'Help a family see a property’s position clearly at a sensitive moment, on facts rather than guesses.',
  },
];

export default function KeyholePage() {
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-hair border-b bg-white">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-6 px-5 py-3.5 md:px-10">
          <LogoLockup />
          <Link
            className="text-[13.5px] text-stone-600 transition-colors hover:text-forest"
            href="/"
          >
            wearekept.co.uk
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-5 pb-24 md:px-10">
        <section className="grid grid-cols-1 items-start gap-10 pt-10 md:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-16">
          <div>
            <p className="text-[#8B9489] text-[10.5px] uppercase tracking-[0.2em] [font-family:var(--font-courier)]">
              For professionals · closed pilot
            </p>
            <h1 className="mt-5 text-balance font-bold font-serif text-[clamp(34px,5vw,52px)] text-forest leading-[1.06] tracking-[-0.03em]">
              Keyhole
            </h1>
            <p className="mt-4 max-w-[54ch] text-[17px] text-body leading-[1.65]">
              Condition and value context for one property, on one page. Enter
              an address and get the EPC record, the street&apos;s recorded
              sales from HM Land Registry, and typical refurbishment cost bands
              for the floor area. Free for professional use, and yours to share
              with your client.
            </p>

            <ul className="mt-8 space-y-3 text-[15px] text-body leading-[1.6]">
              <li>
                <strong className="text-forest">
                  Public data, shown honestly.
                </strong>{' '}
                Where a register has no record, the report says so instead of
                guessing.
              </li>
              <li>
                <strong className="text-forest">Not a valuation.</strong> The
                report never prices the property. It shows what was recorded and
                what work typically costs: an honest steer, not a figure.
              </li>
              <li>
                <strong className="text-forest">
                  No listing, no obligation.
                </strong>{' '}
                Nothing is marketed and nobody is contacted. If a fast, certain
                sale ever matters, there is one clearly labelled, opt-in way to
                ask us, and it is never the default.
              </li>
            </ul>

            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {AUDIENCES.map((a) => (
                <div
                  className="rounded-[2px] border border-hair bg-white px-5 py-4"
                  key={a.title}
                >
                  <p className="font-semibold text-[14.5px] text-forest">
                    {a.title}
                  </p>
                  <p className="mt-1.5 text-[13.5px] text-body leading-[1.55]">
                    {a.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <KeyholeLookupForm />
        </section>

        <p className="mt-16 border-hair border-t pt-6 text-[12.5px] text-stone-500 leading-[1.6]">
          Keyhole is provided by Kept (Bellwoods Lane Ventures Ltd). Sold prices
          are HM Land Registry Price Paid Data, Crown copyright, under the Open
          Government Licence. Energy data is from the official EPC register.
          Refurbishment bands are typical cost ranges, not quotes. The report is
          information, not advice, and not a valuation for lending, probate or
          tax purposes.
        </p>
      </main>
    </div>
  );
}
