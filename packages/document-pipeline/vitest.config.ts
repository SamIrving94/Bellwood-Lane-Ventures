import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'node',
  },
  // The source imports 'server-only', whose default export throws at import
  // time outside a React Server Component context. Alias it to a stub so the
  // production code can be loaded as-is (same approach as packages/valuation).
  resolve: {
    alias: {
      'server-only': new URL('./test-shims/server-only.ts', import.meta.url)
        .pathname,
    },
  },
});
