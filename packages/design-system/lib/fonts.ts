import { cn } from '@repo/design-system/lib/utils';
import { GeistMono } from 'geist/font/mono';
import localFont from 'next/font/local';

// Bellwoods Lane type system.
//
// SELF-HOSTED, deliberately. These were `next/font/google` until Aug 2026,
// when a Vercel build failed with `Failed to fetch font file from
// https://fonts.gstatic.com/...` and took the whole marketing site's
// deployment down with it. `next/font/google` downloads at BUILD time and
// treats a failed fetch as fatal, so a Google hiccup became our outage — and
// the pre-push `preflight` hook could not catch it, because the machine
// running the hook already had the fonts cached. Every face here is now a
// file in this repo. Builds no longer touch the network for type.
//
// The woff2 files are the `latin` subset only. `next/font/local` has no
// unicode-range support, so shipping latin + latin-ext for the same
// weight/style would be ambiguous. Latin covers English plus the common
// Western European accents; Central/Eastern European glyphs fall back to a
// system face, which is the right trade for a UK site.
//
// All five families are open licence (SIL OFL), so self-hosting carries no
// licensing cost or obligation beyond retaining the licence.
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
//   Hanken Grotesk    — body / UI (KEPT.md's sanctioned swap, Aug 2026:
//                        warmer and more drawn than Roboto, which read as
//                        default/template)
//   Courier Prime     — the offer document + numerals (a real typed letter)

const inter = localFont({
  variable: '--font-inter',
  display: 'swap',
  src: [
    { path: './fonts/inter-400-latin.woff2', weight: '400', style: 'normal' },
    { path: './fonts/inter-500-latin.woff2', weight: '500', style: 'normal' },
    { path: './fonts/inter-600-latin.woff2', weight: '600', style: 'normal' },
    { path: './fonts/inter-700-latin.woff2', weight: '700', style: 'normal' },
  ],
});

const fraunces = localFont({
  variable: '--font-fraunces',
  display: 'swap',
  src: [
    { path: './fonts/fraunces-400-latin.woff2', weight: '400', style: 'normal' },
    { path: './fonts/fraunces-500-latin.woff2', weight: '500', style: 'normal' },
    { path: './fonts/fraunces-600-latin.woff2', weight: '600', style: 'normal' },
    { path: './fonts/fraunces-700-latin.woff2', weight: '700', style: 'normal' },
  ],
});

const libreCaslon = localFont({
  variable: '--font-libre-caslon',
  display: 'swap',
  src: [
    {
      path: './fonts/libre-caslon-400-latin.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/libre-caslon-400-italic-latin.woff2',
      weight: '400',
      style: 'italic',
    },
    {
      path: './fonts/libre-caslon-700-latin.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
});

const hanken = localFont({
  variable: '--font-hanken',
  display: 'swap',
  src: [
    { path: './fonts/hanken-400-latin.woff2', weight: '400', style: 'normal' },
    { path: './fonts/hanken-500-latin.woff2', weight: '500', style: 'normal' },
    { path: './fonts/hanken-600-latin.woff2', weight: '600', style: 'normal' },
    { path: './fonts/hanken-700-latin.woff2', weight: '700', style: 'normal' },
  ],
});

const courierPrime = localFont({
  variable: '--font-courier',
  display: 'swap',
  src: [
    {
      path: './fonts/courier-prime-400-latin.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/courier-prime-400-italic-latin.woff2',
      weight: '400',
      style: 'italic',
    },
    {
      path: './fonts/courier-prime-700-latin.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: './fonts/courier-prime-700-italic-latin.woff2',
      weight: '700',
      style: 'italic',
    },
  ],
});

/**
 * Fraunces and Inter bound to `--font-serif` / `--font-sans`.
 *
 * Several apps/web surfaces are standalone document layouts that set their own
 * serif/sans vars rather than inheriting the public root's editorial mapping
 * (instant-offer, partners, portal, save-the-sale, why-we-wont-buy-any-home).
 * They each used to call `next/font/google` themselves; they now share these,
 * so there is exactly one place that knows where a font file lives.
 */
export const serifDocFont = localFont({
  variable: '--font-serif',
  display: 'swap',
  src: [
    { path: './fonts/fraunces-400-latin.woff2', weight: '400', style: 'normal' },
    { path: './fonts/fraunces-500-latin.woff2', weight: '500', style: 'normal' },
    { path: './fonts/fraunces-600-latin.woff2', weight: '600', style: 'normal' },
    { path: './fonts/fraunces-700-latin.woff2', weight: '700', style: 'normal' },
  ],
});

export const sansDocFont = localFont({
  variable: '--font-sans',
  display: 'swap',
  src: [
    { path: './fonts/inter-400-latin.woff2', weight: '400', style: 'normal' },
    { path: './fonts/inter-500-latin.woff2', weight: '500', style: 'normal' },
    { path: './fonts/inter-600-latin.woff2', weight: '600', style: 'normal' },
    { path: './fonts/inter-700-latin.woff2', weight: '700', style: 'normal' },
  ],
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
