import Link from 'next/link';
import { cn } from '@repo/design-system/lib/utils';

/**
 * Refined squared button — retires the candy `rounded-full` pill.
 *  - primary: solid brick, gently squared, arrow nudges on hover
 *  - accent : solid terracotta (reserve for the single key action)
 *  - ghost  : text only, underline on hover, ↗ — the considered secondary
 *
 * Pure CSS hover (server-safe). Renders an <a>/<Link> when `href` is set,
 * otherwise a <button>.
 */

type Variant = 'primary' | 'accent' | 'ghost';

type CommonProps = {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  /** Show the trailing arrow. Default true. */
  arrow?: boolean;
};

const SHELL =
  'group inline-flex items-center gap-2.5 text-[15px] font-medium transition-colors';

const VARIANTS: Record<Variant, string> = {
  primary:
    'rounded-md bg-brand-deep px-7 py-3.5 text-white shadow-sm hover:bg-[#743a3a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF8F5]',
  accent:
    'rounded-md bg-brand px-7 py-3.5 text-[#2B1A18] shadow-sm hover:bg-[#cf5050] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-deep focus-visible:ring-offset-2',
  ghost:
    'text-brand-deep underline-offset-[6px] decoration-brand/50 hover:underline',
};

function Arrow({ variant }: { variant: Variant }) {
  // Ghost reads as a link → diagonal ↗; filled buttons → forward → with nudge.
  if (variant === 'ghost') {
    return (
      <span
        aria-hidden
        className="transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-px"
      >
        ↗
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="transition-transform duration-200 group-hover:translate-x-1"
    >
      →
    </span>
  );
}

export function Button({
  href,
  children,
  variant = 'primary',
  className,
  arrow = true,
  ...rest
}: CommonProps & {
  href?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const classes = cn(SHELL, VARIANTS[variant], className);
  const inner = (
    <>
      {children}
      {arrow ? <Arrow variant={variant} /> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {inner}
      </Link>
    );
  }
  return (
    <button className={classes} {...rest}>
      {inner}
    </button>
  );
}
