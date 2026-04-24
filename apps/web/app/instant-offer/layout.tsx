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
  title: 'Get an instant cash offer · Bellwoods Lane',
  description:
    'Legally binding cash property offer in 60 seconds. Completion in 14–28 days. No fees. No fall-throughs.',
  openGraph: {
    title: 'Sell in 18 days. Cash. Guaranteed. · Bellwoods Lane',
    description:
      'Legally binding cash property offer in 60 seconds. Completion in 14–28 days.',
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
      className={`${fraunces.variable} ${inter.variable} min-h-screen bg-[#FAFAF7] font-sans text-[#0A1020] antialiased`}
    >
      {children}
    </div>
  );
}
