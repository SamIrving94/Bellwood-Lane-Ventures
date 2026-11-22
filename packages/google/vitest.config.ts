import { defineConfig } from 'vitest/config';

// Only the pure modules are unit-tested (crypto, MIME, working days, inbox
// classifier, partner sheet). Anything that touches the database or Google
// is exercised through those pure pieces, so no shims are needed here.
export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
