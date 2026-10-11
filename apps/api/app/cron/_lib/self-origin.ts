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
 * Resolution order, all server-controlled (injected by Vercel or set by us):
 *   1. API_SELF_URL                  — explicit override
 *   2. VERCEL_PROJECT_PRODUCTION_URL — in production only: the public alias
 *   3. VERCEL_URL                    — this deployment (previews)
 *   4. http://localhost:3002         — local dev only
 *
 * Production must not use VERCEL_URL. That is the per-deployment URL, and
 * Vercel Deployment Protection guards it: every self-call got 401
 * {"error":{"code":"401","message":"Protected deployment"}} before reaching
 * our code. Oct 2026: that is why the weekly guide never produced a draft,
 * and the cron logged the object as "[object Object]". The public alias is
 * not protected.
 */
export function selfOrigin(): string {
  const explicit = process.env.API_SELF_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production && process.env.VERCEL_ENV === 'production') {
    return withScheme(production);
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return withScheme(vercel);

  return 'http://localhost:3002';
}

function withScheme(host: string): string {
  return (host.startsWith('http') ? host : `https://${host}`).replace(
    /\/+$/,
    ''
  );
}
