import { defineConfig } from 'vitest/config';

// Only the migrate scripts are tested here. They are plain Node files with no
// database or Prisma client behind them, so nothing needs stubbing.
export default defineConfig({
  test: {
    include: ['scripts/__tests__/**/*.test.mjs'],
    environment: 'node',
  },
});
