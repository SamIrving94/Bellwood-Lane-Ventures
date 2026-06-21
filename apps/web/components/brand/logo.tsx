import Link from 'next/link';
import { cn } from '@repo/design-system/lib/utils';

/**
 * Bellwoods Lane brand marks.
 *
 * The kit ships a tiny terracotta script-B `Monogram` (extracted from the
 * master logo) and a typeset `Wordmark` (Fraunces, brick, wide-tracked) so the
 * brand reads crisply at any size — fixing the illegible shrunk-lockup problem.
 * `LogoLockup` is the nav/footer combination; `Seal` is the circular monogram
 * badge used as a trust motif on document-style cards.
 */

export function Monogram({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/monogram.svg"
      alt=""
      aria-hidden
      className={cn('h-8 w-auto', className)}
    />
  );
}

export function Wordmark({
  className,
  ventures = false,
}: {
  className?: string;
  /** Append "Ventures" — used at large sizes / footer, not in tight nav. */
  ventures?: boolean;
}) {
  return (
    <span
      className={cn(
        'font-serif font-medium uppercase leading-none tracking-[0.22em] text-brand-deep',
        className,
      )}
    >
      Bellwoods&nbsp;Lane
      {ventures ? (
        <span className="tracking-[0.22em] text-brand-deep/70">&nbsp;Ventures</span>
      ) : null}
    </span>
  );
}

/**
 * Nav/footer lockup: signature monogram + a hairline rule + the wordmark.
 * Sized via the wordmark text size; the monogram tracks it.
 */
export function LogoLockup({
  href = '/agents',
  className,
  wordmarkClassName,
  monogramClassName,
  ventures = false,
}: {
  href?: string;
  className?: string;
  wordmarkClassName?: string;
  monogramClassName?: string;
  ventures?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label="Bellwoods Lane Ventures — home"
      className={cn('group inline-flex items-center gap-3.5', className)}
    >
      <Monogram className={cn('h-9 w-auto md:h-10', monogramClassName)} />
      <span className="h-7 w-px bg-brand/40" aria-hidden />
      <Wordmark
        ventures={ventures}
        className={cn('text-[15px] md:text-base', wordmarkClassName)}
      />
    </Link>
  );
}

/**
 * Circular monogram seal — a thin double ring with the script-B inside.
 * Used as the "signed / certified" motif on offer documents and trust cards.
 */
export function Seal({
  label,
  className,
}: {
  /** Optional micro-label rendered along the bottom, e.g. "Bellwoods Lane". */
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'relative inline-flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-brand-deep/30',
        className,
      )}
    >
      <span className="absolute inset-1.5 rounded-full border border-brand-deep/15" />
      <Monogram className="h-6 w-auto" />
      {label ? (
        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-serif text-[9px] italic text-brand-deep/60">
          {label}
        </span>
      ) : null}
    </span>
  );
}
