import { env } from '@/env';
import { config, withAnalyzer } from '@repo/next-config';
import { withLogging } from '@repo/observability/next-config';
import type { NextConfig } from 'next';

let nextConfig: NextConfig = withLogging(config);

// Batch spreadsheet uploads go through a Server Action (`batch/actions/upload.ts`),
// and Next caps Server Action request bodies at 1MB by default — the limit is
// enforced in the runtime BEFORE the action runs, so the action's own 10MB
// check never got a chance to fire and the founder just saw the generic error
// page. Raised to match the limit `uploadBatch` already validates against.
nextConfig.experimental = {
  ...nextConfig.experimental,
  serverActions: {
    ...nextConfig.experimental?.serverActions,
    bodySizeLimit: '10mb',
  },
};

// Aggressively exclude dev-only and unused deps to stay under Vercel's
// 262MB lambda limit.
nextConfig.outputFileTracingExcludes = {
  '*': [
    'node_modules/@next/swc-*/**',
    'node_modules/@swc/core-*/**',
    'node_modules/.pnpm/@sentry+*/**',
    'node_modules/.pnpm/@opentelemetry+*/**',
    'node_modules/.pnpm/basehub*/**',
    'node_modules/.pnpm/@playwright+*/**',
    'node_modules/.pnpm/typescript*/**',
    'node_modules/.pnpm/@logtail+*/**',
    'node_modules/.pnpm/@knocklabs+*/**',
    'node_modules/.pnpm/@liveblocks+*/**',
    'node_modules/.pnpm/posthog-*/**',
    'node_modules/.pnpm/algoliasearch*/**',
    'node_modules/.pnpm/storybook*/**',
    'node_modules/.pnpm/vitest*/**',
    'node_modules/.pnpm/@testing-library+*/**',
    '**/*.map',
    '**/*.md',
    '**/CHANGELOG*',
    '**/LICENSE*',
    '**/.cache/**',
    '**/__tests__/**',
    '**/*.test.*',
    '**/*.spec.*',
    // The Prisma client is generated with both native and rhel binary
    // targets (see packages/database/prisma/schema.prisma); the lambda only
    // ever needs the rhel engine.
    '**/query_engine-windows.dll.node',
  ],
};

// Sentry intentionally disabled — adds ~100MB of source maps.
// Re-enable on a paid Vercel plan with bigger function limits.

if (env.ANALYZE === 'true') {
  nextConfig = withAnalyzer(nextConfig);
}

export default nextConfig;
