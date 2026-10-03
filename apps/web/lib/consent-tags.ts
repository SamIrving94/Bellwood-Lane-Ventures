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

const gaId = () =>
  env.NEXT_PUBLIC_GA_MEASUREMENT_ID ??
  (env.VERCEL_ENV === 'production' ? GA_ID_PRODUCTION : undefined);

/**
 * The tracking tags configured for this deploy ("" counts as unset). The
 * banner asks only about categories that have a tag, and the footer's
 * "Cookie settings" link appears only if at least one exists.
 */
export const consentTags = (): ConsentTags => ({
  gaId: gaId() || undefined,
  adsId: env.NEXT_PUBLIC_GOOGLE_ADS_ID || undefined,
  metaPixelId: env.NEXT_PUBLIC_META_PIXEL_ID || undefined,
});

export const hasConsentTags = () => Object.values(consentTags()).some(Boolean);
