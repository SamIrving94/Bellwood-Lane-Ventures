import type { ConsentTags } from '@/components/cookie-consent';
import { env } from '@/env';

/**
 * Kept's GA4 stream for the public site. Measurement IDs are public (they
 * ship in every page that loads GA), so it lives in code: the live site
 * gets analytics without a Vercel env step. It is used on the PRODUCTION
 * deploy only, so preview builds and local dev never add fake visits.
 * NEXT_PUBLIC_GA_MEASUREMENT_ID overrides it anywhere ("" switches GA off).
 */
const GA_ID_PRODUCTION = 'G-ME9L86HTLT';

/**
 * Kept's Google Tag Manager container, same rule as GA: public, production
 * only, NEXT_PUBLIC_GTM_ID overrides. GTM is for EXTRA tags — GA, Ads and
 * Meta are loaded directly (see the GTM note in cookie-consent.tsx).
 */
const GTM_ID_PRODUCTION = 'GTM-WNM6MJGZ';

const isProduction = () => env.VERCEL_ENV === 'production';

const gtmId = () =>
  env.NEXT_PUBLIC_GTM_ID ?? (isProduction() ? GTM_ID_PRODUCTION : undefined);

const gaId = () =>
  env.NEXT_PUBLIC_GA_MEASUREMENT_ID ??
  (isProduction() ? GA_ID_PRODUCTION : undefined);

/**
 * The tracking tags configured for this deploy ("" counts as unset). The
 * banner asks only about categories that have a tag, and the footer's
 * "Cookie settings" link appears only if at least one exists.
 */
export const consentTags = (): ConsentTags => ({
  gaId: gaId() || undefined,
  adsId: env.NEXT_PUBLIC_GOOGLE_ADS_ID || undefined,
  metaPixelId: env.NEXT_PUBLIC_META_PIXEL_ID || undefined,
  gtmId: gtmId() || undefined,
});

export const hasConsentTags = () => Object.values(consentTags()).some(Boolean);
