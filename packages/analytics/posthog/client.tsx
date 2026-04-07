'use client';

import posthog, { type PostHog } from 'posthog-js';
import { PostHogProvider as PostHogProviderRaw } from 'posthog-js/react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { keys } from '../keys';

type PostHogProviderProps = {
  readonly children: ReactNode;
};

export const PostHogProvider = (
  properties: Omit<PostHogProviderProps, 'client'>
) => {
  const posthogKey = keys().NEXT_PUBLIC_POSTHOG_KEY;

  useEffect(() => {
    if (posthogKey) {
      posthog.init(posthogKey, {
        api_host: '/ingest',
        ui_host: keys().NEXT_PUBLIC_POSTHOG_HOST,
        person_profiles: 'identified_only',
        capture_pageview: false,
        capture_pageleave: true,
      }) as PostHog;
    }
  }, [posthogKey]);

  if (!posthogKey) {
    return <>{properties.children}</>;
  }

  return <PostHogProviderRaw client={posthog} {...properties} />;
};

export { usePostHog as useAnalytics } from 'posthog-js/react';
