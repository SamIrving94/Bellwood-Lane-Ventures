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
  title: 'Sell your home for cash · Bellwoods Lane',
  description:
    'A binding written cash offer for your UK home — same day. Completion on your timeline. No fees. No fall-throughs. No re-trade.',
  openGraph: {
    title: 'Sell your home for cash · Bellwoods Lane',
    description:
      'Binding written cash offer for your UK home, same day. Completion on your timeline. No fees. No re-trade.',
    type: 'website',
  },
};

export default function SellLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${fraunces.variable} ${inter.variable} min-h-screen bg-[#FAFAF7] font-sans text-[#0A1020] antialiased`}
    >
      {children}
    </div>
  );
}
