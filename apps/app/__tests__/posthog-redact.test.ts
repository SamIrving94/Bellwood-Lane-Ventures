import { redactPrivateUrls, redactUrl } from '@repo/analytics/posthog/redact';
import { describe, expect, it } from 'vitest';

/**
 * The public site's private URL list (PRIVATE_PATHS in
 * apps/web/components/cookie-consent.tsx), mirrored here so the test does not
 * import a 'use client' component. If the shape of that list changes, this
 * stays a faithful stand-in: prefix match on the first segment.
 */
const PRIVATE = ['/track', '/viewing', '/investors', '/save-the-sale'];
const isPrivate = (p: string) =>
  PRIVATE.some((x) => p === x || p.startsWith(`${x}/`));

describe('PostHog private-URL redaction', () => {
  it('cuts a private URL back to its first segment and drops the query', () => {
    expect(
      redactUrl('https://wearekept.co.uk/track/tok_abc123?utm_source=x', isPrivate)
    ).toBe('https://wearekept.co.uk/track/[private]');
    expect(
      redactUrl('/save-the-sale?address=12+Acacia+Avenue', isPrivate)
    ).toBe('/save-the-sale/[private]');
  });

  it('leaves public URLs, including their UTM tags, untouched', () => {
    const u = 'https://wearekept.co.uk/sell?utm_source=google&utm_campaign=probate';
    expect(redactUrl(u, isPrivate)).toBe(u);
    expect(redactUrl('/probate', isPrivate)).toBe('/probate');
  });

  it('does not match a public path that merely starts with the same letters', () => {
    expect(redactUrl('/tracking-policy', isPrivate)).toBe('/tracking-policy');
  });

  it('redacts every URL-bearing property, including $set_once', () => {
    const out = redactPrivateUrls(
      {
        event: 'x',
        $current_url: 'https://h/viewing/tok1',
        $pathname: '/viewing/tok1',
        $referrer: 'https://h/track/tok2',
        step: 'contact',
        $set_once: { $initial_current_url: 'https://h/investors/tok3' },
      },
      isPrivate
    );
    expect(out).toEqual({
      event: 'x',
      $current_url: 'https://h/viewing/[private]',
      $pathname: '/viewing/[private]',
      $referrer: 'https://h/track/[private]',
      step: 'contact',
      $set_once: { $initial_current_url: 'https://h/investors/[private]' },
    });
  });
});
