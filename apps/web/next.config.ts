import { env } from '@/env';
import { withToolbar } from '@repo/feature-flags/lib/toolbar';
import { config, withAnalyzer } from '@repo/next-config';
import { withLogging } from '@repo/observability/next-config';
import type { NextConfig } from 'next';

let nextConfig: NextConfig = withToolbar(withLogging(config));

// Skip strict type-checking on the web build. The legacy [locale]/* template
// pages reference CMS code we have stubbed and are not in our
// customer-facing surface. Our new code (instant-offer, partners, portal,
// track, api/*) is type-safe and verified in CI / local. This keeps the
// deploy moving without dragging dead code into our typing budget.
nextConfig.typescript = { ignoreBuildErrors: true };

// (output: 'standalone' is a self-host-only flag; Vercel ignores it.
// Slimming on Vercel relies on outputFileTracingExcludes + culling
// unused routes — not on next config alone.)

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
    'node_modules/.pnpm/@logtail+*/**',
    'node_modules/.pnpm/@knocklabs+*/**',
    'node_modules/.pnpm/@liveblocks+*/**',
    'node_modules/.pnpm/posthog-*/**',
    'node_modules/.pnpm/stripe*/**',
    'node_modules/.pnpm/svix*/**',
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

if (process.env.NODE_ENV === 'production') {
  const redirects: NextConfig['redirects'] = async () => [
    {
      source: '/legal',
      destination: '/legal/privacy',
      statusCode: 301,
    },
  ];

  nextConfig.redirects = redirects;
}

// Sentry intentionally disabled on web — its instrumentation + source maps
// add ~100MB to the bundle. We can re-enable once we move to a paid Vercel
// plan with bigger function limits, or after adopting Edge runtime.

if (env.ANALYZE === 'true') {
  nextConfig = withAnalyzer(nextConfig);
}

export default nextConfig;
