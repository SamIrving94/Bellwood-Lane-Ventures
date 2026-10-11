// Presentational half of the investor pack page: no database, so it can be
// rendered from fixtures. page.tsx loads the data and decides access.

import { LogoLockup } from '@/components/brand';
import { type PackState, gbp } from '@/lib/investor-pack';
import { brand } from '@repo/brand';
import Link from 'next/link';
import { InterestForm } from './interest-form';
import { NumbersCalculator } from './numbers-calculator';
import { PackGallery } from './pack-gallery';

export type PackViewData = {
  status: string;
  headline: string;
  summary: string;
  highlights: string[];
  photos: string[];
  renders: string[];
  floorPlanUrl: string | null;
  /** Pounds, not pence, from here on. */
  price: number;
  marketValue: number | null;
  refurbEstimate: number | null;
  valueAfterWorks: number | null;
  monthlyRent: number | null;
  closesAt: Date | null;
  facts: [string, string][];
  district: string;
  propertyType: string;
};

function closeLabel(d: Date) {
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/London',
  });
}

export function PackView({
  token,
  dealId,
  label,
  preview,
  hasEmail,
  registeredAt,
  state,
  pack,
}: {
  token: string;
  dealId: string;
  label: string;
  preview: boolean;
  hasEmail: boolean;
  registeredAt: string | null;
  state: PackState;
  pack: PackViewData;
}) {
  const { price, marketValue, facts, district } = pack;
  const discount =
    marketValue && marketValue > price
      ? Math.round(((marketValue - price) / marketValue) * 100)
      : null;

  if (state === 'withdrawn') {
    return (
      <Shell label={label}>
        <div className="mx-auto max-w-[640px] py-24 text-center">
          <h1 className="font-semibold font-serif text-[28px] text-forest">
            This deal is no longer available.
          </h1>
          <p className="mt-3 text-[15px] text-body">
            Thank you for looking. We&apos;ll send the next one when it comes.
          </p>
          <Link
            href={`/investors/${token}`}
            className="mt-6 inline-block text-[14px] text-leaf underline"
          >
            See other live deals
          </Link>
        </div>
      </Shell>
    );
  }

  const disabledReason = preview
    ? 'Preview: this is how investors see the pack. They register from their own link.'
    : state === 'preview'
      ? 'This pack is not live yet.'
      : state === 'closed'
        ? 'Interest on this deal has closed.'
        : !hasEmail
          ? 'To register interest, reply to the email this link came from.'
          : null;

  return (
    <Shell label={label}>
      {preview && (
        <div className="mt-4 rounded-[2px] border border-wax/30 bg-wax/5 px-4 py-2.5 text-[13px] text-forest">
          <strong>Founder preview.</strong> Status: {pack.status}. Views from
          this link are not counted.
        </div>
      )}

      <section className="pt-6 md:pt-10">
        <PackGallery images={pack.photos} />
      </section>

      <section className="grid grid-cols-1 gap-10 pt-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14">
        <div>
          <p className="text-[#8B9489] text-[10.5px] uppercase tracking-[0.2em] [font-family:var(--font-courier)]">
            Off-market · {district} · {pack.propertyType}
          </p>
          <h1 className="mt-4 text-balance font-bold font-serif text-[clamp(30px,4.4vw,46px)] text-forest leading-[1.08] tracking-[-0.025em]">
            {pack.headline}
          </h1>

          {pack.highlights.length > 0 && (
            <ul className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {pack.highlights.map((h) => (
                <li
                  key={h}
                  className="flex gap-2.5 rounded-[2px] border border-hair bg-white px-4 py-3 text-[14px] text-forest leading-[1.45]"
                >
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-leaf" />
                  {h}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-8 max-w-[62ch] space-y-4 text-[16.5px] text-body leading-[1.7]">
            {pack.summary
              .split(/\n\s*\n/)
              .filter(Boolean)
              .map((para) => (
                <p key={para.slice(0, 40)}>{para}</p>
              ))}
          </div>

          {facts.length > 0 && (
            <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-[2px] border border-hair bg-hair sm:grid-cols-3">
              {facts.map(([k, v]) => (
                <div key={k} className="bg-white px-4 py-3.5">
                  <dt className="text-[11px] text-stone-500 uppercase tracking-[0.12em]">
                    {k}
                  </dt>
                  <dd className="mt-1 font-semibold text-[15.5px] text-forest capitalize">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {/* Price card: sticky on desktop so the action is always in reach. */}
        <aside className="lg:sticky lg:top-6 lg:self-start" id="register">
          <div className="rounded-[2px] border border-hair bg-white p-6">
            <p className="text-[12px] text-stone-500 uppercase tracking-[0.14em]">
              Price
            </p>
            <p className="mt-1 font-bold font-serif text-[40px] text-forest leading-none tracking-[-0.02em]">
              {gbp(price)}
            </p>
            {marketValue && (
              <p className="mt-2 text-[14px] text-body">
                Market value {gbp(marketValue)}
                {discount !== null && discount > 0 && (
                  <span className="ml-2 rounded-full bg-leaf/10 px-2 py-0.5 font-medium text-[12px] text-leaf">
                    {discount}% below
                  </span>
                )}
              </p>
            )}
            {pack.closesAt && (
              <p className="mt-4 border-hair border-t pt-4 text-[13.5px] text-body">
                {state === 'closed' ? 'Interest closed ' : 'Interest closes '}
                <strong className="text-forest">
                  {closeLabel(pack.closesAt)}
                </strong>
                .
              </p>
            )}
            <div className="mt-5">
              <InterestForm
                token={token}
                dealId={dealId}
                priceLabel={gbp(price)}
                defaultName={preview ? '' : label}
                registeredAt={registeredAt}
                disabledReason={registeredAt ? null : disabledReason}
              />
            </div>
          </div>
          <p className="mt-3 px-1 text-[12px] text-stone-500 leading-[1.55]">
            Best suited to cash buyers. Many mortgage lenders won&apos;t lend on
            a property resold within six months of its last sale, so a purchase
            that depends on a mortgage may not work here.
          </p>
        </aside>
      </section>

      <section className="pt-16">
        <h2 className="font-semibold font-serif text-[26px] text-forest">
          Run your own numbers
        </h2>
        <p className="mt-2 mb-6 max-w-[62ch] text-[15px] text-body">
          The figures start at our estimates. Change any of them to see the deal
          your way.
        </p>
        <NumbersCalculator
          price={price}
          refurb={pack.refurbEstimate}
          monthlyRent={pack.monthlyRent}
          valueAfterWorks={pack.valueAfterWorks}
        />
      </section>

      {pack.renders.length > 0 && (
        <section className="pt-16">
          <h2 className="font-semibold font-serif text-[26px] text-forest">
            What it could become
          </h2>
          <p className="mt-2 mb-6 max-w-[62ch] text-[15px] text-body">
            Illustrations of one possible finish. They are not the property as
            it stands, and not a promise of planning or cost.
          </p>
          <PackGallery
            images={pack.renders}
            caption="Illustrative"
            variant="grid"
          />
        </section>
      )}

      {pack.floorPlanUrl && (
        <section className="pt-16">
          <h2 className="mb-6 font-semibold font-serif text-[26px] text-forest">
            Floor plan
          </h2>
          <PackGallery
            images={[pack.floorPlanUrl]}
            caption="Floor plan"
            variant="grid"
          />
        </section>
      )}

      <section className="pt-16">
        <h2 className="font-semibold font-serif text-[26px] text-forest">
          How this works
        </h2>
        <ol className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            [
              'Register interest',
              'At the price shown. The price is fixed: there is no bidding.',
            ],
            [
              'We talk',
              'We call you to confirm funds, timing and your solicitor, and arrange a viewing if you want one.',
            ],
            [
              'Contracts',
              'If we agree to proceed, our solicitors send contracts to yours.',
            ],
          ].map(([t, b], i) => (
            <li
              key={t}
              className="rounded-[2px] border border-hair bg-white p-5"
            >
              <p className="text-[#8B9489] text-[11px] tracking-[0.2em] [font-family:var(--font-courier)]">
                0{i + 1}
              </p>
              <p className="mt-2 font-semibold text-[16px] text-forest">{t}</p>
              <p className="mt-1.5 text-[14px] text-body leading-[1.55]">{b}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-20 border-hair border-t pt-6 pb-16 text-[12px] text-stone-500 leading-[1.6]">
        <p>
          Private link for {label}. Please don&apos;t forward it. All figures
          other than the price are our estimates, not a valuation or financial
          advice: verify them independently before you commit.
        </p>
        <p className="mt-2">
          {brand.legalName} · Company no. {brand.companyNumber} · Property
          Redress Scheme (PRS) · HMRC AML supervised · ICO registered
        </p>
      </footer>
    </Shell>
  );
}

function Shell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-hair border-b bg-white">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-6 px-5 py-3.5 md:px-10">
          <LogoLockup />
          <span className="text-[12.5px] text-stone-500">
            Private · for {label}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-[1100px] px-5 md:px-10">{children}</main>
    </div>
  );
}
