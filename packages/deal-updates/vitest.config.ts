import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'node',
  },
  // 'server-only' throws outside a Next.js react-server bundle; same shim
  // pattern as @repo/valuation.
  resolve: {
    alias: {
      'server-only': new URL('./test-shims/server-only.ts', import.meta.url)
        .pathname,
    },
  },
});
