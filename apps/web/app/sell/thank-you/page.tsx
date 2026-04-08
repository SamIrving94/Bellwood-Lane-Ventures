import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Thank You — Bellwood Ventures',
  description: 'We have received your property details.',
};

const ThankYouPage = () => {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <div className="mb-6 text-5xl">&#10003;</div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        Thank you for your submission
      </h1>
      <p className="mt-4 text-gray-600">
        We&apos;ve received your property details. A member of the Bellwood
        team will be in touch within <strong>48 hours</strong> with a
        guaranteed cash offer.
      </p>
      <p className="mt-6 text-sm text-gray-500">
        If you need to speak to someone urgently, please email us at{' '}
        <a
          href="mailto:hello@bellwoodventures.co.uk"
          className="font-medium text-gray-900 underline"
        >
          hello@bellwoodventures.co.uk
        </a>
      </p>
    </div>
  );
};

export default ThankYouPage;
