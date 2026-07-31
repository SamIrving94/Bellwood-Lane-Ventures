import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Agent Portal · Bellwoods Lane',
  robots: 'noindex',
};

export default function PartnersLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FBF8F5] font-sans text-[#2B2220] antialiased">
      {children}
    </div>
  );
}
