/**
 * Single-use and attempt limits for stateless tokens, on the existing
 * RateLimitCounter table (no schema change). A counter row is keyed by
 * (bucket, subject = token jti, windowStart = epoch) and expires with the
 * token, so /cron/rate-limit-sweep cleans it up like any other counter.
 */

import { db } from '../db';

const EPOCH = new Date(0);

async function increment(
  bucket: string,
  jti: string,
  expiresAtSeconds: number
): Promise<number> {
  const database = await db();
  const row = await database.rateLimitCounter.upsert({
    where: {
      bucket_subject_windowStart: { bucket, subject: jti, windowStart: EPOCH },
    },
    create: {
      bucket,
      subject: jti,
      windowStart: EPOCH,
      count: 1,
      expiresAt: new Date(expiresAtSeconds * 1000),
    },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  return row.count;
}

/** True the first time a jti is seen in this bucket, false on any replay. */
export async function consumeOnce(
  bucket: string,
  jti: string,
  expiresAtSeconds: number
): Promise<boolean> {
  return (await increment(`oauth-once:${bucket}`, jti, expiresAtSeconds)) === 1;
}

/** Counts an attempt; true while the count stays within the limit. */
export async function attemptWithin(
  bucket: string,
  jti: string,
  expiresAtSeconds: number,
  limit: number
): Promise<boolean> {
  return (
    (await increment(`oauth-attempt:${bucket}`, jti, expiresAtSeconds)) <= limit
  );
}
