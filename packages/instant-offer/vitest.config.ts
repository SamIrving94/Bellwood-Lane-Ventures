import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'node',
  },
  // src/index.ts imports 'server-only' to keep it out of any client bundle.
  // That package's default export throws at import time — fine in production
  // (Next.js applies the `react-server` condition, which resolves to a no-op),
  // but it breaks vitest. Alias it to an empty stub, the same way
  // packages/valuation does, so the tests load the production code as-is.
  resolve: {
    alias: {
      'server-only': new URL('./test-shims/server-only.ts', import.meta.url).pathname,
    },
  },
});
