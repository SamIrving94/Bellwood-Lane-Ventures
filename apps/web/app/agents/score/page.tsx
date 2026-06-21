import type { Metadata } from 'next';
import Link from 'next/link';
import { BellwoodScoreForm } from './bellwood-score-form';

export const metadata: Metadata = {
  title: 'Bellwood Score · An indicative range in seconds · Bellwoods Lane',
  description:
    'A free tool for UK estate agents. Enter postcode + property details, get an indicative offer range during a valuation appointment. Based on publicly available data — not a substitute for viewing.',
  robots: 'noindex',
};

export const dynamic = 'force-dynamic';

export default function BellwoodScorePage() {
  return (
    <main className="min-h-screen bg-[#FBF8F5] px-6 py-12 md:px-12 md:py-16">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/agents"
          className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-stone-500 transition hover:text-[#874646]"
        >
          <span aria-hidden>←</span> Back to agents
        </Link>

        <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.22em] text-[#DB5C5C]">
          Bellwood Score · For partner agents
        </p>
        <h1
          className="mt-3 font-serif font-semibold leading-[1.02] tracking-[-0.025em] text-[#2B2220]"
          style={{ fontSize: 'clamp(32px, 5vw, 52px)' }}
        >
          An indicative offer range you can show a seller{' '}
          <span className="italic text-[#DB5C5C]">
            before you&rsquo;ve left their living room.
          </span>
        </h1>
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-stone-600">
          Enter the postcode and a few details. We pull comparable sales,
          PropertyData valuation, and EPC + tenure data, then return an
          indicative range in seconds. <strong>Clearly labelled INDICATIVE.</strong>{' '}
          Our confirmed offer is issued after a physical viewing and may differ
          — see the three documented exceptions on{' '}
          <Link
            href="/legal/fca-disclosure"
            className="text-[#874646] underline"
          >
            our regulatory disclosure
          </Link>
          .
        </p>

        <div className="mt-10 rounded-2xl border border-stone-200 bg-white p-6 md:p-8">
          <BellwoodScoreForm />
        </div>

        <div className="mt-10 rounded-2xl border border-dashed border-stone-300 bg-stone-50/50 p-5 text-sm text-stone-600">
          <p className="font-medium text-stone-800">
            What this is, and what it isn&rsquo;t
          </p>
          <ul className="mt-2 space-y-1.5">
            <li>
              · An <strong>indicative range</strong> based on publicly
              available data. Real PropertyData calls. Real Land Registry
              comparables.
            </li>
            <li>
              · <strong>Not a guarantee.</strong> Bellwood&rsquo;s confirmed
              offer is issued after a physical viewing and may differ.
            </li>
            <li>
              · <strong>Not a regulated valuation.</strong> Not RICS Red Book.
              For internal use during a valuation appointment.
            </li>
            <li>
              · <strong>Free.</strong> No login. Powered by PropertyData (69 UK
              property endpoints).
            </li>
          </ul>
        </div>

        <p className="mt-12 font-mono text-[10px] uppercase tracking-[0.22em] text-stone-400">
          Bellwoods Lane Ltd · Property Redress Scheme (PRS) · HMRC AML
          supervised · ICO registered
        </p>
      </div>
    </main>
  );
}
