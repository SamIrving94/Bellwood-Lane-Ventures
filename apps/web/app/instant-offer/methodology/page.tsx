import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'How we price your property · Bellwood Ventures',
  description:
    'Full transparency on how we calculate our cash offers: comps, trend, risk, seller-situation margin, and floor/ceiling.',
};

export default function MethodologyPage() {
  return (
    <>
      <header className="border-b border-slate-200/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/instant-offer"
            className="font-serif text-xl font-semibold tracking-tight"
          >
            BELLWOOD
            <span className="mx-2 inline-block h-px w-8 bg-[#C6A664] align-middle" />
            <span className="text-sm font-normal tracking-widest text-slate-500">
              VENTURES
            </span>
          </Link>
          <Link
            href="/instant-offer#chat"
            className="rounded-full bg-[#0A2540] px-5 py-2 text-sm text-white transition hover:bg-[#13365c]"
          >
            Get an offer
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-20">
        <p className="mb-3 text-xs uppercase tracking-widest text-[#C6A664]">
          Methodology
        </p>
        <h1 className="font-serif text-5xl font-semibold leading-tight">
          How we price your property.
        </h1>
        <p className="mt-6 text-lg text-slate-600">
          No black box. Every number in our offer has a line of reasoning you
          can see. Here is the exact process, in order.
        </p>

        <div className="mt-16 space-y-14">
          <Section
            n="01"
            title="Comparable sales"
            body={
              <>
                We pull every recorded sale within <strong>0.5 miles</strong>{' '}
                of the property from the <strong>HM Land Registry Price Paid</strong>{' '}
                dataset for the <strong>last 24 months</strong>. We filter to
                the same property type and adjust for floor area where the
                Energy Performance Register holds a verified figure.
              </>
            }
          />
          <Section
            n="02"
            title="Market trend"
            body={
              <>
                Every historical comp is adjusted to today&apos;s value using
                the <strong>UK House Price Index (ONS)</strong> for the local
                authority. This stops us from undervaluing based on stale
                sales or overpaying in a falling market.
              </>
            }
          />
          <Section
            n="03"
            title="Environmental and building risk"
            body={
              <>
                We score five environmental factors — <strong>radon,
                coal-mining, Japanese knotweed proximity, flood zone,
                noise</strong> — plus <strong>construction type</strong> and{' '}
                <strong>EPC rating</strong>. Each produces a small,
                disclosed discount. No hidden adjustments.
              </>
            }
          />
          <Section
            n="04"
            title="Seller-situation margin"
            body={
              <>
                Our base acquisition margin reflects the speed and
                certainty you&apos;re buying:
                <table className="mt-4 w-full text-sm">
                  <tbody>
                    {[
                      ['Probate', '20%'],
                      ['Chain break', '20%'],
                      ['Repossession', '25%'],
                      ['Relocation', '22%'],
                      ['Short lease', '15% (plus lease discount)'],
                      ['Standard', '22%'],
                    ].map(([row, val]) => (
                      <tr
                        key={row}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="py-2 text-slate-600">{row}</td>
                        <td className="py-2 text-right font-medium">{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            }
          />
          <Section
            n="05"
            title="Floor and ceiling"
            body={
              <>
                No offer can go below <strong>60%</strong> of AVM point
                without founder escalation. No offer can go above{' '}
                <strong>88%</strong>. Total discount capped at{' '}
                <strong>40%</strong>. These are hard rules, not rules of
                thumb.
              </>
            }
          />
          <Section
            n="06"
            title="Worked example"
            body={
              <div className="rounded-2xl border border-slate-200 bg-[#FAF6EA] p-6">
                <p className="text-sm text-slate-600">
                  Manchester M40, 3-bed terrace, probate, EPC D, flood zone 1.
                </p>
                <dl className="mt-4 space-y-2 text-sm">
                  {[
                    ['12 HMLR comps', '£192,400 AVM point'],
                    ['Base margin (probate)', '-20.0%'],
                    ['EPC rating D', '-1.2%'],
                    ['Environmental risk', '-0.8%'],
                    ['Age adjustment (post-1950 brick)', '0.0%'],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between border-b border-slate-200 py-1 last:border-0"
                    >
                      <dt className="text-slate-600">{k}</dt>
                      <dd className="font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 flex items-baseline justify-between border-t-2 border-[#C6A664] pt-4">
                  <span className="text-sm text-slate-600">Cash offer</span>
                  <span className="font-serif text-3xl font-semibold">
                    £150,700
                  </span>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  (78.3% of AVM mid, completion target 18 days)
                </p>
              </div>
            }
          />
        </div>

        <div className="mt-20 rounded-3xl bg-[#0A2540] p-10 text-center text-white">
          <h2 className="font-serif text-3xl font-semibold">
            See your number in 60 seconds.
          </h2>
          <Link
            href="/instant-offer#chat"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#C6A664] px-8 py-3 text-sm font-medium text-[#0A1020] transition hover:bg-[#b08f52]"
          >
            Get an instant offer →
          </Link>
        </div>
      </article>
    </>
  );
}

function Section({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-serif text-sm text-[#C6A664]">{n}</p>
      <h2 className="mt-2 font-serif text-3xl font-semibold">{title}</h2>
      <div className="mt-4 text-slate-700">{body}</div>
    </div>
  );
}
