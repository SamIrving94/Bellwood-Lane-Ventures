/**
 * The origin of this API deployment, for cron routes that call our own
 * /agents/* endpoints over HTTP.
 *
 * These calls carry BELLWOOD_API_KEY in an Authorization header. Building the
 * target from the request's `host` / `x-forwarded-proto` headers meant the
 * destination was caller-controlled: anything able to reach a cron route with
 * a spoofed Host would have us POST the agent key to a host of its choosing,
 * escalating knowledge of CRON_SECRET into the agent key.
 *
 * Resolution order, all server-controlled:
 *   1. API_SELF_URL      — explicit override
 *   2. VERCEL_URL        — the current deployment, injected by Vercel
 *   3. http://localhost:3002 — local dev only
 */
export function selfOrigin(): string {
  const explicit = process.env.API_SELF_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return vercel.startsWith('http') ? vercel : `https://${vercel}`;
  }

  return 'http://localhost:3002';
}
