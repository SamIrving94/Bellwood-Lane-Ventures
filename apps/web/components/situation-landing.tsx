import { Button, Eyebrow, LogoLockup } from '@/components/brand';
import { SituationOfferForm } from '@/components/home/situation-offer-form';
import { SITUATION_CONTENT, type SituationKey } from '@/lib/situation-content';
import Image from 'next/image';
import Link from 'next/link';

/**
 * The shared situation landing page — one template, four routes (/probate,
 * /chain-break, /separation, /relocation), per the Aug 2026 reason-page
 * handoff. Layout: single 1100px rail; hero splits copy (plus the threshold
 * photo where the content sets `photo`) against the offer form and the
 * "offer you'll receive" card; then fit + cards, numbered steps, a
 * two-column Q&A (not an accordion — these pages answer, they don't fold),
 * the sand "honest version" card, and a closing CTA. A fixed mobile CTA bar
 * keeps the ask reachable on small screens.
 */

export function SituationLanding({
  situationKey,
}: { situationKey: SituationKey }) {
  const c = SITUATION_CONTENT[situationKey];
  return (
    <>
      {/* ————— NAV ————— */}
      <header className="border-hair border-b bg-white">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-6 px-5 py-3.5 md:px-10">
          <LogoLockup href="/sell" animate />
          <div className="flex items-center gap-6">
            <Link
              href="/instant-offer/methodology"
              className="hidden text-[13.5px] text-stone-600 transition-colors hover:text-brand-deep sm:block"
            >
              How we price
            </Link>
            <Button href="#offer" className="px-5 py-2 text-sm">
              Get my offer
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-5 pb-24 max-md:pb-[104px] md:px-10 md:pb-24">
        {/* ————— HERO ————— */}
        <section className="grid grid-cols-1 items-start gap-10 pt-9 md:pt-[52px] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.82fr)] lg:gap-16">
          <div>
            <Eyebrow>{c.eyebrow}</Eyebrow>
            <h1
              className="mt-5 text-balance font-bold font-serif text-forest leading-[1.04] tracking-[-0.03em]"
              style={{ fontSize: 'clamp(34px, 4.6vw, 56px)' }}
            >
              {c.h1a}
              <br />
              <span className="font-normal text-leaf">{c.h1b}</span>
            </h1>
            <p className="mt-[22px] max-w-[52ch] text-[#44403c] text-[17px] leading-[1.7]">
              {c.sub}
            </p>
            {c.disclaimer ? (
              <p className="mt-[18px] font-serif text-[13px] text-stone-500 leading-[1.6]">
                {c.disclaimer}
              </p>
            ) : null}
            {c.photo ? (
              <figure className="m-0 mt-[30px] overflow-hidden rounded-[2px] border border-hair">
                <Image
                  src="/home/threshold.webp"
                  alt="An open front door on a wet afternoon, hall light on, a packing box just inside"
                  width={1100}
                  height={1375}
                  sizes="(max-width: 1024px) 100vw, 55vw"
                  className="block h-[320px] w-full object-cover object-[50%_34%]"
                />
              </figure>
            ) : null}
          </div>

          <div className="flex flex-col gap-5">
            <SituationOfferForm
              situation={c.situation}
              triggerLabel={c.triggerLabel}
              source={`landing_${situationKey.replace('-', '_')}`}
            />

            {/* The offer-you'll-receive card, its seal on the top corner */}
            <div className="relative rounded-[2px] border border-[#E6DFCC] bg-[#FFFEFB] px-6 pt-[22px] pb-5 shadow-[0_26px_52px_-30px_rgba(31,51,43,0.42)]">
              <span
                aria-hidden
                className="-top-[22px] absolute right-[22px] inline-flex h-16 w-16 items-center justify-center rounded-full border border-wax/40 bg-cream"
              >
                <span className="absolute inset-[5px] rounded-full border border-wax/20" />
                <span className="inline-flex items-baseline font-bold font-serif text-[15px] text-wax lowercase leading-none tracking-[-0.03em]">
                  k.
                </span>
              </span>
              <div className="flex items-baseline justify-between gap-3 border-[#EFE9DB] border-b pr-14 pb-3">
                <span className="font-bold font-serif text-[17px] tracking-[-0.01em]">
                  Kept<span className="text-wax">.</span>
                </span>
                <span className="text-[#9AA097] text-[9.5px] tracking-[0.12em] [font-family:var(--font-courier)]">
                  THE OFFER YOU&rsquo;LL RECEIVE
                </span>
              </div>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0 pt-3.5">
                {[
                  'Seen in person first.',
                  'Put in writing.',
                  'Held for a week.',
                ].map((line) => (
                  <li key={line} className="flex items-baseline gap-3">
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-wax"
                    />
                    <span className="font-serif text-[16px]">{line}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 border-hair border-t border-dashed pt-3.5">
                <p className="m-0 text-[12.5px] text-stone-600 leading-[1.5]">
                  What we write down is what we complete at.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ————— WHERE WE FIT ————— */}
        <section className="pt-[72px]">
          <h2
            className="m-0 max-w-[20ch] font-bold font-serif leading-[1.1] tracking-[-0.02em]"
            style={{ fontSize: 'clamp(28px, 3.4vw, 40px)' }}
          >
            {c.fitTitle}
          </h2>
          <p className="mt-5 max-w-[62ch] text-[#44403c] text-[17px] leading-[1.7]">
            {c.fitBody}
          </p>
          <div className="mt-9 grid grid-cols-1 gap-px overflow-hidden rounded-[2px] border border-hair bg-hair md:grid-cols-3">
            {c.cards.map((card) => (
              <div key={card.t} className="bg-white p-[26px]">
                <p className="m-0 font-bold font-serif text-[17px] text-forest">
                  {card.t}
                </p>
                <p className="mt-3 text-[13.5px] text-stone-600 leading-[1.65]">
                  {card.d}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ————— THE STEPS ————— */}
        <section className="grid grid-cols-1 items-start gap-8 pt-[72px] lg:grid-cols-[0.8fr_1.6fr] lg:gap-14">
          <div>
            <Eyebrow tone="muted">{c.stepsEyebrow}</Eyebrow>
            <h2
              className="mt-4 font-bold font-serif leading-[1.1] tracking-[-0.02em]"
              style={{ fontSize: 'clamp(26px, 3vw, 34px)' }}
            >
              {c.stepsTitle}
            </h2>
          </div>
          <ol className="m-0 list-none border-hair border-t p-0">
            {c.steps.map((s) => (
              <li
                key={s.n}
                className="grid grid-cols-[52px_1fr] items-start gap-6 border-hair border-b py-[22px]"
              >
                <span className="font-normal font-serif text-[28px] text-forest/30">
                  {s.n}
                </span>
                <div>
                  <h3 className="m-0 font-bold font-serif text-[19px]">
                    {s.t}
                  </h3>
                  <p className="mt-2 max-w-[64ch] text-[14px] text-stone-600 leading-[1.65]">
                    {s.d}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ————— HONEST ANSWERS ————— */}
        <section className="pt-[72px]">
          <Eyebrow>honest answers</Eyebrow>
          <h2
            className="mt-4 mb-8 font-bold font-serif leading-[1.1] tracking-[-0.02em]"
            style={{ fontSize: 'clamp(26px, 3vw, 34px)' }}
          >
            {c.qaTitle}
          </h2>
          <div className="border-hair border-t">
            {c.faqs.map((f) => (
              <div
                key={f.q}
                className="grid grid-cols-1 gap-1.5 border-hair border-b py-[22px] lg:grid-cols-[0.8fr_1.6fr] lg:gap-14"
              >
                <p className="m-0 font-serif text-[18px] text-forest">{f.q}</p>
                <p className="m-0 max-w-[70ch] text-[15px] text-stone-600 leading-[1.7]">
                  {f.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ————— THE HONEST VERSION ————— */}
        <section className="pt-[72px]">
          <div className="rounded-[2px] bg-soft px-6 py-9 md:px-[38px]">
            <Eyebrow tone="wax">the honest version</Eyebrow>
            <h2
              className="mt-4 max-w-[32ch] font-bold font-serif leading-[1.15] tracking-[-0.02em]"
              style={{ fontSize: 'clamp(24px, 2.8vw, 30px)' }}
            >
              {c.honestTitle}
            </h2>
            <p className="mt-4 max-w-[66ch] text-[#44403c] text-[16px] leading-[1.7]">
              {c.honestBody}
            </p>
            <p className="mt-3.5 max-w-[66ch] text-[#44403c] text-[15px] leading-[1.7]">
              Our figure is below open-market value by design, and our{' '}
              <Link
                href="/instant-offer/methodology"
                className="underline decoration-leaf/50 underline-offset-4 hover:decoration-leaf"
              >
                full methodology is published
              </Link>{' '}
              so you can see exactly how we get there.
            </p>
          </div>
        </section>

        {/* ————— CLOSING CTA ————— */}
        <section className="mt-[72px] grid grid-cols-1 items-end gap-8 border-hair border-t pt-[72px] lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          <h2
            className="m-0 font-bold font-serif leading-[1] tracking-[-0.025em]"
            style={{ fontSize: 'clamp(34px, 5vw, 58px)' }}
          >
            A real offer{' '}
            <span className="font-normal text-leaf">in writing.</span>
          </h2>
          <div>
            <Button href="#offer">{c.ctaLabel}</Button>
            <p className="mt-[18px] text-[14px] text-stone-600 leading-[1.6]">
              Cash property buying is not regulated by the FCA. What that means
              for you is set out plainly on our{' '}
              <Link
                href="/legal/fca-disclosure"
                className="underline decoration-leaf/50 underline-offset-4 hover:decoration-leaf"
              >
                regulatory status page
              </Link>
              .
            </p>
          </div>
        </section>
      </main>

      {/* ————— FOOTER ————— */}
      <footer className="border-hair border-t bg-white px-5 py-9 md:px-10">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-6">
          <p className="m-0 font-serif text-[13px] text-stone-500">
            Kept &middot; Direct-to-vendor property buyers &middot; UK
          </p>
          <nav className="flex flex-wrap items-center gap-x-[22px] gap-y-2 text-[13.5px] text-stone-600">
            <Link href="/sell" className="hover:text-brand-deep">
              For sellers
            </Link>
            <Link
              href="/instant-offer/methodology"
              className="hover:text-brand-deep"
            >
              Methodology
            </Link>
            <Link
              href="/why-we-wont-buy-any-home"
              className="hover:text-brand-deep"
            >
              What we won&rsquo;t buy
            </Link>
            <Link
              href="/legal/fca-disclosure"
              className="hover:text-brand-deep"
            >
              Regulatory
            </Link>
          </nav>
        </div>
      </footer>

      {/* ————— MOBILE CTA BAR ————— */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-4 border-hair border-t bg-cream/95 px-5 py-3.5 backdrop-blur-md md:hidden">
        <span className="font-serif text-[15px] text-forest">
          {c.mobileNote}
        </span>
        <a
          href="#offer"
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-leaf px-6 py-3 font-semibold text-[15px] text-white transition hover:bg-leaf-dark"
        >
          {c.ctaLabel} <span aria-hidden>→</span>
        </a>
      </div>
    </>
  );
}
