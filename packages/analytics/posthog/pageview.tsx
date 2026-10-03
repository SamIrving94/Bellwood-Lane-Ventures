'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useTrack } from './client';

type PostHogPageViewProps = {
  /** Paths that get no page view at all — see `PostHogProvider.privatePath`. */
  readonly exclude?: (pathname: string) => boolean;
};

/**
 * Manual `$pageview`. The provider sets `capture_pageview: false` because App
 * Router navigations never reload the document, so PostHog's own load-time
 * pageview would fire once per visit and miss every page after the first.
 * The full URL goes with it so UTM tags on an ad click survive into the
 * event. Mount inside <Suspense>: `useSearchParams` opts the nearest boundary
 * into client rendering.
 */
export const PostHogPageView = ({ exclude }: PostHogPageViewProps = {}) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const track = useTrack();

  useEffect(() => {
    if (!pathname || exclude?.(pathname)) {
      return;
    }
    const search = searchParams?.toString();
    track('$pageview', {
      $current_url: `${window.location.origin}${pathname}${search ? `?${search}` : ''}`,
    });
  }, [pathname, searchParams, track, exclude]);

  return null;
};
