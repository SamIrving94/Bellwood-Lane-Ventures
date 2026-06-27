import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title:
    'For estate agents · Save the deal. Keep the commission. · Bellwoods Lane',
  description:
    'When a chain breaks, probate stalls, or a buyer walks — Bellwoods Lane is the cash buyer who steps in and keeps your commission intact. Partner fee agreed in writing per deal.',
  openGraph: {
    title: 'Save the deal. Keep the commission. · Bellwoods Lane',
    description:
      'For UK estate agents. Cash buyer. The price we confirm is the price we complete at — no last-minute surprises. Partner fee agreed in writing per deal.',
    type: 'website',
  },
};

export default function AgentsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FBF8F5] font-sans text-[#2B2220] antialiased">
      {children}
    </div>
  );
}
