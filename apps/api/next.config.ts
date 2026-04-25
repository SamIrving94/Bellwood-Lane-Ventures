import { env } from '@/env';
import { config, withAnalyzer } from '@repo/next-config';
import { withLogging } from '@repo/observability/next-config';
import type { NextConfig } from 'next';

let nextConfig: NextConfig = withLogging(config);

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
  ],
};

// Sentry disabled — adds ~100MB of source maps; over the 262MB lambda limit.

if (env.ANALYZE === 'true') {
  nextConfig = withAnalyzer(nextConfig);
}

export default nextConfig;
