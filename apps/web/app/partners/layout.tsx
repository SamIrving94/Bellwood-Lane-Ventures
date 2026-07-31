import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Agent Portal · Kept',
  robots: 'noindex',
};

export default function PartnersLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-cream font-sans text-forest antialiased">
      {children}
    </div>
  );
}
