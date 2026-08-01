import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'node',
    // A dummy key so fetchPropertyData takes the live path in tests (network is
    // stubbed). Must be present at import time, hence set here not in the test.
    env: {
      PROPERTYDATA_API_KEY: 'test-key',
    },
  },
  // propertydata.ts imports 'server-only' to keep it off the client bundle; that
  // package throws at import time under vitest. Alias it to a no-op stub so the
  // client's internals (fetchPropertyData, the cache tiers) are testable.
  resolve: {
    alias: {
      'server-only': new URL(
        './test-shims/server-only.ts',
        import.meta.url
      ).pathname,
    },
  },
});
