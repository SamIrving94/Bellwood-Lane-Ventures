import { cn } from '@repo/design-system/lib/utils';

/**
 * Editorial label system — the de-genericiser.
 *
 * Replaces the old monospace UPPERCASE letter-spaced "eyebrows" (the classic
 * AI-landing-page tell) with a warm Fraunces-italic kicker preceded by a short
 * terracotta rule, plus large faint serif section numerals and a quiet status
 * note (no pulsing dots).
 */

export function Eyebrow({
  children,
  className,
  /** 'accent' = terracotta (default), 'muted' = warm grey, 'light' = on dark. */
  tone = 'accent',
}: {
  children: React.ReactNode;
  className?: string;
  tone?: 'accent' | 'muted' | 'light';
}) {
  const text =
    tone === 'light'
      ? 'text-white/80'
      : tone === 'muted'
        ? 'text-stone-500'
        : 'text-brand';
  const rule =
    tone === 'light' ? 'bg-white/40' : tone === 'muted' ? 'bg-stone-400' : 'bg-brand';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-3 font-serif text-[15px] italic',
        text,
        className,
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
        'block font-serif text-5xl font-light leading-none tabular-nums md:text-6xl',
        tone === 'light' ? 'text-white/25' : 'text-brand-deep/25',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Quiet "live" note — a small terracotta dot + italic serif. No pulse. */
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
        'inline-flex items-center gap-2.5 font-serif text-sm italic text-stone-600',
        className,
      )}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
      {children}
    </span>
  );
}
