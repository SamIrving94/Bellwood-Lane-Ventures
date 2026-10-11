import { AGENT_SIDE_PUBLIC } from '@/lib/public-sections';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'For estate agents · Save the deal. Keep the commission. · Kept',
  description:
    'When a chain breaks, probate stalls, or a buyer walks — Kept is the cash buyer who steps in and keeps your commission intact. Partner fee agreed in writing per deal.',
  openGraph: {
    title: 'Save the deal. Keep the commission. · Kept',
    description:
      'For UK estate agents. Cash buyer. The price we confirm is the price we complete at — no last-minute surprises. Partner fee agreed in writing per deal.',
    type: 'website',
  },
};

export default function AgentsLayout({ children }: { children: ReactNode }) {
  // Hidden for now — see lib/public-sections.ts. Covers /agents/score too.
  if (!AGENT_SIDE_PUBLIC) {
    notFound();
  }
  return (
    <div className="min-h-screen bg-cream font-sans text-forest antialiased">
      {children}
    </div>
  );
}
