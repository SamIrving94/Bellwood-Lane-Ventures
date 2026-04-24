import { redirect } from 'next/navigation';
import { Fraunces, Inter } from 'next/font/google';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { getCurrentAgent } from '@/app/partners/_lib/auth';

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
  title: 'Agent Portal · Bellwoods Lane',
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
      className={`${fraunces.variable} ${inter.variable} min-h-screen bg-[#FAFAF7] font-sans text-[#0A1020] antialiased`}
    >
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/portal"
            className="font-serif text-lg font-semibold tracking-tight"
          >
            BELLWOODS
            <span className="mx-2 inline-block h-px w-6 bg-[#C6A664] align-middle" />
            <span className="text-xs font-normal tracking-widest text-slate-500">
              LANE · PARTNER
            </span>
          </Link>
          <div className="flex items-center gap-6 text-sm">
            <span className="text-slate-600">{agent.firmName}</span>
            <span className="rounded-full border border-[#C6A664]/30 bg-[#FAF6EA] px-3 py-1 text-xs font-medium uppercase tracking-widest text-[#C6A664]">
              {agent.tier}
            </span>
            <form action="/api/partners/logout" method="post">
              <button
                type="submit"
                className="text-slate-500 hover:text-[#0A2540]"
              >
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
