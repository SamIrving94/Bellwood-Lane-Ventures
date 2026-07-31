import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Get an indicative cash offer · Bellwoods Lane',
  description:
    'A written cash offer after viewing, priced for a fast, certain completion. Weeks not months. No fees.',
  openGraph: {
    title: 'Sell your home. On your timeline. No surprises. · Bellwoods Lane',
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
    <div className="min-h-screen bg-[#FBF8F5] font-sans text-[#2B2220] antialiased">
      {children}
    </div>
  );
}
