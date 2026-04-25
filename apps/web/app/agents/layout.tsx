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
  title:
    'For estate agents · Save the deal. Keep the commission. · Bellwoods Lane',
  description:
    'When a chain breaks, probate stalls, or a buyer walks — Bellwoods Lane buys in 18 days. You earn up to 3% + VAT. Your client thinks you’re a hero.',
  openGraph: {
    title: 'Save the deal. Keep the commission. · Bellwoods Lane',
    description:
      'For UK estate agents. Cash buyer with binding 72h offers, no re-trade, AML cover, up to 3% + VAT per referral.',
    type: 'website',
  },
};

export default function AgentsLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${fraunces.variable} ${inter.variable} min-h-screen bg-[#FAFAF7] font-sans text-[#0A1020] antialiased`}
    >
      {children}
    </div>
  );
}
