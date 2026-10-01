import { LogoLockup, Seal } from '@/components/brand';
import { CookieSettingsButton } from '@/components/cookie-consent';
import { env } from '@/env';
import { SITE_MAP } from '@/lib/site-map';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * The shared site footer — the footer half of what SiteHeader did for the
 * top of the page. Every public page renders this one, so the whole IA
 * (lib/site-map.ts), the privacy notice and the cookie choice are one click
 * from anywhere. Visual base is the signed-off /sell footer (seal, lockup,
 * no "Est." strapline).
 *
 * "Cookie settings" only appears when GA is configured: with no measurement
 * ID there is no banner to reopen, and a dead button is worse than none.
 */
export function SiteFooter({
  disclaimer,
}: {
  /** Override the standard legal line where a page needs more (e.g. debt). */
  readonly disclaimer?: ReactNode;
}) {
  return (
    <footer className="border-hair border-t bg-cream px-6 py-14 md:px-10 md:pt-[60px] md:pb-[52px]">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[1.2fr_repeat(4,1fr)]">
          <div className="col-span-2 flex items-start gap-5 md:col-span-1">
            <Seal className="shrink-0" />
            <div>
              <LogoLockup href="/sell" wordmarkClassName="text-base" />
              <p className="mt-2 font-serif text-sm text-stone-500">
                Direct-to-vendor property buyers &middot; UK
              </p>
            </div>
          </div>

          {SITE_MAP.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <p className="font-serif text-[13px] text-leaf">{group.title}</p>
              <ul className="mt-3 space-y-2 text-sm text-stone-600">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="hover:text-brand-deep">
                      {link.label}
                    </Link>
                  </li>
                ))}
                {group.title === 'Legal' &&
                  env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
                    <li>
                      <CookieSettingsButton
                        label="Cookie settings"
                        className="text-left hover:text-brand-deep"
                      />
                    </li>
                  )}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-11 border-hair border-t pt-6">
          <p className="font-serif text-[12px] text-stone-500">
            Property Redress Scheme (PRS) &middot; HMRC AML supervised &middot;
            ICO registered
          </p>
          <p className="mt-4 max-w-[96ch] text-[11px] text-stone-500 leading-[1.7]">
            {disclaimer ??
              'Kept is a UK cash property buyer, not an FCA-authorised firm. We do not provide financial or legal advice. Seek independent legal advice before accepting any offer. All offers are subject to satisfactory survey and title searches.'}
          </p>
          <p className="mt-4 text-[11px] text-stone-400">
            © {new Date().getFullYear()} Kept.
          </p>
        </div>
      </div>
    </footer>
  );
}
