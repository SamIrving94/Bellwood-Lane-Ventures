import { cn } from '@repo/design-system/lib/utils';

/**
 * Consistent section rhythm — generous editorial padding, warm surfaces,
 * hairline dividers. Replaces ad-hoc per-page `px-6 py-24` wrappers.
 */

type Bg = 'porcelain' | 'white' | 'sand' | 'brick';
type Width = '3xl' | '4xl' | '5xl' | '6xl';

// Kept grounds. Prop keys kept stable so existing call sites don't break;
// values remapped to Kept tokens (KEPT.md): cream page ground, soft tinted
// sections, forest dark band. `brick` is now the forest ink ground.
const BG: Record<Bg, string> = {
  porcelain: 'bg-cream text-forest',
  white: 'bg-card text-forest',
  sand: 'bg-soft text-forest',
  brick: 'bg-forest text-white',
};

const MAX: Record<Width, string> = {
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
};

export function Section({
  children,
  id,
  className,
  innerClassName,
  bg = 'porcelain',
  width = '6xl',
  divider = false,
}: {
  children: React.ReactNode;
  id?: string;
  className?: string;
  innerClassName?: string;
  bg?: Bg;
  width?: Width;
  /** Add a hairline top+bottom divider. */
  divider?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        'px-6 py-24 md:px-12 md:py-28',
        BG[bg],
        divider && 'border-y border-hair/70',
        className,
      )}
    >
      <div className={cn('mx-auto', MAX[width], innerClassName)}>{children}</div>
    </section>
  );
}
