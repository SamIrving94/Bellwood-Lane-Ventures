import { getCurrentAgent } from '@/app/partners/_lib/auth';
import { LogoLockup } from '@/components/brand';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

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
    <div className="min-h-screen bg-[#FBF8F5] font-sans text-[#2B2220] antialiased">
      <header className="border-[#EAE0D9] border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <LogoLockup href="/portal" />
            <span className="hidden font-serif text-sm text-stone-500 italic sm:inline">
              partner portal
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <span className="text-stone-600">{agent.firmName}</span>
            <span className="rounded-full border border-[#DB5C5C]/30 bg-[#F6ECE7] px-3 py-1 font-medium text-[#874646] text-xs capitalize">
              {agent.tier}
            </span>
            <form action="/api/partners/logout" method="post">
              <button
                type="submit"
                className="text-stone-500 hover:text-[#874646]"
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
