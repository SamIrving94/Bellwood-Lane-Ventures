import { brand } from '@repo/brand';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: `Privacy notice · ${brand.name}`,
  description:
    'What personal data we collect when you ask us for an offer, why we hold it, how long we keep it, who processes it, and the rights you have over it.',
};

/**
 * DRAFT — needs sign-off before launch.
 *
 * This notice is written to match what the code actually does (see the quote
 * route, the partner magic-link flow and the track timeline), not a template.
 * Two things must be filled in by the founder before this is relied on:
 * the registered company number and the ICO registration number.
 */
const LAST_UPDATED = '31 July 2026';

const SECTIONS: Array<{
  id: string;
  eyebrow: string;
  title: string;
  body: React.ReactNode;
}> = [
  {
    id: 'who',
    eyebrow: 'Who is responsible',
    title: 'We are the controller of the data on this site.',
    body: (
      <>
        <p>
          {brand.legalName} decides why and how your personal data is used,
          which makes us the data controller under UK GDPR. We are registered
          with the Information Commissioner&rsquo;s Office as a data controller.
        </p>
        <p>
          Questions, requests, or complaints about your data:{' '}
          <a href={`mailto:privacy@${brand.domain}`}>privacy@{brand.domain}</a>.
          We aim to answer within one month, which is the statutory limit.
        </p>
      </>
    ),
  },
  {
    id: 'what',
    eyebrow: 'What we collect',
    title: 'Only what an offer actually requires.',
    body: (
      <>
        <p>When you request an indicative offer, we ask for and store:</p>
        <ul>
          <li>
            <strong>The property.</strong> Address, postcode, type, bedrooms,
            your rating of its condition, your situation (probate, chain break
            and so on), your timescale, and an asking price if you give one.
          </li>
          <li>
            <strong>You.</strong> Name, email address, and phone number if you
            provide it. If you are an agent, your firm name.
          </li>
          <li>
            <strong>Anything you type in a free-text field</strong>, including
            messages sent from a deal timeline page.
          </li>
        </ul>
        <p>
          Before you submit anything, the address-lookup box passes what you
          type to Ordnance Survey to find matching addresses. We do not record
          those searches.
        </p>
        <p>
          We also enrich the property (not you) from public and licensed
          sources: HM Land Registry sold prices, the EPC register, and property
          market data. That is about the building, not about your household.
        </p>
      </>
    ),
  },
  {
    id: 'why',
    eyebrow: 'Why we may use it',
    title: 'Our lawful bases, plainly.',
    body: (
      <>
        <ul>
          <li>
            <strong>To produce and honour an offer</strong> — steps taken at
            your request before entering a contract, and performance of that
            contract if you proceed.
          </li>
          <li>
            <strong>To meet our legal obligations</strong> —
            anti-money-laundering checks under the Money Laundering Regulations
            2017, and record-keeping.
          </li>
          <li>
            <strong>Our legitimate interests</strong> — running and securing the
            service, preventing abuse of our forms, and keeping records of what
            we offered and why. We do not think any of this overrides your
            rights; if you disagree, you can object (see below).
          </li>
        </ul>
        <p>
          <strong>
            We do not sell your data, and we do not use it for advertising.
          </strong>
        </p>
      </>
    ),
  },
  {
    id: 'sharing',
    eyebrow: 'Who else sees it',
    title: 'Our processors, and the people in your chain.',
    body: (
      <>
        <p>
          We use third parties to run the service. They act on our instructions
          and may not use your data for their own purposes:
        </p>
        <ul>
          <li>Vercel — website and application hosting.</li>
          <li>Neon — the database your record is stored in.</li>
          <li>Resend — sending the emails we send you.</li>
          <li>Clerk — sign-in for our internal team.</li>
          <li>
            Anthropic — we pass submission details to an AI model to summarise
            them for our team. Anthropic does not use this data to train models.
          </li>
          <li>
            Ordnance Survey and property-data providers — address lookup and
            valuation inputs.
          </li>
        </ul>
        <p>
          If your sale proceeds, we share what is necessary with solicitors,
          surveyors, and any agent already involved. Where a deal has a live
          timeline link, <strong>anyone holding that link</strong> can see the
          property address and the updates on it, with no login. Share it only
          with people you want to have it, and tell us if it needs revoking.
        </p>
        <p>
          Some providers process data outside the UK. Where they do, transfers
          rely on UK adequacy regulations or the International Data Transfer
          Agreement.
        </p>
      </>
    ),
  },
  {
    id: 'keeping',
    eyebrow: 'How long we keep it',
    title: 'As long as the law requires, then no longer.',
    body: (
      <>
        <ul>
          <li>
            <strong>Offer requests that do not proceed</strong> — kept while the
            offer is live, then retained for seven years to meet
            anti-money-laundering and tax record-keeping duties.
          </li>
          <li>
            <strong>Completed purchases</strong> — seven years from completion,
            for the same reasons.
          </li>
          <li>
            <strong>Agent portal accounts</strong> — until you ask us to close
            the account.
          </li>
        </ul>
        <p>
          The seven-year floor is a legal obligation, so we cannot delete
          AML-relevant records on request before it expires.
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    eyebrow: 'Cookies',
    title: 'One functional cookie, no tracking.',
    body: (
      <>
        <p>
          We set a single cookie, and only for agents who sign in to the partner
          portal: it keeps you signed in. It is strictly necessary for that
          feature, so it does not require consent, and it is not used to profile
          you.
        </p>
        <p>
          We do not run advertising or cross-site tracking cookies on this site.
          If that changes we will ask for your consent first and update this
          page.
        </p>
      </>
    ),
  },
  {
    id: 'rights',
    eyebrow: 'Your rights',
    title: 'What you can ask us to do.',
    body: (
      <>
        <p>Under UK GDPR you can ask us to:</p>
        <ul>
          <li>give you a copy of the personal data we hold about you;</li>
          <li>correct it if it is wrong;</li>
          <li>
            delete it, where we are not required to keep it (see retention);
          </li>
          <li>restrict or object to how we use it;</li>
          <li>provide it in a portable format.</li>
        </ul>
        <p>
          Email{' '}
          <a href={`mailto:privacy@${brand.domain}`}>privacy@{brand.domain}</a>.
          Exercising these rights is free and we will not treat you differently
          for doing so.
        </p>
        <p>
          If you are unhappy with how we have handled your data you can complain
          to the Information Commissioner&rsquo;s Office at{' '}
          <a
            href="https://ico.org.uk/make-a-complaint/"
            target="_blank"
            rel="noopener noreferrer"
          >
            ico.org.uk/make-a-complaint
          </a>
          , or call 0303 123 1113. We would rather you came to us first so we
          can put it right.
        </p>
      </>
    ),
  },
  {
    id: 'security',
    eyebrow: 'Security',
    title: 'How your data is protected.',
    body: (
      <>
        <p>
          Data is encrypted in transit and at rest by our hosting and database
          providers. Access to the internal dashboard is restricted to our team
          and protected by individual sign-in. Partner portal links are
          single-purpose and time-limited.
        </p>
        <p>
          No system is perfect. If we ever suffer a breach that is likely to
          risk your rights, we will tell the ICO within 72 hours and tell you
          without undue delay.
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-cream px-6 py-20 md:px-12 md:py-28">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/sell"
          className="inline-flex items-center gap-2 font-serif text-[13px] text-stone-500 italic transition hover:text-leaf"
        >
          <span aria-hidden>←</span> Back to the site
        </Link>

        <p className="mt-12 font-serif text-[13px] text-leaf italic">
          Privacy notice
        </p>
        <h1
          className="mt-5 font-semibold font-serif text-forest leading-[1.02] tracking-[-0.025em]"
          style={{ fontSize: 'clamp(44px, 6vw, 72px)' }}
        >
          What we hold,
          <br />
          and for how long.
        </h1>
        <p className="mt-8 max-w-2xl text-[17px] text-stone-600 leading-relaxed">
          People come to us at difficult moments, so we ask for as little as an
          offer needs and keep it no longer than the law requires. This notice
          says exactly what that means. It covers {brand.domain} and the emails
          we send you.
        </p>
        <p className="mt-4 font-mono text-[11px] text-stone-400">
          Last updated {LAST_UPDATED} · version 1.0
        </p>

        <div className="mt-16 space-y-16">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id}>
              <p className="font-serif text-[13px] text-leaf italic">
                {s.eyebrow}
              </p>
              <h2 className="mt-3 font-semibold font-serif text-3xl leading-[1.15] tracking-[-0.02em] md:text-4xl">
                {s.title}
              </h2>
              <div className="prose prose-slate mt-5 max-w-none text-[16px] text-stone-700 leading-relaxed [&_a]:text-leaf [&_a]:underline [&_li]:my-2 [&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5">
                {s.body}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-20 border-hair border-t pt-8">
          <p className="text-[15px] text-stone-600 leading-relaxed">
            See also our{' '}
            <Link href="/legal/fca-disclosure" className="text-leaf underline">
              regulatory status
            </Link>
            , which explains what we are and are not authorised to do.
          </p>
        </div>
      </div>
    </main>
  );
}
