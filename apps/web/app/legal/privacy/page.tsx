import { SiteHeader } from '@/components/site-header';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy notice — Kept',
  description:
    'What personal data Kept collects, why, who processes it, how long we keep it, and your rights under UK data-protection law.',
};

/**
 * The privacy notice. This page existed as a dead link from the regulatory
 * page while the site told visitors "ICO-registered as a data controller" —
 * the UX review flagged that as a UK GDPR transparency gap, not a 404.
 * Wording is deliberately plain-English (same register as the FCA page).
 */

const SECTIONS: Array<{
  id: string;
  eyebrow: string;
  title: string;
  body: React.ReactNode;
}> = [
  {
    id: 'who',
    eyebrow: 'Who we are',
    title: 'The data controller.',
    body: (
      <p>
        Kept is the trading name of Bellwoods Lane Ventures Ltd (registered in
        England &amp; Wales, Company No. 16454416, registered office 20
        Wenlock Road, London N1 7GU). We are registered with the Information
        Commissioner&rsquo;s Office as a data controller. Questions about this
        notice or your data:{' '}
        <a className="underline" href="mailto:anthony@bellwoodslane.co.uk">
          anthony@bellwoodslane.co.uk
        </a>
        .
      </p>
    ),
  },
  {
    id: 'what',
    eyebrow: 'What we collect',
    title: 'Only what a property purchase needs.',
    body: (
      <>
        <p>
          <strong>You give us:</strong> your name, email address, phone
          number, your relationship to the property (seller, agent,
          solicitor), the property address, and anything you tell us about
          your situation and timeline — through our forms, by email, or by
          WhatsApp.
        </p>
        <p>
          <strong>We look up:</strong> public property records for the address
          you give us — HM Land Registry entries and price-paid data, EPC
          register entries, and planning records. These describe the
          property, not you.
        </p>
        <p>
          <strong>We do not</strong> buy marketing lists, place third-party
          advertising trackers, or collect anything about you before you
          contact us.
        </p>
      </>
    ),
  },
  {
    id: 'why',
    eyebrow: 'Why we use it',
    title: 'To research, make and complete an offer.',
    body: (
      <>
        <p>
          We use your data to research the property, prepare and send your
          offer, answer your messages, run the transaction through to
          completion, and meet our legal duties (including anti-money-
          laundering checks supervised by HMRC).
        </p>
        <p>
          In legal terms: taking steps at your request before entering a
          contract, our legitimate interest in operating a property-buying
          business, and compliance with legal obligations. We do not use your
          data for automated decisions that produce legal effects about you —
          software prepares the research, a person decides and signs every
          offer.
        </p>
      </>
    ),
  },
  {
    id: 'processors',
    eyebrow: 'Who touches it',
    title: 'Named categories of processor. No selling, ever.',
    body: (
      <>
        <p>
          Your data is stored and processed by the service providers that run
          our platform: cloud hosting and databases, email delivery, WhatsApp
          messaging (if you contact us there), and AI tooling that helps
          draft internal research summaries — always under contracts that
          limit them to processing on our instructions.
        </p>
        <p>
          Beyond that, we share data only with the people a property sale
          requires — solicitors and surveyors on the transaction — and with
          authorities where the law requires it. We never sell your data, and
          we never pass it to marketing companies.
        </p>
      </>
    ),
  },
  {
    id: 'retention',
    eyebrow: 'How long',
    title: 'Transaction records are kept; enquiries are not kept forever.',
    body: (
      <p>
        If we buy your property, transaction and AML records are kept for six
        years after completion, as the law requires. If we don&rsquo;t end up
        transacting, we keep your enquiry long enough to answer follow-ups
        and then delete it — no marketing drip, no indefinite file.
      </p>
    ),
  },
  {
    id: 'rights',
    eyebrow: 'Your rights',
    title: 'Access, correction, deletion, objection.',
    body: (
      <>
        <p>
          Under UK data-protection law you can ask for a copy of your data,
          ask us to correct or delete it, object to or restrict our use of
          it, and take your data elsewhere. Email{' '}
          <a className="underline" href="mailto:anthony@bellwoodslane.co.uk">
            anthony@bellwoodslane.co.uk
          </a>{' '}
          — we respond within one month.
        </p>
        <p>
          If you&rsquo;re unhappy with our answer, you can complain to the
          Information Commissioner&rsquo;s Office at{' '}
          <a
            className="underline"
            href="https://ico.org.uk/make-a-complaint/"
            target="_blank"
            rel="noreferrer"
          >
            ico.org.uk/make-a-complaint
          </a>{' '}
          — free, and you don&rsquo;t need a lawyer.
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    eyebrow: 'Cookies',
    title: 'Essentials only.',
    body: (
      <p>
        The public site uses only the cookies needed to run it (for example,
        keeping a partner agent signed in to their portal). We do not run
        third-party advertising cookies. If that changes, this notice and a
        consent banner will say so first.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="bg-cream">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <p className="text-leaf text-xs uppercase tracking-widest">
            Privacy notice
          </p>
          <h1 className="mt-3 font-semibold font-serif text-4xl leading-tight md:text-5xl">
            Your data, plainly.
          </h1>
          <p className="mt-5 text-[15px] text-stone-600 leading-relaxed">
            Selling a home means trusting a stranger with your details at a
            hard moment. Here is exactly what we hold, why, and how to make
            us prove it. Last updated August 2026.
          </p>

          <div className="mt-14 space-y-14">
            {SECTIONS.map((s) => (
              <section key={s.id} id={s.id}>
                <p className="font-serif text-[13px] text-stone-500 italic">
                  {s.eyebrow}
                </p>
                <h2 className="mt-2 font-semibold font-serif text-2xl">
                  {s.title}
                </h2>
                <div className="mt-4 space-y-4 text-[15px] text-stone-700 leading-relaxed">
                  {s.body}
                </div>
              </section>
            ))}
          </div>

          <hr className="my-16 border-stone-200" />
          <p className="text-[13px] text-stone-500 leading-relaxed">
            See also our{' '}
            <Link className="underline" href="/legal/fca-disclosure">
              regulatory status
            </Link>
            . Nothing on this page constitutes legal advice.
          </p>
        </div>
      </main>
    </>
  );
}
