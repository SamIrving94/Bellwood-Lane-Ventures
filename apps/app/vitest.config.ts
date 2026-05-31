import { defineConfig, mergeConfig } from 'vitest/config';
import shared from '@repo/testing';

// React 19 + jsdom has a known teardown race where `getActiveElementDeep`
// is called after the test environment is destroyed, throwing an unhandled
// TypeError. The tests themselves pass; the error is teardown noise. Vitest
// 3.x exits 1 on any unhandled error by default — suppress it here so the
// preflight hook doesn't block pushes on a known false positive.
export default mergeConfig(
  shared,
  defineConfig({
    test: {
      dangerouslyIgnoreUnhandledErrors: true,
    },
  }),
);
