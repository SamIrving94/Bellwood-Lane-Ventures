import { cn } from '@repo/design-system/lib/utils';
import { GeistMono } from 'geist/font/mono';
import { Fraunces, Inter } from 'next/font/google';

// Bellwoods Lane Ventures type system:
//   Inter      — UI + body (clean, highly legible; the brand's working sans)
//   Fraunces   — display headings (warm editorial serif echoing the wordmark)
//   Geist Mono — tabular numerals / data
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

export const fonts = cn(
  inter.variable,
  fraunces.variable,
  GeistMono.variable,
  'touch-manipulation font-sans antialiased'
);
