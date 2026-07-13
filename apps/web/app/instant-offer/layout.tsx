import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import type { ReactNode } from 'react';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Get an indicative cash offer · Bellwoods Lane',
  description:
    'A cash offer that reflects the speed and certainty of the transaction, confirmed in writing after viewing. Completion in weeks not months. No fees.',
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
    <div
      className={`${fraunces.variable} ${inter.variable} min-h-screen bg-[#FBF8F5] font-sans text-[#2B2220] antialiased`}
    >
      {children}
    </div>
  );
}
