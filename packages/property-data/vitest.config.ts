import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'node',
  },
  // Some source files import 'server-only' to keep them off the client bundle.
  // That package throws at import time under vitest; alias it to a no-op stub so
  // production code loads as-is. (The cache tests import './cache' directly,
  // which is pure, but the alias keeps the door open for testing other modules.)
  resolve: {
    alias: {
      'server-only': new URL(
        './test-shims/server-only.ts',
        import.meta.url
      ).pathname,
    },
  },
});
