import { brand } from '@repo/brand';
import { cn } from '@repo/design-system/lib/utils';
import Link from 'next/link';

/**
 * Kept. brand marks.
 *
 * The name is the promise: a price given is a price kept. The mark is the
 * lowercase word `kept` in a heavy editorial face, tight-tracked, followed by
 * a full stop — and **the full stop IS the logo**: it is always wax red, and
 * in animated contexts it "lands" (drops in and settles). `Monogram` is the
 * `k.` seal; `Seal` is the circular wax badge on document-style cards.
 *
 * Name is driven by `@repo/brand`: while `BRAND_PHASE` is `'legacy'` (the
 * production default, gated on the trademark search) these render the outgoing
 * "Bellwoods Lane" marks unchanged; once the phase flips they become Kept.
 * See docs/brand/KEPT.md for the rules.
 */

/**
 * The landing full stop — the logo. Always wax. In animated contexts it drops
 * in and settles once; the animation is gated behind `prefers-reduced-motion`
 * via Tailwind's `motion-safe:` variant (keyframe `kept-dot-land` lives in
 * apps/web/app/[locale]/styles.css).
 */
export function KeptDot({
  className,
  animate = false,
}: {
  className?: string;
  animate?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block text-wax',
        animate &&
          'motion-safe:animate-[kept-dot-land_0.8s_cubic-bezier(0.3,1.5,0.4,1)_both]',
        className
      )}
    >
      .
    </span>
  );
}

export function Monogram({ className }: { className?: string }) {
  if (brand.phase === 'legacy') {
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
  // Kept: the typographic `k.` monogram — the drawn dot is constant across the
  // two candidate wordmark faces (KEPT.md), so it lives in code, not an SVG.
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex items-baseline font-bold font-serif text-2xl text-forest lowercase leading-none tracking-[-0.03em]',
        className
      )}
    >
      k<KeptDot />
    </span>
  );
}

export function Wordmark({
  className,
  ventures = false,
  animate = false,
}: {
  className?: string;
  /** Append the legal suffix — used at large sizes / footer, not in tight nav. */
  ventures?: boolean;
  /** Let the full stop "land" on mount (nav mark, once per load). */
  animate?: boolean;
}) {
  if (brand.phase === 'legacy') {
    return (
      <span
        className={cn(
          'font-medium font-serif text-forest uppercase leading-none tracking-[0.22em]',
          className
        )}
      >
        Bellwoods&nbsp;Lane
        {ventures ? (
          <span className="text-forest/70 tracking-[0.22em]">
            &nbsp;Ventures
          </span>
        ) : null}
      </span>
    );
  }
  // Kept: lowercase heavy serif, tight tracking, the wax full stop as the logo.
  return (
    <span
      className={cn(
        'inline-flex items-baseline font-bold font-serif text-forest lowercase leading-none tracking-[-0.03em]',
        className
      )}
    >
      kept
      <KeptDot animate={animate} />
    </span>
  );
}

/**
 * Nav/footer lockup: the wordmark alone.
 *
 * It used to pair the monogram + a hairline + the wordmark, which put two
 * marks and two wax dots in the same corner — founder review (Aug 2026)
 * called it out, and KEPT.md agrees: the monogram is for seals, favicons
 * and watermarks, never for standing beside the wordmark. One mark, one
 * dot.
 */
export function LogoLockup({
  href = '/agents',
  className,
  wordmarkClassName,
  ventures = false,
  animate = false,
}: {
  href?: string;
  className?: string;
  wordmarkClassName?: string;
  ventures?: boolean;
  animate?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={`${brand.name}, home`}
      className={cn('group inline-flex items-center', className)}
    >
      <Wordmark
        ventures={ventures}
        animate={animate}
        className={cn('text-[19px] md:text-[21px]', wordmarkClassName)}
      />
    </Link>
  );
}

/**
 * Circular wax seal — a thin double ring with the `k.` monogram inside, the
 * "signed / certified" motif on offer documents and trust cards. In print this
 * becomes a wax seal; on screen the ring and monogram carry the wax accent.
 */
export function Seal({
  label,
  className,
}: {
  /** Optional micro-label rendered along the bottom, e.g. the brand name. */
  label?: string;
  className?: string;
}) {
  if (brand.phase === 'legacy') {
    return (
      <span
        className={cn(
          'relative inline-flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-forest/30',
          className
        )}
      >
        <span className="absolute inset-1.5 rounded-full border border-forest/15" />
        <Monogram className="h-6 w-auto" />
        {label ? (
          <span className="-bottom-5 -translate-x-1/2 absolute left-1/2 whitespace-nowrap font-serif text-[9px] text-forest/60 italic">
            {label}
          </span>
        ) : null}
      </span>
    );
  }
  return (
    <span
      className={cn(
        'relative inline-flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-wax/40',
        className
      )}
    >
      <span className="absolute inset-1.5 rounded-full border border-wax/20" />
      <span className="inline-flex items-baseline font-bold font-serif text-lg text-wax lowercase leading-none tracking-[-0.03em]">
        k<span aria-hidden>.</span>
      </span>
      {label ? (
        <span className="-bottom-5 -translate-x-1/2 absolute left-1/2 whitespace-nowrap font-serif text-[9px] text-forest/60 italic">
          {label}
        </span>
      ) : null}
    </span>
  );
}
