import withBundleAnalyzer from '@next/bundle-analyzer';

// @ts-expect-error No declaration file
import { PrismaPlugin } from '@prisma/nextjs-monorepo-workaround-plugin';
import type { NextConfig } from 'next';

const otelRegex = /@opentelemetry\/instrumentation/;

// The PostHog ingest proxy follows the project's region. An EU project
// proxied to the US cluster has its events rejected and nothing surfaces
// until someone looks. Matches both forms PostHog hands out — the app host
// (https://eu.posthog.com, what we set) and the ingest host the install docs
// show (https://eu.i.posthog.com). Defaults to US, which is what the
// dashboard has always pointed at.
const posthogRegion = /^https?:\/\/eu\./.test(
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? ''
)
  ? 'eu'
  : 'us';

export const config: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },

  // biome-ignore lint/suspicious/useAwait: rewrites is async
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: `https://${posthogRegion}-assets.i.posthog.com/static/:path*`,
      },
      {
        source: '/ingest/:path*',
        destination: `https://${posthogRegion}.i.posthog.com/:path*`,
      },
      {
        source: '/ingest/decide',
        destination: `https://${posthogRegion}.i.posthog.com/decide`,
      },
    ];
  },

  webpack(config, { isServer }) {
    if (isServer) {
      config.plugins = config.plugins || [];
      config.plugins.push(new PrismaPlugin());
    }

    config.ignoreWarnings = [{ module: otelRegex }];

    return config;
  },

  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

export const withAnalyzer = (sourceConfig: NextConfig): NextConfig =>
  withBundleAnalyzer()(sourceConfig);
