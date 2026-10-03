import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': new URL('./', import.meta.url).pathname,
      // property-data and database import 'server-only', which throws
      // outside a Next.js react-server bundle.
      'server-only': new URL('./test-shims/server-only.ts', import.meta.url)
        .pathname,
    },
  },
});
