import { getCurrentAgent } from '@/app/partners/_lib/auth';
import { Eyebrow, LogoLockup } from '@/components/brand';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

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
    <div className="min-h-screen bg-cream font-sans text-forest antialiased">
      <header className="border-hair border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <LogoLockup href="/portal" />
            <Eyebrow tone="muted" className="hidden sm:inline-flex">
              Partner
            </Eyebrow>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <span className="text-body">{agent.firmName}</span>
            <span className="rounded-full border border-hair bg-soft px-3 py-1 text-body text-xs capitalize">
              {agent.tier}
            </span>
            <form action="/api/partners/logout" method="post">
              <button type="submit" className="text-body hover:text-leaf">
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
