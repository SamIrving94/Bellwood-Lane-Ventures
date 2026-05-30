import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'node',
  },
  // The valuation source files import 'server-only' to prevent accidental
  // client-bundle inclusion in Next.js. That package's default export throws
  // at import time — fine in production (Next.js applies the `react-server`
  // condition which resolves to a no-op), but it breaks vitest. Alias the
  // module to an empty stub so the tests can load the production code as-is.
  resolve: {
    alias: {
      'server-only': new URL('./test-shims/server-only.ts', import.meta.url).pathname,
    },
  },
});
