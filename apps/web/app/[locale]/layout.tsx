import type { ReactNode } from 'react';

// Minimal locale layout. The only [locale] route remaining is (home),
// which immediately redirects to /instant-offer. We've cut the
// next-forge marketing chrome (Header / Footer / CMSToolbar) to keep
// the lambda bundle under Vercel's 262MB limit.
export default function LocaleLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
