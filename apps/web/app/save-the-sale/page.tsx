import Link from 'next/link';
import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import { AgentQuickForm } from '../agents/components/agent-quick-form';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Sale fallen through? · Bellwoods Lane',
  description:
    'Buyer pulled out, mortgage refused, survey down-valued or chain broken? An indicative cash figure on screen in 60 seconds. Signed binding offer in 4 working hours. For UK estate agents.',
  openGraph: {
    title: 'Sale fallen through? · Bellwoods Lane',
    description:
      'Cash figure in 60 seconds, signed offer in 4 hours. For UK estate agents whose sale just collapsed.',
    type: 'website',
  },
};

export default function SaveTheSalePage() {
  return (
    <div
      className={`${fraunces.variable} ${inter.variable} min-h-screen bg-[#FAFAF7] font-sans text-[#0A1020] antialiased`}
    >
      {/* ————— MINIMAL HEADER ————— */}
      <header className="border-b border-slate-200/60 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4 md:px-10">
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
          <Link
            href="/agents"
            className="text-[13px] text-slate-500 underline-offset-4 hover:text-[#0A2540] hover:underline"
          >
            Full partner programme →
          </Link>
        </div>
      </header>

      {/* ————— HERO + FORM ————— */}
      <section className="px-6 pt-12 pb-20 md:px-12 md:pt-16 md:pb-24">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
              For UK estate agents
            </p>
            <h1
              className="mt-4 font-serif font-semibold leading-[0.98] tracking-[-0.025em] text-[#0A1020]"
              style={{ fontSize: 'clamp(40px, 6vw, 68px)' }}
            >
              Sale fallen through?
              <br />
              <span className="italic text-[#C6A664]">
                Save it before you re-list.
              </span>
            </h1>
            <p className="mt-7 max-w-md text-lg leading-relaxed text-slate-600">
              Buyer pulled out, mortgage refused, survey down-valued, chain
              broken. Whatever&rsquo;s collapsed, we step in with an
              indicative figure on screen in 60 seconds (drawn from HM Land
              Registry comps) and a signed binding offer in 4 working hours.
            </p>
            <ul className="mt-8 space-y-3 text-[14px] text-slate-700">
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#C6A664]" />
                <span>
                  <strong className="text-[#0A1020]">No re-trade.</strong>{' '}
                  The price your client accepts is the price they complete at,
                  or we pay you £1,000 plus your costs.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#C6A664]" />
                <span>
                  <strong className="text-[#0A1020]">Up to 3% + VAT to you.</strong>{' '}
                  Sale fee, introducer fee, plus the resale instruction when
                  we sell back through the market.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#C6A664]" />
                <span>
                  <strong className="text-[#0A1020]">Send before re-listing.</strong>{' '}
                  No commitment to take our offer. If your client picks open
                  market, we still pay you the introducer fee for trusting
                  us first.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#C6A664]" />
                <span>
                  <strong className="text-[#0A1020]">WhatsApp-able vendor link.</strong>{' '}
                  After you submit, you get a link you can WhatsApp the
                  vendor in two taps. No PDF download, no login on their
                  end.
                </span>
              </li>
            </ul>
            <p className="mt-8 text-[12px] text-slate-500">
              Prefer email?{' '}
              <a
                href="mailto:hello@bellwoodslane.co.uk?subject=Sale%20fallen%20through%20%E2%80%94%20urgent"
                className="text-[#0A2540] underline underline-offset-4"
              >
                hello@bellwoodslane.co.uk
              </a>
              {' '}&mdash; same 4-hour turnaround.
            </p>
          </div>
          <div>
            <AgentQuickForm defaultTriggerLabel="Buyer pulled out" />
          </div>
        </div>
      </section>

      {/* ————— TRUST FOOTER ————— */}
      <footer className="border-t border-slate-200/60 bg-white px-6 py-10 md:px-12">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
            HMRC AML supervised &middot; NAPB &middot; TPO redress
          </p>
          <nav className="flex flex-wrap items-center gap-6 text-[13px] text-slate-600">
            <Link href="/agents">Partner programme</Link>
            <Link href="/instant-offer/methodology">Methodology</Link>
            <Link href="/legal/fca-disclosure">Regulatory</Link>
          </nav>
        </div>
        <p className="mx-auto mt-8 max-w-5xl font-mono text-[10px] leading-relaxed text-slate-400">
          Bellwoods Lane Ltd is a UK cash property buyer, not an
          FCA-authorised firm. We do not provide financial or legal advice.
          All offers are subject to satisfactory survey and title searches.
        </p>
      </footer>
    </div>
  );
}
