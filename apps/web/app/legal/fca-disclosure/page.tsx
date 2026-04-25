import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Regulatory status — Bellwoods Lane',
  description:
    'How Bellwoods Lane is regulated, what that means for you, and the legal footing of our cash offers.',
};

const SECTIONS: Array<{
  id: string;
  eyebrow: string;
  title: string;
  body: React.ReactNode;
}> = [
  {
    id: 'who',
    eyebrow: 'Who we are',
    title: 'A direct cash buyer, not a broker or intermediary.',
    body: (
      <>
        <p>
          Bellwoods Lane Ltd is a UK private company (registered in England
          &amp; Wales) that buys residential property for its own account,
          using its own capital. We are not an estate agent, not a broker,
          not a mortgage lender, and not a member of any property portal.
        </p>
        <p>
          When we quote you a price, that price is an offer from us to buy
          — not an estimate of what someone else might pay. If you accept,
          we are the buyer.
        </p>
      </>
    ),
  },
  {
    id: 'fca',
    eyebrow: 'FCA status',
    title: 'We are not authorised or regulated by the FCA.',
    body: (
      <>
        <p>
          The Financial Conduct Authority authorises firms that carry out
          regulated financial activities — lending, deposit-taking,
          insurance, investment advice. Buying a residential property with
          our own money is not a regulated activity, and we do not perform
          any activity that requires FCA authorisation.
        </p>
        <p>This means three practical things for you:</p>
        <ul>
          <li>
            The Financial Services Compensation Scheme does not apply to
            any transaction with us.
          </li>
          <li>
            The Financial Ombudsman Service cannot adjudicate disputes
            between us — the normal civil courts are the route.
          </li>
          <li>
            We do not and cannot offer financial or legal advice. You must
            take your own, independently.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'standards',
    eyebrow: 'Industry standards',
    title: 'Code-of-practice bodies we voluntarily follow.',
    body: (
      <>
        <p>
          Although cash property buyers are not FCA-regulated, there are
          voluntary industry bodies that publish codes of practice. We
          follow the standards of The Property Ombudsman (for
          seller-facing communications) and the National Association of
          Property Buyers (NAPB) code. These commit us to, among other
          things: never making an offer we cannot honour, never reducing
          an offer after survey without a disclosed material defect, and
          giving you clear written terms before you commit.
        </p>
      </>
    ),
  },
  {
    id: 'aml',
    eyebrow: 'Anti-money-laundering',
    title: 'We are HMRC-supervised for AML and we cover the seller side.',
    body: (
      <>
        <p>
          Property buyers are regulated businesses under the Money
          Laundering Regulations 2017. Bellwoods Lane is registered with
          HMRC for AML supervision. Every transaction includes Customer
          Due Diligence on the seller — identity verification, source of
          funds, risk assessment.
        </p>
        <p>
          When we work with an estate agent on a referral, we issue a
          written compliance receipt that confirms CDD has been carried
          out. The agent keeps it on file — it materially reduces their
          own exposure.
        </p>
      </>
    ),
  },
  {
    id: 'contract',
    eyebrow: 'The offer itself',
    title: 'What "legally binding" means here.',
    body: (
      <>
        <p>
          Our instant offers are <em>legally binding upon us</em> for 72
          hours from the issue time-stamp. During that window, we may not
          withdraw the offer without cause. If we do, we will reimburse
          your documented costs plus a fixed sum of £1,000.
        </p>
        <p>
          The offer is <em>not</em> binding upon you until you sign
          solicitors&rsquo; documents to sell. You may walk away at any
          point before exchange at no cost. We do not charge vendors any
          fee, ever.
        </p>
        <p>
          Post-survey, we may only revise the offer where an independent
          RICS-panel survey identifies an undisclosed material defect. If
          that happens, you may choose to accept the revision or walk away
          — there is no penalty for the latter.
        </p>
      </>
    ),
  },
  {
    id: 'data',
    eyebrow: 'Your data',
    title: 'What we collect, and when.',
    body: (
      <>
        <p>
          Until you request an offer, we store nothing identifiable. The
          address-lookup step uses Ordnance Survey&rsquo;s Places API; we
          pass your query through and keep no record.
        </p>
        <p>
          When you request an offer, we persist the address, the answers
          you gave, and the resulting valuation for as long as the offer
          is live (72 hours) plus seven years for regulatory record-keeping
          thereafter. See our{' '}
          <Link href="/legal/privacy" className="underline">
            privacy notice
          </Link>{' '}
          for the full detail.
        </p>
      </>
    ),
  },
  {
    id: 'advice',
    eyebrow: 'Independent advice',
    title: 'Please take it.',
    body: (
      <>
        <p>
          Selling a house for cash below open-market value is often the
          right decision — probate, chain break, short lease, tenancy
          issues, speed of need. It is just as often the wrong one. We
          cannot tell you which you are. A solicitor can, a qualified
          financial adviser can, and often your estate agent can too.
        </p>
        <p>
          We will not pressure you to sign. If anyone from Bellwoods Lane
          ever does, email{' '}
          <a
            href="mailto:anthony@bellwoodslane.co.uk"
            className="underline"
          >
            anthony@bellwoodslane.co.uk
          </a>{' '}
          and we will respond within two working days.
        </p>
      </>
    ),
  },
];

export default function FCADisclosurePage() {
  return (
    <main className="min-h-screen bg-[#FAFAF7] px-6 py-20 md:px-12 md:py-28">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/instant-offer"
          className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500 transition hover:text-[#0A2540]"
        >
          <span aria-hidden>←</span> Back to instant offer
        </Link>

        <p className="mt-12 font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
          Regulatory disclosure
        </p>
        <h1
          className="mt-5 font-serif font-semibold leading-[1.02] tracking-[-0.025em] text-[#0A1020]"
          style={{ fontSize: 'clamp(44px, 6vw, 72px)' }}
        >
          Where we stand,
          <br />
          written plainly.
        </h1>
        <p className="mt-8 max-w-2xl text-[17px] leading-relaxed text-slate-600">
          Cash property buying is an unregulated corner of the market.
          That is not a loophole we are exploiting — it is a fact we&rsquo;d
          rather you understood up-front. This page sets out, in ordinary
          language, what it means to do business with us.
        </p>
        <p className="mt-4 font-mono text-[11px] text-slate-400">
          Last updated{' '}
          {new Date().toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}{' '}
          · version 1.0
        </p>

        <div className="mt-16 space-y-16">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id}>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
                {s.eyebrow}
              </p>
              <h2 className="mt-3 font-serif text-3xl font-semibold leading-[1.15] tracking-[-0.02em] md:text-4xl">
                {s.title}
              </h2>
              <div className="prose prose-slate mt-5 max-w-none text-[16px] leading-relaxed text-slate-700 [&_a]:text-[#0A2540] [&_a]:underline [&_li]:my-2 [&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5">
                {s.body}
              </div>
            </section>
          ))}
        </div>

        <hr className="my-20 border-slate-200" />

        <section>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">
            Company details
          </p>
          <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3 text-[14px] sm:grid-cols-[160px_1fr]">
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
              Legal name
            </dt>
            <dd>Bellwoods Lane Ltd</dd>
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
              Registered in
            </dt>
            <dd>England &amp; Wales</dd>
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
              Company number
            </dt>
            <dd className="text-slate-400">[pending]</dd>
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
              Registered office
            </dt>
            <dd>London, United Kingdom</dd>
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
              Compliance contact
            </dt>
            <dd>
              <a
                className="underline"
                href="mailto:anthony@bellwoodslane.co.uk"
              >
                anthony@bellwoodslane.co.uk
              </a>
            </dd>
          </dl>
        </section>

        <p className="mt-16 font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400">
          Nothing on this page constitutes financial or legal advice.
        </p>
      </div>
    </main>
  );
}
