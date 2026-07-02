/**
 * PropertyData REST API client — shared fetch wrapper.
 *
 * Server-only. Each endpoint module imports `fetchPropertyData` (and, for the
 * couple of POST/raw endpoints, `env` + `API_BASE`) from here. Caching and
 * credit accounting are delegated to ./cache and ./credits so this file only
 * owns the HTTP concern.
 *
 * IMPORTANT: never log the API key. The 'server-only' import keeps this module
 * out of any browser bundle.
 */

import 'server-only';

import { z } from 'zod';
import { keys } from '../../keys';
import { cacheGet, cacheSet } from './cache';
import { logCreditUsage } from './credits';

export const env = keys();

export const API_BASE = 'https://api.propertydata.co.uk';
export const REQUEST_TIMEOUT_MS = 10_000;

export class PropertyDataError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly status: number,
    message: string,
  ) {
    super(`[propertydata ${endpoint}] ${status}: ${message}`);
  }
}

export async function fetchPropertyData<T>(
  endpoint: string,
  params: Record<string, string | number | undefined>,
  options: { ttlMs: number; estimatedCredits: number; schema: z.ZodType<T> },
): Promise<T | null> {
  const apiKey = env.PROPERTYDATA_API_KEY;
  if (!apiKey) {
    console.warn(
      `[propertydata] ${endpoint} skipped — no PROPERTYDATA_API_KEY configured`,
    );
    return null;
  }

  // Build the URL. PropertyData accepts the key as a query param (`key=`).
  // We never log the URL because the key is in it.
  const url = new URL(`${API_BASE}${endpoint}`);
  url.searchParams.set('key', apiKey);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  }

  // Cache key excludes the API key (don't bake it into stored cache keys).
  const cacheKey = `${endpoint}:${JSON.stringify(
    Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    ),
  )}`;
  const cached = cacheGet<T>(cacheKey);
  if (cached !== null) {
    logCreditUsage(endpoint, 0, true);
    return cached;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new PropertyDataError(
        endpoint,
        res.status,
        await res.text().catch(() => res.statusText),
      );
    }
    const json = await res.json();
    const parsed = options.schema.safeParse(json);
    if (!parsed.success) {
      console.warn(
        `[propertydata] ${endpoint} response failed schema validation`,
        parsed.error.flatten(),
      );
      return null;
    }
    cacheSet(cacheKey, parsed.data, options.ttlMs);
    logCreditUsage(endpoint, options.estimatedCredits, false);
    return parsed.data;
  } catch (error) {
    if (error instanceof PropertyDataError) {
      console.warn(error.message);
    } else if ((error as { name?: string })?.name === 'AbortError') {
      console.warn(`[propertydata] ${endpoint} timed out after ${REQUEST_TIMEOUT_MS}ms`);
    } else {
      console.warn(`[propertydata] ${endpoint} failed`, error);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}
