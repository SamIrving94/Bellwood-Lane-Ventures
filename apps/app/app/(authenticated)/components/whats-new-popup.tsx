'use client';

import { SparklesIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { latestWhatsNew } from '@/lib/whats-new';

/**
 * The login "moment of joy" — a one-time celebration card announcing the
 * newest release, with a confetti burst. Shows once per browser per release
 * (dismissal stored in localStorage keyed by the entry id), never blocks
 * work (Escape / backdrop / button all close it), and respects
 * prefers-reduced-motion (no confetti, no bounce).
 *
 * To announce the next feature: add an entry to lib/whats-new.ts.
 */

const SEEN_KEY = 'bellwood.whats-new.seen';

// Deterministic confetti pieces — index-seeded so SSR/CSR markup match.
const CONFETTI_COLORS = [
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
];
const CONFETTI = Array.from({ length: 28 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  delay: `${((i * 53) % 90) / 100}s`,
  duration: `${2 + ((i * 29) % 120) / 100}s`,
  size: 6 + ((i * 13) % 6),
  rotate: `${(i * 47) % 360}deg`,
}));

export function WhatsNewPopup() {
  const entry = latestWhatsNew();
  const entryId = entry?.id ?? null;
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const dismiss = useCallback(() => {
    if (entryId) {
      try {
        window.localStorage.setItem(SEEN_KEY, entryId);
      } catch {
        // Storage unavailable — it'll show again next login; harmless.
      }
    }
    setOpen(false);
  }, [entryId]);

  useEffect(() => {
    if (!entryId) return;
    let seen: string | null = null;
    try {
      seen = window.localStorage.getItem(SEEN_KEY);
    } catch {
      // Private mode / blocked storage — treat as seen so we never nag.
      return;
    }
    if (seen === entryId) return;
    // A beat after the dashboard paints — a moment, not a roadblock.
    const timer = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(timer);
  }, [entryId]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, dismiss]);

  if (!entry || !open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`What's new: ${entry.title}`}
    >
      {/* Confetti + entrance animations. Scoped keyframes; disabled for
          reduced-motion users. */}
      <style>{`
        @keyframes wn-fall {
          0% { transform: translateY(-12vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes wn-pop {
          0% { transform: scale(0.92) translateY(10px); opacity: 0; }
          60% { transform: scale(1.02) translateY(-2px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .wn-confetti { display: none; }
          .wn-card { animation: none !important; }
        }
      `}</style>

      {/* Backdrop */}
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={dismiss}
      />

      {/* Confetti burst */}
      <div className="wn-confetti pointer-events-none absolute inset-0 overflow-hidden">
        {CONFETTI.map((c, i) => (
          <span
            // Static array — index keys are stable here.
            // biome-ignore lint/suspicious/noArrayIndexKey: deterministic list
            key={i}
            className="absolute top-0 block rounded-[2px]"
            style={{
              left: c.left,
              width: c.size,
              height: c.size * 1.6,
              background: c.background,
              transform: `rotate(${c.rotate})`,
              animation: `wn-fall ${c.duration} linear ${c.delay} 1 both`,
            }}
          />
        ))}
      </div>

      {/* Card */}
      <div
        className="wn-card relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl"
        style={{ animation: 'wn-pop 0.45s cubic-bezier(0.16, 1, 0.3, 1) both' }}
      >
        <button
          ref={closeRef}
          type="button"
          aria-label="Close"
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          onClick={dismiss}
        >
          <XIcon className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          <SparklesIcon className="h-4 w-4 text-amber-500" />
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            New this week
          </p>
        </div>

        <div className="mt-3 flex items-start gap-3">
          <span className="text-4xl leading-none" aria-hidden>
            {entry.emoji}
          </span>
          <div>
            <h2 className="font-semibold text-xl leading-tight tracking-tight">
              {entry.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{entry.intro}</p>
          </div>
        </div>

        <ul className="mt-4 space-y-2.5">
          {entry.bullets.map((b) => (
            <li key={b.text} className="flex items-start gap-2.5 text-sm">
              <span aria-hidden className="mt-px shrink-0">
                {b.emoji}
              </span>
              <span>{b.text}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={dismiss}
          >
            Maybe later
          </button>
          {entry.cta ? (
            <Link
              href={entry.cta.href}
              className="rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background hover:opacity-90"
              onClick={dismiss}
            >
              {entry.cta.label} →
            </Link>
          ) : (
            <button
              type="button"
              className="rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background hover:opacity-90"
              onClick={dismiss}
            >
              Love it
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
