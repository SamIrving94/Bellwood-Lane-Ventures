/**
 * URL redaction for PostHog events. Pure, no browser or posthog-js import,
 * so it can be unit-tested from any workspace with a vitest config.
 *
 * posthog-js stamps every event with the current URL, path and referrer. On
 * a site where some URLs are themselves secrets (a deal-timeline token, an
 * offer id, an address in the query string) that would ship the secret to a
 * third party on every click. `redactPrivateUrls` runs as PostHog's
 * `sanitize_properties` hook and cuts such URLs back to their first segment.
 */

/** Event properties posthog-js fills with a URL or path on its own. */
export const URL_PROPERTY_KEYS = [
  '$current_url',
  '$pathname',
  '$referrer',
  '$initial_current_url',
  '$initial_pathname',
  '$initial_referrer',
] as const;

export type IsPrivatePath = (pathname: string) => boolean;

/**
 * `/track/abc123?x=1` → `/track/[private]`;
 * `https://h/track/abc123` → `https://h/track/[private]`.
 * Anything that is not a private path, or not parseable, passes through.
 */
export const redactUrl = (value: string, isPrivate: IsPrivatePath): string => {
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

export const redactPrivateUrls = (
  properties: Record<string, unknown>,
  isPrivate: IsPrivatePath
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
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      out[bag] = redactPrivateUrls(inner as Record<string, unknown>, isPrivate);
    }
  }
  return out;
};
