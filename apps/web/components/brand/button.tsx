import { cn } from '@repo/design-system/lib/utils';
import Link from 'next/link';

/**
 * Kept. action — leaf-green pill (KEPT.md: leaf is interactive ONLY).
 *  - primary   : solid leaf pill, white text, arrow nudges on hover
 *  - secondary : outlined leaf pill — the considered second action
 *  - accent    : solid WAX pill — reserved. Only on forest poster/finale
 *                grounds (the two-accent rule; see the Buttons design card).
 *  - ghost     : leaf text link, underline on hover, → nudge
 *
 * Pure CSS hover (server-safe). Renders an <a>/<Link> when `href` is set,
 * otherwise a <button>. Geometry + weights follow the Kept. Buttons card.
 */

type Variant = 'primary' | 'secondary' | 'accent' | 'ghost';

type CommonProps = {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  /** Show the trailing arrow. Default true. */
  arrow?: boolean;
};

const SHELL =
  'group inline-flex items-center gap-2.5 text-[15px] font-semibold transition-colors';

const VARIANTS: Record<Variant, string> = {
  primary:
    'rounded-full bg-leaf px-8 py-3.5 text-white shadow-sm hover:bg-leaf-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf focus-visible:ring-offset-2 focus-visible:ring-offset-cream',
  secondary:
    'rounded-full border-[1.5px] border-leaf bg-transparent px-8 py-3.5 text-leaf hover:bg-leaf/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf focus-visible:ring-offset-2 focus-visible:ring-offset-cream',
  accent:
    'rounded-full bg-wax px-8 py-3.5 text-white shadow-sm hover:bg-wax/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-forest',
  ghost: 'text-leaf underline-offset-[6px] decoration-leaf/50 hover:underline',
};

function Arrow() {
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
      {arrow ? <Arrow /> : null}
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
