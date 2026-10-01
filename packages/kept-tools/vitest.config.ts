import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'node',
  },
  // property-data imports 'server-only', which throws outside a Next.js
  // react-server bundle. Same shim pattern as @repo/valuation.
  resolve: {
    alias: {
      'server-only': new URL('./test-shims/server-only.ts', import.meta.url)
        .pathname,
    },
  },
});
