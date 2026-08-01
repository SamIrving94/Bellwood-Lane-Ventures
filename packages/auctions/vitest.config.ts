import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'node',
  },
  // The source adapters import 'server-only' to keep them out of any client
  // bundle. That package throws at import time under vitest; alias it to a
  // no-op stub so the production code loads as-is (same shape as the
  // @repo/instant-offer and @repo/scouting configs).
  resolve: {
    alias: {
      'server-only': new URL('./test-shims/server-only.ts', import.meta.url)
        .pathname,
    },
  },
});
