'use client';

import posthog, { type PostHog } from 'posthog-js';
import { PostHogProvider as PostHogProviderRaw, usePostHog } from 'posthog-js/react';
import type { ReactNode } from 'react';
import { useCallback, useEffect } from 'react';
import { keys } from '../keys';

type PostHogProviderProps = {
  readonly children: ReactNode;
  /**
   * Store nothing on the visitor's device. The public site's privacy notice
   * keeps PostHog in its "always on" tier, outside the cookie banner, on the
   * strength of this: visitor id in memory only (gone on reload), no
   * autocapture, no session recording, IP not recorded. The cost is that a
   * visitor who returns tomorrow is a new visitor; the funnel we care about
   * (land on /sell, start the form, send it) happens in one sitting. The
   * dashboard leaves this off: signed-in founders are not that audience.
   */
  readonly cookieless?: boolean;
  /**
   * Paths whose URL is itself private — a deal token, an offer id, an
   * address in the query string. Every PostHog event carries the current
   * URL and referrer by default, so on these paths the URL properties are
   * cut back to the first segment (`/track/[private]`) before anything
   * leaves the browser. Pair with `PostHogPageView`'s `exclude` so no page
   * view is sent from them at all.
   */
  readonly privatePath?: (pathname: string) => boolean;
};

/** Event properties posthog-js fills with a URL or path on its own. */
const URL_PROPERTY_KEYS = [
  '$current_url',
  '$pathname',
  '$referrer',
  '$initial_current_url',
  '$initial_pathname',
  '$initial_referrer',
] as const;

const redactUrl = (
  value: string,
  isPrivate: (pathname: string) => boolean
): string => {
  let url: URL;
  try {
    url = new URL(value, 'http://placeholder.invalid');
  } catch {
    return value;
  }
  if (!isPrivate(url.pathname)) {
    return value;
  }
  const first = url.pathname.split('/').filter(Boolean)[0] ?? '';
  const stub = `/${first}/[private]`;
  return value.startsWith('/') ? stub : `${url.origin}${stub}`;
};

const redactPrivateUrls = (
  properties: Record<string, unknown>,
  isPrivate: (pathname: string) => boolean
): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...properties };
  for (const key of URL_PROPERTY_KEYS) {
    const v = out[key];
    if (typeof v === 'string') {
      out[key] = redactUrl(v, isPrivate);
    }
  }
  // Person properties ride along on events as $set / $set_once.
  for (const bag of ['$set', '$set_once'] as const) {
    const inner = out[bag];
    if (inner && typeof inner === 'object') {
      out[bag] = redactPrivateUrls(inner as Record<string, unknown>, isPrivate);
    }
  }
  return out;
};

export const PostHogProvider = ({
  children,
  cookieless = false,
  privatePath,
}: PostHogProviderProps) => {
  const posthogKey = keys().NEXT_PUBLIC_POSTHOG_KEY;

  useEffect(() => {
    if (posthogKey) {
      posthog.init(posthogKey, {
        api_host: '/ingest',
        ui_host: keys().NEXT_PUBLIC_POSTHOG_HOST,
        person_profiles: 'identified_only',
        capture_pageview: false,
        capture_pageleave: true,
        ...(cookieless
          ? {
              persistence: 'memory',
              autocapture: false,
              disable_session_recording: true,
              ip: false,
            }
          : {}),
        ...(privatePath
          ? {
              sanitize_properties: (properties: Record<string, unknown>) =>
                redactPrivateUrls(properties, privatePath),
            }
          : {}),
      }) as PostHog;
    }
  }, [posthogKey, cookieless, privatePath]);

  if (!posthogKey) {
    return <>{children}</>;
  }

  return <PostHogProviderRaw client={posthog}>{children}</PostHogProviderRaw>;
};

export { usePostHog as useAnalytics } from 'posthog-js/react';

/**
 * `capture` that is a no-op when PostHog is not configured. Without the key
 * the provider above never calls `init`, and capturing on the uninitialised
 * singleton logs an error on every call — local dev would be nothing but
 * that. Callers pass only non-identifying properties: never a name, email,
 * phone or street address.
 */
export const useTrack = () => {
  const client = usePostHog();
  const enabled = Boolean(keys().NEXT_PUBLIC_POSTHOG_KEY);
  return useCallback(
    (event: string, properties?: Record<string, unknown>) => {
      if (enabled) {
        client?.capture(event, properties);
      }
    },
    [client, enabled]
  );
};
