// Quiet status note — a small static dot + italic serif. No pulse, no pill
// chrome (the pulsing-pill look read as a generic landing-page tell). API kept
// so existing callers don't change.

import type { ReactNode } from 'react';

type LivePillProps = {
  children: ReactNode;
  tone?: 'green' | 'gold';
};

export function LivePill({ children, tone = 'green' }: LivePillProps) {
  const dot = tone === 'green' ? '#1F6B3A' : '#DB5C5C';
  return (
    <span className="inline-flex items-center gap-2.5 font-serif text-sm italic text-stone-600">
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: dot }}
        aria-hidden
      />
      {children}
    </span>
  );
}
