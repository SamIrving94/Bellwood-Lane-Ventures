import { cn } from '@repo/design-system/lib/utils';
import { GeistMono } from 'geist/font/mono';
import {
  Courier_Prime,
  Fraunces,
  Hanken_Grotesk,
  Inter,
  Libre_Caslon_Text,
} from 'next/font/google';

// Bellwoods Lane type system.
//
// The authenticated dashboard (apps/app) keeps Inter + Fraunces + Geist Mono —
// a clean working set for dense data UI.
//
// The PUBLIC site (apps/web) overrides --font-inter / --font-fraunces at its
// own root (see apps/web/app/layout.tsx) to a deliberately non-default,
// human-editorial set, because "Inter for everything + a trendy serif" is the
// exact signature that reads as AI-generated:
//   Libre Caslon Text — display (English, legal, established; not the
//                        startup-default serif)
//   Hanken Grotesk    — body / UI (warm grotesk, not Inter)
//   Courier Prime     — the offer document + numerals (a real typed letter)
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const libreCaslon = Libre_Caslon_Text({
  subsets: ['latin'],
  variable: '--font-libre-caslon',
  display: 'swap',
  weight: ['400', '700'],
  style: ['normal', 'italic'],
});

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-hanken',
  display: 'swap',
});

const courierPrime = Courier_Prime({
  subsets: ['latin'],
  variable: '--font-courier',
  display: 'swap',
  weight: ['400', '700'],
});

export const fonts = cn(
  inter.variable,
  fraunces.variable,
  libreCaslon.variable,
  hanken.variable,
  courierPrime.variable,
  GeistMono.variable,
  'touch-manipulation font-sans antialiased'
);
