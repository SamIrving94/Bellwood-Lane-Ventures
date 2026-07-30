import { getCurrentAgent } from '@/app/partners/_lib/auth';
import { Fraunces, Inter } from 'next/font/google';
import Link from 'next/link';
import { redirect } from 'next/navigation';
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

export const metadata = {
  title: 'Agent Portal · Kept',
  robots: 'noindex',
};

export default async function PortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const agent = await getCurrentAgent();
  if (!agent) {
    redirect('/partners/login');
  }

  return (
    <div
      className={`${fraunces.variable} ${inter.variable} min-h-screen bg-cream font-sans text-forest antialiased`}
    >
      <header className="border-stone-200 border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/portal"
            className="font-semibold font-serif text-lg tracking-tight"
          >
            BELLWOODS
            <span className="mx-2 inline-block h-px w-6 bg-wax align-middle" />
            <span className="font-normal text-stone-500 text-xs tracking-widest">
              LANE · PARTNER
            </span>
          </Link>
          <div className="flex items-center gap-6 text-sm">
            <span className="text-stone-600">{agent.firmName}</span>
            <span className="rounded-full border border-leaf/30 bg-soft px-3 py-1 font-medium text-leaf text-xs uppercase tracking-widest">
              {agent.tier}
            </span>
            <form action="/api/partners/logout" method="post">
              <button type="submit" className="text-stone-500 hover:text-leaf">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
