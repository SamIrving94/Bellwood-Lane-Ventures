import { cn } from '@repo/design-system/lib/utils';

/**
 * Kept. editorial labels.
 *
 * Eyebrow follows KEPT.md exactly: ~11px, uppercase, wide-tracked, leaf — with
 * a `wax` tone reserved for "the honest version" / promise sections. A short
 * rule leads the label. `SectionNumber` is the faint serif spine (01/02/03);
 * `StatusNote` is a quiet live note — its dot is leaf (live = interactive),
 * never wax (wax is the promise, not a status light).
 */

export function Eyebrow({
  children,
  className,
  /**
   * 'accent' = leaf (default), 'muted' = warm grey, 'light' = on dark bands,
   * 'wax' = the promise / "honest version" sections only.
   */
  tone = 'accent',
}: {
  children: React.ReactNode;
  className?: string;
  tone?: 'accent' | 'muted' | 'light' | 'wax';
}) {
  const text =
    tone === 'light'
      ? 'text-white/80'
      : tone === 'muted'
        ? 'text-body'
        : tone === 'wax'
          ? 'text-wax'
          : 'text-leaf';
  const rule =
    tone === 'light'
      ? 'bg-white/40'
      : tone === 'muted'
        ? 'bg-hair'
        : tone === 'wax'
          ? 'bg-wax'
          : 'bg-leaf';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-3 font-medium text-[11px] uppercase tracking-[0.26em]',
        text,
        className
      )}
    >
      <span className={cn('h-px w-6 shrink-0', rule)} aria-hidden />
      {children}
    </span>
  );
}

/** Large faint serif numeral — the page's organising spine (01 / 02 / 03). */
export function SectionNumber({
  children,
  className,
  tone = 'deep',
}: {
  children: React.ReactNode;
  className?: string;
  tone?: 'deep' | 'light';
}) {
  return (
    <span
      className={cn(
        'block font-light font-serif text-5xl tabular-nums leading-none md:text-6xl',
        tone === 'light' ? 'text-white/25' : 'text-forest/20',
        className
      )}
    >
      {children}
    </span>
  );
}

/** Quiet "live" note — a small leaf dot + serif. No pulse. (Roman, not
 *  italic: the founder review flagged sprinkled italics as a template tell;
 *  italics are reserved for genuine document conventions like the letter's
 *  signature line.) */
export function StatusNote({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2.5 font-serif text-body text-sm',
        className
      )}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-leaf" aria-hidden />
      {children}
    </span>
  );
}
