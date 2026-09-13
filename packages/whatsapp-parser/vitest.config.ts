import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
    environment: 'node',
  },
  // @repo/ai/claude imports 'server-only', which throws at import time under
  // vitest; alias it to a no-op stub (same shape as the other packages).
  resolve: {
    alias: {
      'server-only': new URL('./test-shims/server-only.ts', import.meta.url)
        .pathname,
    },
  },
});
