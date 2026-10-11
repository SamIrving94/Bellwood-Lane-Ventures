import { afterEach, describe, expect, it, vi } from 'vitest';
import { selfOrigin } from '../app/cron/_lib/self-origin';

afterEach(() => {
  vi.unstubAllEnvs();
});

function stub(env: Record<string, string>) {
  for (const k of [
    'API_SELF_URL',
    'VERCEL_ENV',
    'VERCEL_PROJECT_PRODUCTION_URL',
    'VERCEL_URL',
  ]) {
    vi.stubEnv(k, env[k] ?? '');
  }
}

describe('selfOrigin', () => {
  it('uses the public alias in production, never the protected deployment URL', () => {
    stub({
      VERCEL_ENV: 'production',
      VERCEL_PROJECT_PRODUCTION_URL: 'bellwood-api.vercel.app',
      VERCEL_URL: 'bellwood-abc123-team.vercel.app',
    });
    expect(selfOrigin()).toBe('https://bellwood-api.vercel.app');
  });

  it('uses the deployment URL on previews', () => {
    stub({
      VERCEL_ENV: 'preview',
      VERCEL_PROJECT_PRODUCTION_URL: 'bellwood-api.vercel.app',
      VERCEL_URL: 'bellwood-abc123-team.vercel.app',
    });
    expect(selfOrigin()).toBe('https://bellwood-abc123-team.vercel.app');
  });

  it('lets API_SELF_URL override everything', () => {
    stub({
      API_SELF_URL: 'https://api.example.test/',
      VERCEL_ENV: 'production',
      VERCEL_PROJECT_PRODUCTION_URL: 'bellwood-api.vercel.app',
    });
    expect(selfOrigin()).toBe('https://api.example.test');
  });

  it('falls back to localhost in dev', () => {
    stub({});
    expect(selfOrigin()).toBe('http://localhost:3002');
  });
});
