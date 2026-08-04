import { Eyebrow } from '@/components/brand';
import Link from 'next/link';

/**
 * The offer-breakdown widget (KEPT.md signature artefact #3) — the honest
 * maths, shown Wise-calculator style: market estimate → our margin, named →
 * the figure we sign. Beside it, the open-market route, which is ALLOWED TO
 * WIN the headline-price line. A comparison the house always wins is the
 * "We Buy Any House" trick; conceding the price line honestly is the whole
 * point of this component.
 *
 * Figures are one illustrative worked example (the same fictional property
 * as the sample offer letter in the /sell hero) — every real offer shows its
 * own maths via the published methodology.
 */

export function OfferBreakdown() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* ——— Our route: the maths we sign ——— */}
      <div className="rounded-sm border border-hair bg-white p-8 md:p-10">
        <Eyebrow tone="wax">the honest version</Eyebrow>
        <p className="mt-4 font-serif text-sm text-stone-500">
          Worked example &middot; 14 Acacia Avenue, Stockport
          <sup className="ml-0.5 text-[10px]">1</sup>
        </p>
        <dl className="mt-6 space-y-5">
          <div className="flex items-baseline justify-between gap-6 border-hair border-b pb-4">
            <dt>
              <p className="font-serif text-[17px]">Market estimate</p>
              <p className="text-[12px] text-stone-500">
                HM Land Registry comparables, 24 months, trend-adjusted
              </p>
            </dt>
            <dd className="font-semibold font-serif text-2xl text-forest">
              £268,000
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-6 border-hair border-b pb-4">
            <dt>
              <p className="font-serif text-[17px] text-wax">
                Speed &amp; certainty — our margin
              </p>
              <p className="text-[12px] text-stone-500">
                Named, not hidden. It is how we make money.
              </p>
            </dt>
            <dd className="font-semibold font-serif text-2xl text-wax">
              −£24,000
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-6 pt-2">
            <dt>
              <p className="font-serif text-[17px] text-forest">
                Your figure, in writing
              </p>
              <p className="text-[12px] text-stone-500">
                Locked 72 hours &middot; no fees to you &middot; completion in
                weeks
              </p>
            </dt>
            <dd className="font-bold font-serif text-4xl text-forest">
              £244,000
            </dd>
          </div>
        </dl>
      </div>

      {/* ——— The open-market route — it wins the price line ——— */}
      <div className="rounded-sm border border-hair bg-cream p-8 md:p-10">
        <Eyebrow tone="muted">the open-market route</Eyebrow>
        <p className="mt-4 font-serif text-sm text-stone-500">
          Same property, sold through a good local agent
        </p>
        <dl className="mt-6 space-y-5">
          <div className="flex items-baseline justify-between gap-6 border-hair border-b pb-4">
            <dt>
              <p className="font-serif text-[17px]">Likely sale price</p>
              <p className="text-[12px] text-stone-500">
                Higher than our figure. That is the honest headline.
              </p>
            </dt>
            <dd className="font-semibold font-serif text-2xl text-forest">
              £268,000
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-6 border-hair border-b pb-4">
            <dt>
              <p className="font-serif text-[17px]">Agent fee</p>
              <p className="text-[12px] text-stone-500">
                Typically 1&ndash;1.5% + VAT
                <sup className="ml-0.5 text-[10px]">2</sup>
              </p>
            </dt>
            <dd className="font-semibold font-serif text-2xl text-forest">
              −£4,800
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-6 border-hair border-b pb-4">
            <dt>
              <p className="font-serif text-[17px]">4&ndash;8 months of waiting</p>
              <p className="text-[12px] text-stone-500">
                Council tax, insurance, utilities, mortgage interest on an
                empty or half-lived-in home
              </p>
            </dt>
            <dd className="font-semibold font-serif text-2xl text-forest">
              −£££
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-6 pt-2">
            <dt>
              <p className="font-serif text-[17px]">Fall-through risk</p>
              <p className="text-[12px] text-stone-500">
                Roughly a third of agreed sales collapse before completion
                <sup className="ml-0.5 text-[10px]">3</sup>
              </p>
            </dt>
            <dd className="font-semibold font-serif text-2xl text-forest">
              ~1 in 3
            </dd>
          </div>
        </dl>
      </div>

      {/* ——— The plain-words verdict + footnotes ——— */}
      <div className="lg:col-span-2">
        <p className="max-w-3xl text-[15px] text-stone-700 leading-relaxed">
          If time is on your side, the open-market route usually puts more
          money in your pocket — and we&rsquo;d genuinely tell you to take it.
          Our figure wins on one thing only:{' '}
          <strong className="font-medium text-forest">
            it is certain, it is fast, and it does not fall through.
          </strong>{' '}
          That is the whole trade, stated out loud.
        </p>
        <ol className="mt-6 max-w-3xl space-y-1 text-[11px] text-stone-500 leading-relaxed">
          <li>
            1. Illustrative example — a fictional property. Every real offer
            sets out its own figures line by line; see the{' '}
            <Link
              className="underline underline-offset-2"
              href="/instant-offer/methodology"
            >
              published methodology
            </Link>
            .
          </li>
          <li>
            2. Typical UK high-street sole-agency fee range; your agent may
            charge more or less.
          </li>
          <li>3. Source: TwentyCi fall-through data, 2025.</li>
        </ol>
      </div>
    </div>
  );
}
