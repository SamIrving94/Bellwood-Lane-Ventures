'use client';

import posthog, { type CaptureResult, type PostHog } from 'posthog-js';
import { PostHogProvider as PostHogProviderRaw, usePostHog } from 'posthog-js/react';
import type { ReactNode } from 'react';
import { useCallback, useEffect } from 'react';
import { keys } from '../keys';
import { type IsPrivatePath, redactPrivateUrls } from './redact';

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
   * leaves the browser (see ./redact.ts). Pair with `PostHogPageView`'s
   * `exclude` so no page view is sent from them at all.
   */
  readonly privatePath?: IsPrivatePath;
};

/** `before_send` hook: redact URL-bearing properties on every event. */
const redactEvent =
  (isPrivate: IsPrivatePath) =>
  (event: CaptureResult | null): CaptureResult | null => {
    if (!event) {
      return event;
    }
    return {
      ...event,
      properties: redactPrivateUrls(event.properties ?? {}, isPrivate),
      ...(event.$set ? { $set: redactPrivateUrls(event.$set, isPrivate) } : {}),
      ...(event.$set_once
        ? { $set_once: redactPrivateUrls(event.$set_once, isPrivate) }
        : {}),
    };
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
        ...(privatePath ? { before_send: redactEvent(privatePath) } : {}),
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
