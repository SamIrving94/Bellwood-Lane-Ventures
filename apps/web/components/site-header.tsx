import { Button, LogoLockup } from '@/components/brand';
import Link from 'next/link';

/**
 * The shared site header — one shape for the whole public site (the UX
 * review found six). Logo always goes home; the nav is the same everywhere;
 * pages with a local sticky nav (/sell, /agents) keep theirs for anchor
 * links, everything else uses this. The mobile menu is a CSS-only
 * <details> so the header stays a server component.
 */

const NAV = [
  { href: '/sell', label: 'For sellers' },
  { href: '/probate', label: 'Probate guide' },
  { href: '/instant-offer/methodology', label: 'Methodology' },
  { href: '/agents', label: 'For agents' },
  { href: '/save-the-sale', label: 'Save a sale' },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-hair/70 border-b bg-cream/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5 md:px-10">
        <LogoLockup href="/" />
        <nav className="hidden items-center gap-7 text-[14px] text-stone-600 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-brand-deep"
            >
              {item.label}
            </Link>
          ))}
          <Button href="/sell#offer" className="px-5 py-2 text-sm">
            Get an offer
          </Button>
        </nav>
        {/* Mobile menu — CSS-only disclosure, no client JS */}
        <details className="group relative md:hidden">
          <summary
            className="flex cursor-pointer list-none flex-col justify-center gap-[5px] p-2 [&::-webkit-details-marker]:hidden"
            aria-label="Menu"
          >
            <span className="block h-px w-6 bg-forest" />
            <span className="block h-px w-6 bg-forest" />
            <span className="block h-px w-6 bg-forest" />
          </summary>
          <nav className="absolute right-0 z-50 mt-3 flex w-56 flex-col rounded-sm border border-hair bg-cream p-2 shadow-[0_24px_48px_-24px_rgba(36,28,26,0.4)]">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-sm px-4 py-3 text-[15px] text-forest hover:bg-soft"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/sell#offer"
              className="mt-1 rounded-full bg-leaf px-4 py-3 text-center font-semibold text-[15px] text-white"
            >
              Get an offer
            </Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
