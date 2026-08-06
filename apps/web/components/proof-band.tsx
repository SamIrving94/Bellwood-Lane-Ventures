import { Eyebrow } from '@/components/brand';
import Link from 'next/link';

/**
 * The proof band — one claim, one third-party proof, per card (the Monzo
 * trust-band pattern, in Kept register). Every card links out to the body
 * that can verify the claim, the way Muve's footer carries a live
 * "authenticate" link. Claims mirror the FAQ/regulatory wording exactly —
 * no member numbers or scheme details are invented here.
 */

const PROOFS: Array<{
  t: string;
  d: string;
  href: string;
  cta: string;
  external?: boolean;
}> = [
  {
    t: 'Property Redress Scheme',
    d: 'Members of the PRS, a government-approved independent redress body. If we get something wrong, you have somewhere to take it that is not us.',
    href: 'https://www.theprs.co.uk/',
    cta: 'Verify at theprs.co.uk',
    external: true,
  },
  {
    t: 'The Property Ombudsman code',
    d: 'We voluntarily follow the TPO code for seller-facing communications, although cash buying does not require it.',
    href: 'https://www.tpos.co.uk/',
    cta: 'Read the code at tpos.co.uk',
    external: true,
  },
  {
    t: 'HMRC AML supervised',
    d: 'Registered with HMRC for anti-money-laundering supervision under the Money Laundering Regulations 2017.',
    href: '/legal/fca-disclosure',
    cta: 'See our full regulatory status',
  },
  {
    t: 'ICO registered',
    d: 'Registered with the Information Commissioner’s Office as a data controller. Your details are handled under UK data-protection law.',
    href: 'https://ico.org.uk/ESDWebPages/Search',
    cta: 'Search the ICO register',
    external: true,
  },
];

export function ProofBand({ id }: { id?: string }) {
  return (
    <section id={id} className="px-4 py-10 md:px-8">
      {/* An inset tinted sheet on the desk, not a full-bleed band — the
          founder review flagged horizontal band-slicing as a template tell. */}
      <div className="mx-auto max-w-6xl rounded-sm border border-hair bg-soft px-6 py-14 md:px-12 md:py-16">
        <Eyebrow>one claim, one proof</Eyebrow>
        <h2 className="mt-4 max-w-2xl font-semibold font-serif text-3xl leading-tight tracking-[-0.02em] md:text-4xl">
          Don&rsquo;t take our word for any of this.
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PROOFS.map((p) => (
            <div
              key={p.t}
              className="flex flex-col rounded-sm border border-hair bg-white p-6"
            >
              <p className="font-semibold font-serif text-[17px] text-forest">
                {p.t}
              </p>
              <p className="mt-3 flex-1 text-[13px] text-stone-600 leading-relaxed">
                {p.d}
              </p>
              {p.external ? (
                <a
                  href={p.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 text-[13px] text-leaf underline decoration-leaf/50 underline-offset-4 hover:decoration-leaf"
                >
                  {p.cta} →
                </a>
              ) : (
                <Link
                  href={p.href}
                  className="mt-5 text-[13px] text-leaf underline decoration-leaf/50 underline-offset-4 hover:decoration-leaf"
                >
                  {p.cta} →
                </Link>
              )}
            </div>
          ))}
        </div>
        <p className="mt-8 text-[12px] text-stone-500 leading-relaxed">
          Cash property buying is not regulated by the FCA, so no
          FCA-authorisation claim appears above. What that means for you is set
          out plainly on our{' '}
          <Link className="underline underline-offset-2" href="/legal/fca-disclosure">
            regulatory status page
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
