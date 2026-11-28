import {
  CookieConsent,
  isPrivatePath,
  noPostHogPageView,
} from '@/components/cookie-consent';
import { LeadSourceCapture } from '@/components/lead-source-capture';
import { consentTags, hasConsentTags } from '@/lib/consent-tags';
import { PostHogProvider } from '@repo/analytics/posthog/client';
import { PostHogPageView } from '@repo/analytics/posthog/pageview';
import { fonts } from '@repo/design-system/lib/fonts';
import { cn } from '@repo/design-system/lib/utils';
import type { CSSProperties, ReactNode } from 'react';
import { Suspense } from 'react';
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
        {/* PostHog runs in the "always on" tier of the privacy notice because
            it stores nothing on the device: memory-only id, no cookie, IP not
            recorded, no autocapture. It is deliberately NOT behind the cookie
            banner — the banner gates tools that set cookies. The same private
            URL list that mutes Google (PRIVATE_PATHS in cookie-consent.tsx)
            redacts token-bearing URLs before PostHog sees them, and no page
            view is sent from those pages at all. Change one, change the other.
            /journey/* is the hidden stand-in frame for the ad tags, not a
            page anyone sees, so it sends no page view either. */}
        <PostHogProvider cookieless privatePath={isPrivatePath}>
          <Suspense fallback={null}>
            <PostHogPageView exclude={noPostHogPageView} />
          </Suspense>
          {children}
        </PostHogProvider>
        {/* Notes which advert, search or site began this visit, in memory
            only, so a form sent later can say so. See lib/lead-source.ts. */}
        <LeadSourceCapture />
        {/* Tags load only after a visitor accepts — see cookie-consent.tsx. */}
        {hasConsentTags() && <CookieConsent {...consentTags()} />}
      </body>
    </html>
  );
}
