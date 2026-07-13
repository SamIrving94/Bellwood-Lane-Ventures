import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Sell your home for cash · Bellwoods Lane',
  description:
    'A cash offer that reflects the speed and certainty of the transaction, confirmed in writing after viewing. Completion in weeks not months. No fees. The price we confirm is the price we complete at.',
  openGraph: {
    title: 'Sell your home for cash · Bellwoods Lane',
    description:
      'An indicative cash offer, confirmed in writing after viewing. Completion in weeks not months. No fees.',
    type: 'website',
  },
};

export default function SellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FBF8F5] font-sans text-[#2B2220] antialiased">
      {children}
    </div>
  );
}
