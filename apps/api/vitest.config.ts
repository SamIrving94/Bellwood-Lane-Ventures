import sharedConfig from '@repo/testing';
import { mergeConfig } from 'vitest/config';

// `server-only` throws at import time outside a React server build. Cron libs
// pull in @repo/property-data (which imports it), so alias it to the no-op
// stub that package's own tests use.
export default mergeConfig(sharedConfig, {
  resolve: {
    alias: {
      'server-only': new URL(
        '../../packages/property-data/test-shims/server-only.ts',
        import.meta.url
      ).pathname,
    },
  },
});
