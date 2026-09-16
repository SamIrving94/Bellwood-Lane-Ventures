/**
 * Read CRON_SECRET with any invisible characters stripped.
 *
 * Sep 2026: "Run scout now" failed with "Cannot convert argument to a
 * ByteString because the character at index 7 has a value of 65279".
 * Index 7 is the first character after "Bearer ", and 65279 is U+FEFF —
 * the UTF-8 byte order mark. The secret had been pasted into Vercel from a
 * file saved with a BOM, so every dashboard call that put it in an
 * Authorization header threw before the request was sent. The value looks
 * identical in the Vercel UI, so this is stripped here rather than relying
 * on the env var being re-entered cleanly.
 */
export function cleanSecret(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const cleaned = raw.replace(/^﻿/, '').trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

export function getCronSecret(): string | undefined {
  return cleanSecret(process.env.CRON_SECRET);
}
