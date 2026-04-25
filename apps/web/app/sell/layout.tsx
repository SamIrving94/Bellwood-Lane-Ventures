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
    'Get a binding cash offer for your UK home in 60 seconds. Completion in 14–28 days. No fees. No fall-throughs. No agent needed.',
  openGraph: {
    title: 'Sell your home for cash · Bellwoods Lane',
    description:
      'Binding cash offer for your UK home in 60 seconds. Completion in 14–28 days. No fees.',
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
