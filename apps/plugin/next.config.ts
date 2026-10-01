import { config } from '@repo/next-config';
import type { NextConfig } from 'next';

/**
 * The ChatGPT plugin server (docs/mcp/05-build-plan.md). A separate Vercel
 * project so the MCP SDK v2 / zod 4 stack stays isolated from the zod 3
 * apps, and so a plugin incident can never take the website or the
 * dashboard down.
 */
const nextConfig: NextConfig = {
  ...config,
  outputFileTracingExcludes: {
    '*': [
      'node_modules/@next/swc-*/**',
      'node_modules/@swc/core-*/**',
      'node_modules/.pnpm/typescript*/**',
      'node_modules/.pnpm/vitest*/**',
      '**/*.map',
      '**/__tests__/**',
      '**/*.test.*',
      '**/query_engine-windows.dll.node',
    ],
  },
};

export default nextConfig;
