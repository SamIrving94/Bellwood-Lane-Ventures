import 'server-only';

import { database } from '@repo/database';

/**
 * Durable, cross-instance rate limiting for the public endpoints.
 *
 * The previous limiter was a module-level Map. On Vercel each serverless
 * isolate holds its own copy and isolates recycle constantly, so a "10 per
 * hour" cap was really "10 per hour per lambda" — effectively unlimited under
 * the traffic a paid campaign brings. Every unthrottled call to /api/quote
 * costs real money (LLM + PropertyData) and can send mail to an
 * attacker-chosen address, so the counter has to be shared. Postgres is
 * already in the request path here, so it is the cheapest shared store we
 * have; swap for Redis/Arcjet if volume makes the write cost matter.
 *
 * Fixed-window, not sliding: a caller can burst across a window boundary.
 * That is an accepted trade for a single indexed upsert per request.
 */

export type RateLimitRule = {
  /** Logical bucket, e.g. 'quote'. Counters never mix across buckets. */
  bucket: string;
  /** Max requests per subject per window. */
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  ok: boolean;
  /** Requests left in this window (0 when blocked). */
  remaining: number;
  /** When the current window ends. */
  resetAt: Date;
};

/**
 * The client IP, or null when it cannot be established.
 *
 * Only the LAST entry of x-forwarded-for is trustworthy on Vercel — the proxy
 * appends the real peer, while a client can put anything in the earlier
 * positions. Taking [0] (as the old limiter did) let a caller spoof a fresh
 * identity per request and bypass the cap entirely.
 */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return request.headers.get('x-real-ip')?.trim() || null;
}

/**
 * Count one request against `subject` and report whether it is allowed.
 *
 * Fails OPEN: if the counter write throws (database blip), the request is let
 * through rather than taking the whole funnel down with the limiter.
 */
export async function checkRateLimit(
  rule: RateLimitRule,
  subject: string
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / rule.windowMs) * rule.windowMs);
  const resetAt = new Date(windowStart.getTime() + rule.windowMs);

  try {
    const row = await database.rateLimitCounter.upsert({
      where: {
        bucket_subject_windowStart: {
          bucket: rule.bucket,
          subject,
          windowStart,
        },
      },
      create: {
        bucket: rule.bucket,
        subject,
        windowStart,
        count: 1,
        expiresAt: resetAt,
      },
      update: { count: { increment: 1 } },
      select: { count: true },
    });

    return {
      ok: row.count <= rule.limit,
      remaining: Math.max(0, rule.limit - row.count),
      resetAt,
    };
  } catch (err) {
    console.warn('[rate-limit] counter unavailable, allowing request', {
      bucket: rule.bucket,
      err,
    });
    return { ok: true, remaining: rule.limit, resetAt };
  }
}

/**
 * Apply every rule in turn and return the first that blocks.
 *
 * Used to layer a per-IP cap with a per-email cap, so rotating one identifier
 * alone does not buy an attacker a fresh budget.
 */
export async function checkRateLimits(
  checks: Array<{ rule: RateLimitRule; subject: string }>
): Promise<RateLimitResult & { blockedBy?: string }> {
  let tightest: RateLimitResult | null = null;

  for (const { rule, subject } of checks) {
    const result = await checkRateLimit(rule, subject);
    if (!result.ok) return { ...result, blockedBy: rule.bucket };
    if (!tightest || result.remaining < tightest.remaining) tightest = result;
  }

  return tightest ?? { ok: true, remaining: 0, resetAt: new Date() };
}

/** `Retry-After` header value (whole seconds) for a 429 response. */
export function retryAfterSeconds(resetAt: Date): string {
  return String(
    Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000))
  );
}

/** Shared limits for the public surfaces. Tune here, not at call sites. */
export const LIMITS = {
  /** Offer engine: LLM + paid property data + outbound email per call. */
  quoteByIp: { bucket: 'quote:ip', limit: 8, windowMs: 60 * 60 * 1000 },
  quoteByEmail: { bucket: 'quote:email', limit: 5, windowMs: 60 * 60 * 1000 },
  /** Sends mail to a caller-supplied address: keep tight. */
  partnerAuthByIp: {
    bucket: 'partner-auth:ip',
    limit: 10,
    windowMs: 60 * 60 * 1000,
  },
  partnerAuthByEmail: {
    bucket: 'partner-auth:email',
    limit: 5,
    windowMs: 60 * 60 * 1000,
  },
  /** Metered Ordnance Survey quota. */
  osPlacesByIp: { bucket: 'os-places:ip', limit: 60, windowMs: 60 * 1000 },
  /** Public AVM run: LLM + property data, no persistence. */
  scoreByIp: { bucket: 'score:ip', limit: 10, windowMs: 60 * 60 * 1000 },
  proofOfFundsByIp: {
    bucket: 'proof-of-funds:ip',
    limit: 5,
    windowMs: 60 * 60 * 1000,
  },
  trackReplyByToken: {
    bucket: 'track-reply:token',
    limit: 10,
    windowMs: 60 * 60 * 1000,
  },
  /** Backstop for guessed tokens, which each land in their own token bucket. */
  trackReplyByIp: {
    bucket: 'track-reply:ip',
    limit: 30,
    windowMs: 60 * 60 * 1000,
  },
} as const satisfies Record<string, RateLimitRule>;
