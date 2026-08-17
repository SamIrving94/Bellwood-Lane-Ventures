import { sansDocFont, serifDocFont } from '@repo/design-system/lib/fonts';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Get an indicative cash offer · Kept',
  description:
    'A cash offer that reflects the speed and certainty of the transaction, confirmed in writing after viewing. Completion in weeks not months. No fees.',
  openGraph: {
    title: 'Sell your home. On your timeline. No surprises. · Kept',
    description:
      'An indicative cash offer, confirmed in writing after viewing. The price we confirm is the price we complete at.',
    type: 'website',
  },
};

export default function InstantOfferLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className={`${serifDocFont.variable} ${sansDocFont.variable} min-h-screen bg-cream font-sans text-forest antialiased`}
    >
      {children}
    </div>
  );
}
