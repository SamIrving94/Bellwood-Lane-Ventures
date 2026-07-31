// Printable offer certificate.
// /instant-offer/offer/[id] — opens a print-styled HTML page that the
// browser turns into a clean PDF via Ctrl/⌘+P.
//
// We deliberately avoid the @react-pdf/renderer dependency (~100MB).
// HTML print gives us identical fidelity for a fraction of the runtime cost.

import { database } from '@repo/database';
import { notFound } from 'next/navigation';

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
    (o.estimatedMarketValueMinPence + o.estimatedMarketValueMaxPence) / 2
  );
  const reasoningLines = Array.isArray(o.reasoning)
    ? (o.reasoning as unknown[]).filter(
        (x): x is string => typeof x === 'string'
      )
    : [];

  return (
    <div className="mx-auto max-w-3xl px-8 py-14 print:max-w-none print:px-0 print:py-0">
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
          save this offer as a PDF.
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
        <div className="mt-6 flex items-end justify-between">
          <div>
            <p className="font-serif text-[13px] text-wax italic">
              Binding cash offer
            </p>
            <h1 className="mt-2 font-semibold font-serif text-3xl leading-tight">
              Certificate of offer
            </h1>
          </div>
          <div className="text-right font-mono text-[11px] text-stone-500">
            <p>
              Reference <span className="text-forest">{ref}</span>
            </p>
            <p className="mt-1">Issued {issuedAt}</p>
          </div>
        </div>
      </header>

      <section className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6">
        <div>
          <p className="font-serif text-[13px] text-stone-500 italic">
            Property
          </p>
          <p className="mt-2 font-serif text-lg leading-snug">
            {quote.address}
          </p>
          <p className="font-mono text-[12px] text-stone-500">
            {quote.postcode}
            {quote.bedrooms ? ` · ${quote.bedrooms} bed` : ''}
            {quote.propertyType
              ? ` · ${quote.propertyType.replace('_', ' ')}`
              : ''}
          </p>
        </div>
        <div>
          <p className="font-serif text-[13px] text-stone-500 italic">
            Seller situation
          </p>
          <p className="mt-2 font-serif text-lg capitalize">
            {(quote.sellerSituation || 'general').replace(/_/g, ' ')}
          </p>
        </div>
      </section>

      <section className="mt-10 rounded-2xl border-2 border-wax bg-soft p-8">
        <p className="font-serif text-[13px] text-stone-500 italic">
          Our cash offer
        </p>
        <p
          className="mt-2 font-semibold font-serif text-forest tracking-[-0.025em]"
          style={{ fontSize: 'clamp(56px, 8vw, 88px)', lineHeight: 1 }}
        >
          {formatGBP(o.offerPence)}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 font-mono text-[12px]">
          <span className="text-stone-500">AVM mid {formatGBP(avmMid)}</span>
          <span className="text-stone-300">·</span>
          <span className="text-leaf-dark">
            confidence {Math.round(o.confidenceScore * 100)}%
          </span>
        </div>
      </section>

      <section className="mt-10">
        <p className="font-serif text-[13px] text-stone-500 italic">Terms</p>
        <dl className="mt-3 divide-y divide-stone-200 border-stone-200 border-y">
          {[
            [
              'Validity',
              `Legally binding upon Kept until ${lockedUntil}`,
            ],
            ['Completion target', `${o.completionDays} days from acceptance`],
            [
              'AVM range',
              `${formatGBP(o.estimatedMarketValueMinPence)} – ${formatGBP(o.estimatedMarketValueMaxPence)}`,
            ],
            [
              'Price adjustment',
              'Only for three documented exceptions: a structural survey reveals a material defect not visible or disclosed at viewing, a title issue emerges during conveyancing that materially affects value, or information provided about the property proves materially incorrect. You may walk away free.',
            ],
            ['Withdrawal cost (you)', '£0 at any point before exchange'],
            [
              'Vendor fees',
              'Zero. We pay solicitors, searches, and any agent commission',
            ],
          ].map(([k, v]) => (
            <div
              key={k}
              className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[180px_1fr] sm:gap-6"
            >
              <dt className="font-serif text-[13px] text-stone-500 italic">
                {k}
              </dt>
              <dd className="text-[14px] text-forest">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {reasoningLines.length > 0 && (
        <section className="mt-10">
          <p className="font-serif text-[13px] text-stone-500 italic">
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
          <p className="font-serif text-[13px] text-stone-500 italic">
            For the seller
          </p>
          <div className="mt-2 h-16 border-stone-400 border-b-2" />
          <p className="mt-2 text-stone-500 text-xs">
            Signature · {quote.contactName}
          </p>
        </div>
        <div>
          <p className="font-serif text-[13px] text-stone-500 italic">
            For Kept
          </p>
          <div className="mt-2 h-16 border-stone-400 border-b-2" />
          <p className="mt-2 text-stone-500 text-xs">Authorised signatory</p>
        </div>
      </section>

      <footer className="mt-12 border-stone-200 border-t pt-6 font-mono text-[10px] text-stone-500 leading-relaxed">
        <p>
          Kept · Registered in England &amp; Wales · Property
          Redress Scheme (PRS) · HMRC AML supervised · ICO registered. Kept is
          a cash property buyer, not an FCA-authorised firm. This offer
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
