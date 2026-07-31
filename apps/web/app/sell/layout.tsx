import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Sell your home for cash · Kept',
  description:
    'A written cash offer after viewing, priced for a fast, certain completion. Weeks not months, no fees. The price we confirm is the price we complete at.',
  openGraph: {
    title: 'Sell your home for cash · Kept',
    description:
      'An indicative cash offer, confirmed in writing after viewing. Completion in weeks not months. No fees.',
    type: 'website',
  },
};

export default function SellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-cream font-sans text-forest antialiased">
      {children}
    </div>
  );
}
