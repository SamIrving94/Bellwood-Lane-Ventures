import type { ConsentTags } from '@/components/cookie-consent';
import { env } from '@/env';

/**
 * The tracking tags configured for this deploy ("" counts as unset). The
 * banner asks only about categories that have a tag, and the footer's
 * "Cookie settings" link appears only if at least one exists.
 */
export const consentTags = (): ConsentTags => ({
  gaId: env.NEXT_PUBLIC_GA_MEASUREMENT_ID || undefined,
  adsId: env.NEXT_PUBLIC_GOOGLE_ADS_ID || undefined,
  metaPixelId: env.NEXT_PUBLIC_META_PIXEL_ID || undefined,
});

export const hasConsentTags = () => Object.values(consentTags()).some(Boolean);
