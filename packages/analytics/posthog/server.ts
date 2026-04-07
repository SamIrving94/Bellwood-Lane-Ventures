import 'server-only';
import { PostHog } from 'posthog-node';
import { keys } from '../keys';

const posthogKey = keys().NEXT_PUBLIC_POSTHOG_KEY;

const noop = () => {};
const noopAsync = () => Promise.resolve();
const noopAnalytics = {
  capture: noop,
  identify: noop,
  groupIdentify: noop,
  isFeatureEnabled: () => Promise.resolve(false),
  shutdown: noopAsync,
} as unknown as PostHog;

export const analytics: PostHog = posthogKey
  ? new PostHog(posthogKey, {
      host: keys().NEXT_PUBLIC_POSTHOG_HOST,
      // Don't batch events and flush immediately - we're running in a serverless environment
      flushAt: 1,
      flushInterval: 0,
    })
  : noopAnalytics;
