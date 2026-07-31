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
      // deep-appraisal.ts imports these at module top. AVM tests don't
      // exercise the LLM path; alias to a no-op stub.
      '@ai-sdk/anthropic': new URL('./test-shims/ai-sdk-stub.ts', import.meta.url).pathname,
      ai: new URL('./test-shims/ai-sdk-stub.ts', import.meta.url).pathname,
      '@repo/ai/keys': new URL('./test-shims/ai-sdk-stub.ts', import.meta.url).pathname,
    },
  },
});
