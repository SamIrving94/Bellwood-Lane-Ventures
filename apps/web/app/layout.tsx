import { CookieConsent } from '@/components/cookie-consent';
import { consentTags, hasConsentTags } from '@/lib/consent-tags';
import { fonts } from '@repo/design-system/lib/fonts';
import { cn } from '@repo/design-system/lib/utils';
import type { CSSProperties, ReactNode } from 'react';
import './[locale]/styles.css';

// Public-site type system. The design system maps `font-serif` → --font-fraunces
// and `font-sans` → --font-inter; we repoint those vars (here, on the public
// root only) to the editorial set so every existing font-serif/font-sans class
// switches without touching the authenticated dashboard. The offer document
// uses --font-courier directly via `[font-family:var(--font-courier)]`.
const publicType = {
  '--font-fraunces': 'var(--font-libre-caslon)',
  '--font-inter': 'var(--font-hanken)',
} as CSSProperties;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={cn(fonts, 'scroll-smooth')}
      style={publicType}
      suppressHydrationWarning
    >
      <body>
        {children}
        {/* Tags load only after a visitor accepts — see cookie-consent.tsx. */}
        {hasConsentTags() && <CookieConsent {...consentTags()} />}
      </body>
    </html>
  );
}
