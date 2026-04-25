// Subtle live-status pill with pulsing dot.

import type { ReactNode } from 'react';

type LivePillProps = {
  children: ReactNode;
  tone?: 'green' | 'gold';
};

export function LivePill({ children, tone = 'green' }: LivePillProps) {
  const dotColor = tone === 'green' ? '#1F6B3A' : '#C6A664';
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-600 backdrop-blur">
      <span className="relative flex h-1.5 w-1.5">
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
          style={{ background: dotColor }}
        />
        <span
          className="relative inline-flex h-1.5 w-1.5 rounded-full"
          style={{ background: dotColor }}
        />
      </span>
      {children}
    </div>
  );
}
