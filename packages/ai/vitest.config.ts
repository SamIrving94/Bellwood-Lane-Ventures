import { defineConfig } from 'vitest/config';

// Only the pure modules (routing, fallback) are tested — claude.ts imports
// 'server-only' and live SDKs, and its behaviour is fully decided by the
// planner + error classifier covered here.
export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
