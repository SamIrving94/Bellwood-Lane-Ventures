// Printable offer certificate.
// /instant-offer/offer/[id] — opens a print-styled HTML page that the
// browser turns into a clean PDF via Ctrl/⌘+P.
//
// We deliberately avoid the @react-pdf/renderer dependency (~100MB).
// HTML print gives us identical fidelity for a fraction of the runtime cost.

import { notFound } from 'next/navigation';
import { database } from '@repo/database';

export const dynamic = 'force-dynamic';

function formatGBP(pence: number) {
  return `£${Math.round(pence / 100).toLocaleString('en-GB')}`;
}

function buildRef(id: string, postcode: string, situation?: string | null) {
  const post = (postcode || '').replace(/\s+/g, '').slice(0, 4).toUpperCase();
  const sit = (situation || 'GEN').slice(0, 3).toUpperCase();
  const slice = id.slice(-4).toUpperCase();
  return `${post}.${sit}.${slice}`;
}

export default async function OfferCertificatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const quote = await database.quoteRequest
    .findUnique({
      where: { id },
      include: { offer: true },
    })
    .catch(() => null);

  if (!quote || !quote.offer) {
    notFound();
  }

  const o = quote.offer;
  const ref = buildRef(quote.id, quote.postcode, quote.sellerSituation);
  const issuedAt = o.createdAt.toLocaleString('en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
  const lockedUntil = o.lockedUntil.toLocaleString('en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
  const avmMid = Math.round(
    (o.estimatedMarketValueMinPence + o.estimatedMarketValueMaxPence) / 2,
  );
  const reasoningLines = Array.isArray(o.reasoning)
    ? (o.reasoning as unknown[]).filter(
        (x): x is string => typeof x === 'string',
      )
    : [];

  return (
    <div className="mx-auto max-w-3xl px-8 py-14 print:px-0 print:py-0 print:max-w-none">
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
          <kbd className="rounded bg-white px-2 py-1 text-xs">Ctrl + P</kbd>{' '}
          (or <kbd className="rounded bg-white px-2 py-1 text-xs">⌘ + P</kbd>)
          to save this offer as a PDF.
        </span>
        <a
          href="/instant-offer"
          className="text-sm text-stone-600 underline underline-offset-4"
        >
          ← Back
        </a>
      </div>

      <header className="border-b-2 border-[#DB5C5C] pb-6">
        <p className="font-serif text-xl font-semibold tracking-tight">
          BELLWOODS
          <span className="mx-2 inline-block h-px w-8 bg-[#DB5C5C] align-middle" />
          <span className="text-sm font-normal tracking-widest text-stone-500">
            LANE
          </span>
        </p>
        <div className="mt-6 flex items-end justify-between">
          <div>
            <p className="font-serif italic text-[13px] text-[#DB5C5C]">
              Binding cash offer
            </p>
            <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight">
              Certificate of offer
            </h1>
          </div>
          <div className="text-right font-mono text-[11px] text-stone-500">
            <p>
              Reference{' '}
              <span className="text-[#874646]">{ref}</span>
            </p>
            <p className="mt-1">Issued {issuedAt}</p>
          </div>
        </div>
      </header>

      <section className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6">
        <div>
          <p className="font-serif italic text-[13px] text-stone-500">
            Property
          </p>
          <p className="mt-2 font-serif text-lg leading-snug">
            {quote.address}
          </p>
          <p className="font-mono text-[12px] text-stone-500">
            {quote.postcode}
            {quote.bedrooms ? ` · ${quote.bedrooms} bed` : ''}
            {quote.propertyType ? ` · ${quote.propertyType.replace('_', ' ')}` : ''}
          </p>
        </div>
        <div>
          <p className="font-serif italic text-[13px] text-stone-500">
            Seller situation
          </p>
          <p className="mt-2 font-serif text-lg capitalize">
            {(quote.sellerSituation || 'general').replace(/_/g, ' ')}
          </p>
        </div>
      </section>

      <section className="mt-10 rounded-2xl border-2 border-[#DB5C5C] bg-[#F6ECE7] p-8">
        <p className="font-serif italic text-[13px] text-stone-500">
          Our cash offer
        </p>
        <p
          className="mt-2 font-serif font-semibold tracking-[-0.025em] text-[#874646]"
          style={{ fontSize: 'clamp(56px, 8vw, 88px)', lineHeight: 1 }}
        >
          {formatGBP(o.offerPence)}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 font-mono text-[12px]">
          <span className="text-stone-500">
            AVM mid {formatGBP(avmMid)}
          </span>
          <span className="text-stone-300">·</span>
          <span className="text-[#1F6B3A]">
            confidence {Math.round(o.confidenceScore * 100)}%
          </span>
        </div>
      </section>

      <section className="mt-10">
        <p className="font-serif italic text-[13px] text-stone-500">
          Terms
        </p>
        <dl className="mt-3 divide-y divide-stone-200 border-y border-stone-200">
          {[
            [
              'Validity',
              `Legally binding upon Bellwoods Lane until ${lockedUntil}`,
            ],
            [
              'Completion target',
              `${o.completionDays} days from acceptance`,
            ],
            ['AVM range', `${formatGBP(o.estimatedMarketValueMinPence)} – ${formatGBP(o.estimatedMarketValueMaxPence)}`],
            [
              'Price adjustment',
              'Only for three documented exceptions: a structural survey reveals a material defect not visible or disclosed at viewing, a title issue emerges during conveyancing that materially affects value, or information provided about the property proves materially incorrect. You may walk away free.',
            ],
            ['Withdrawal cost (you)', '£0 at any point before exchange'],
            ['Vendor fees', 'Zero. We pay solicitors, searches, and any agent commission'],
          ].map(([k, v]) => (
            <div
              key={k}
              className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[180px_1fr] sm:gap-6"
            >
              <dt className="font-serif italic text-[13px] text-stone-500">
                {k}
              </dt>
              <dd className="text-[14px] text-[#2B2220]">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {reasoningLines.length > 0 && (
        <section className="mt-10">
          <p className="font-serif italic text-[13px] text-stone-500">
            How we got to this number
          </p>
          <ul className="mt-3 space-y-2 text-[13px] text-stone-700">
            {reasoningLines.map((line, i) => (
              <li key={i}>· {line}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12 grid grid-cols-2 gap-6">
        <div>
          <p className="font-serif italic text-[13px] text-stone-500">
            For the seller
          </p>
          <div className="mt-2 h-16 border-b-2 border-stone-400" />
          <p className="mt-2 text-xs text-stone-500">
            Signature · {quote.contactName}
          </p>
        </div>
        <div>
          <p className="font-serif italic text-[13px] text-stone-500">
            For Bellwoods Lane Ltd
          </p>
          <div className="mt-2 h-16 border-b-2 border-stone-400" />
          <p className="mt-2 text-xs text-stone-500">
            Authorised signatory
          </p>
        </div>
      </section>

      <footer className="mt-12 border-t border-stone-200 pt-6 font-mono text-[10px] leading-relaxed text-stone-500">
        <p>
          Bellwoods Lane Ltd · Registered in England &amp; Wales · Property
          Redress Scheme (PRS) · HMRC AML supervised · ICO registered.
          Bellwoods Lane is a cash property buyer, not an FCA-authorised firm. This offer
          does not constitute financial or legal advice. The seller is
          encouraged to seek independent legal advice. Full regulatory
          disclosure: bellwoodslane.co.uk/legal/fca-disclosure
        </p>
        <p className="mt-3">
          Reference {ref} · Generated {issuedAt}
        </p>
      </footer>
    </div>
  );
}
