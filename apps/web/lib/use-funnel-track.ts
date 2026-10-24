'use client';

import { sendTagEvent } from '@/components/cookie-consent';
import { useTrack } from '@repo/analytics/posthog/client';
import { useCallback } from 'react';

/**
 * PostHog's `track`, plus the same event to the ad and analytics tags the
 * visitor allowed (sendTagEvent: GTM, GA/Ads, Meta). One call, so the two
 * never drift: the event names the ad manager builds conversions on are the
 * ones in our PostHog funnels. Same rule as PostHog: never a name, contact
 * detail or street address in the properties.
 */
export const useFunnelTrack = () => {
  const track = useTrack();
  return useCallback(
    (
      event: string,
      properties?: Record<string, string | number | boolean | undefined>
    ) => {
      track(event, properties);
      sendTagEvent(event, properties);
    },
    [track]
  );
};
