import { env } from '@/env';
import { withToolbar } from '@repo/feature-flags/lib/toolbar';
import { config, withAnalyzer } from '@repo/next-config';
import { withLogging } from '@repo/observability/next-config';
import type { NextConfig } from 'next';

let nextConfig: NextConfig = withToolbar(withLogging(config));

// Standalone output — produces a minimal traced server bundle so we
// stay under Vercel's 262MB lambda limit.
nextConfig.output = 'standalone';

// Aggressively exclude template / dev-only assets from the serverless
// function bundle to stay under Vercel's 262MB lambda limit.
nextConfig.outputFileTracingExcludes = {
  '*': [
    'node_modules/@next/swc-*/**',
    'node_modules/@swc/core-*/**',
    'node_modules/.pnpm/@sentry+*/**',
    'node_modules/.pnpm/@opentelemetry+*/**',
    'node_modules/.pnpm/basehub*/**',
    'node_modules/.pnpm/@playwright+*/**',
    'node_modules/.pnpm/typescript*/**',
    '**/*.map',
    '**/*.md',
    '**/CHANGELOG*',
    '**/LICENSE*',
    '**/.cache/**',
  ],
};

// Sentry intentionally disabled — adds ~100MB of source maps.
// Re-enable on a paid Vercel plan with bigger function limits.

if (env.ANALYZE === 'true') {
  nextConfig = withAnalyzer(nextConfig);
}

export default nextConfig;
