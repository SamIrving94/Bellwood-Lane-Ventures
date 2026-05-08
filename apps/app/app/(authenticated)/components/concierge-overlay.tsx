'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@repo/design-system/components/ui/dialog';
import { ConciergeChat } from '../research/concierge-chat';

const SUGGESTED_PROMPTS: Array<{ label: string; prompt: string }> = [
  {
    label: 'Comparable evidence',
    prompt:
      'Pull recent comparable sold prices and £/sqft trends in postcode SK4 3HQ for terraced houses. Summarise in three bullet points.',
  },
  {
    label: 'Active agents in a postcode',
    prompt:
      'List the five estate agents with the most active listings in postcode M14 in the last 30 days, with phone numbers if available.',
  },
  {
    label: 'Risk profile of an address',
    prompt:
      'Give me the risk profile (flood, planning history, conservation, listed status) for postcode W14 9JH.',
  },
  {
    label: 'Resale viability',
    prompt:
      'For postcode SK4 3HQ — demand score, days-on-market, 5-year capital growth. Worth holding or flipping?',
  },
];

/**
 * Cmd+K (or Ctrl+K) opens the Concierge as an overlay. Available
 * everywhere in the dashboard. Replaces the old sidebar /research
 * link — Concierge is a utility, not a destination.
 */
export function ConciergeOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((current) => !current);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between border-b px-6 py-3">
          <DialogTitle className="font-mono text-[11px] uppercase tracking-[0.22em] text-amber-700">
            Bellwoods Concierge
          </DialogTitle>
          <p className="font-mono text-[10px] text-muted-foreground">
            Powered by PropertyData · Esc to close
          </p>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">
          <ConciergeChat suggestedPrompts={SUGGESTED_PROMPTS} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Visual hint button rendered in the sidebar. Clicking it dispatches a
 * synthetic Cmd+K so the same overlay opens.
 */
export function ConciergeTrigger() {
  const handleClick = () => {
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: typeof navigator !== 'undefined' && navigator.platform?.includes('Mac'),
      ctrlKey: !(typeof navigator !== 'undefined' && navigator.platform?.includes('Mac')),
      bubbles: true,
    });
    window.dispatchEvent(event);
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
    >
      <span aria-hidden>🔍</span>
      <span>Concierge</span>
      <span className="ml-auto rounded border bg-background px-1 py-0.5 font-mono text-[10px]">
        ⌘K
      </span>
    </button>
  );
}
