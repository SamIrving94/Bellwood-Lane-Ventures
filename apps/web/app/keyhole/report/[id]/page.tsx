import type { KeyholeReportData } from '@/lib/keyhole/report';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintButton, ReferralPanel } from './referral-panel';

/**
 * The durable Keyhole report page. Renders the STORED snapshot, never a
 * re-fetch: a professional shares this link with a client, and it must show
 * exactly what was generated. Print styles make the browser's Save as PDF
 * produce the one-pager the PRD asks for; interactive elements are
 * print-hidden and the attribution stays.
 */

export const metadata: Metadata = {
  title: 'Keyhole report · Kept',
  robots: { index: false, follow: false },
};

const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const SECTION_TITLE =
  'font-semibold text-[11px] text-[#8B9489] uppercase tracking-[0.18em] [font-family:var(--font-courier)]';

export default async function KeyholeReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await database.keyholeReport.findUnique({
    where: { id },
    select: { id: true, reportJson: true, referralRequested: true },
  });
  if (!row) notFound();

  const report = row.reportJson as unknown as KeyholeReportData;
  if (report?.version !== 1) notFound();

  const { epc, streetSales, streetContext, refurb } = report;

  return (
    <div className="min-h-screen bg-cream print:bg-white">
      <header className="border-hair border-b bg-white print:hidden">
        <div className="mx-auto flex max-w-[880px] items-center justify-between gap-6 px-5 py-3.5 md:px-8">
          <Link
            className="font-bold font-serif text-[20px] text-forest tracking-[-0.03em]"
            href="/keyhole"
          >
            kept.
          </Link>
          <PrintButton />
        </div>
      </header>

      <main className="mx-auto max-w-[880px] px-5 pb-20 md:px-8 print:max-w-none print:px-0 print:pb-0">
        {/* ── Report head ── */}
        <section className="pt-8 print:pt-2">
          <div className="flex items-baseline justify-between gap-4">
            <p className={SECTION_TITLE}>Keyhole report</p>
            <p className="hidden font-bold font-serif text-[16px] text-forest print:block">
              kept.
            </p>
          </div>
          <h1 className="mt-2 font-bold font-serif text-[clamp(26px,4vw,36px)] text-forest leading-[1.1] tracking-[-0.02em]">
            {report.addressLine}, {report.postcode}
          </h1>
          <p className="mt-2 text-[13px] text-body">
            Generated {formatDate(report.generatedAt)} from public registers.
            Information, not a valuation.
          </p>
        </section>

        {/* ── EPC condition ── */}
        <section className="mt-8 rounded-[2px] border border-hair bg-white px-6 py-5 print:break-inside-avoid">
          <p className={SECTION_TITLE}>Condition on the record (EPC)</p>
          {epc.available ? (
            <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
              <div>
                <p className="text-[12px] text-stone-500">Energy rating</p>
                <p className="font-semibold text-[22px] text-forest">
                  {epc.rating ?? 'Not stated'}
                  {epc.score ? (
                    <span className="ml-1.5 font-normal text-[13px] text-body">
                      ({epc.score}/100)
                    </span>
                  ) : null}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-stone-500">Floor area</p>
                <p className="font-semibold text-[15px] text-forest">
                  {epc.floorAreaSqm
                    ? `${Math.round(epc.floorAreaSqm)} m²`
                    : 'Not stated'}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-stone-500">Property type</p>
                <p className="font-semibold text-[15px] text-forest">
                  {epc.propertyType ?? 'Not stated'}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-stone-500">Construction age</p>
                <p className="font-semibold text-[15px] text-forest">
                  {epc.constructionAgeBand ?? 'Not stated'}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-stone-500">Heating</p>
                <p className="font-semibold text-[15px] text-forest">
                  {epc.heatingType ?? 'Not stated'}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-stone-500">Last assessed</p>
                <p className="font-semibold text-[15px] text-forest">
                  {formatDate(epc.inspectionDate) || 'Not stated'}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-[14px] text-body leading-[1.6]">
              No certificate could be read from the EPC register for this
              address. That is worth knowing in itself: a home with no recent
              EPC has usually not been marketed or re-let for some years.
            </p>
          )}
          {epc.available && (epc.rating === 'F' || epc.rating === 'G') ? (
            <p className="mt-4 border-hair border-t pt-3 text-[13px] text-body leading-[1.6]">
              A band {epc.rating} rating usually means the heating and
              insulation have not been modernised. Expect refurbishment before
              the property meets today&apos;s standard.
            </p>
          ) : null}
        </section>

        {/* ── Street sales ── */}
        <section className="mt-6 rounded-[2px] border border-hair bg-white px-6 py-5 print:break-inside-avoid">
          <p className={SECTION_TITLE}>
            Recorded sales in {report.postcode} (HM Land Registry)
          </p>
          {streetSales.length > 0 ? (
            <>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-[13.5px]">
                  <thead>
                    <tr className="border-hair border-b text-left text-[12px] text-stone-500">
                      <th className="py-2 pr-4 font-normal">Date</th>
                      <th className="py-2 pr-4 font-normal">Address</th>
                      <th className="py-2 pr-4 font-normal">Type</th>
                      <th className="py-2 text-right font-normal">
                        Price paid
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {streetSales.map((s) => (
                      <tr
                        className={`border-hair border-b last:border-0 ${
                          s.sameAddress ? 'bg-soft font-semibold' : ''
                        }`}
                        key={`${s.address}-${s.date}`}
                      >
                        <td className="py-2 pr-4 text-body">
                          {formatDate(s.date)}
                        </td>
                        <td className="py-2 pr-4 text-forest">
                          {s.address}
                          {s.sameAddress ? (
                            <span className="ml-2 text-[11px] text-leaf">
                              this address
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-4 text-body capitalize">
                          {s.propertyType.replace('-', ' / ')}
                        </td>
                        <td className="py-2 text-right text-forest">
                          {gbp.format(s.pricePounds)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {streetContext ? (
                <p className="mt-3 text-[13px] text-body leading-[1.6]">
                  {streetContext.saleCount} recorded sales between{' '}
                  {formatDate(streetContext.earliest)} and{' '}
                  {formatDate(streetContext.latest)}, median{' '}
                  {gbp.format(streetContext.medianPricePounds)}. Mixed types,
                  sizes and dates: context for a conversation, not a valuation
                  of this property.
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-[14px] text-body leading-[1.6]">
              HM Land Registry returned no recorded sales for this postcode. No
              record found is the honest answer here, not a gap we fill.
            </p>
          )}
        </section>

        {/* ── Refurb bands ── */}
        <section className="mt-6 rounded-[2px] border border-hair bg-white px-6 py-5 print:break-inside-avoid">
          <p className={SECTION_TITLE}>
            What bringing it up to standard typically costs
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {refurb.bands.map((b) => (
              <div
                className="rounded-[2px] border border-hair bg-cream px-4 py-3"
                key={b.label}
              >
                <p className="text-[12.5px] text-stone-500">{b.label}</p>
                <p className="mt-1 font-semibold text-[18px] text-forest">
                  ~{gbp.format(b.totalPounds)}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-body leading-[1.6]">
            Typical whole-property ranges over{' '}
            {refurb.assumedFloorArea
              ? `an assumed ${refurb.floorAreaSqm} m² (the EPC gave no floor area)`
              : `the EPC floor area of ${Math.round(refurb.floorAreaSqm)} m²`}
            , from the cost tables we use on our own projects. Budget bands, not
            quotes: a survey prices the real job.
          </p>
        </section>

        {/* ── Opt-in referral ── */}
        <ReferralPanel
          alreadyReferred={row.referralRequested}
          reportId={row.id}
        />

        {/* ── Attribution ── */}
        <p className="mt-8 border-hair border-t pt-5 text-[11.5px] text-stone-500 leading-[1.6] print:mt-6">
          Produced with Keyhole by Kept (Bellwoods Lane Ventures Ltd). Sold
          prices: HM Land Registry Price Paid Data, Crown copyright and database
          right, Open Government Licence v3.0. Energy data: the official EPC
          register. Figures are shown as recorded at generation time. This page
          is information, not advice, and not a valuation for lending, probate
          or tax purposes.
        </p>
      </main>
    </div>
  );
}
