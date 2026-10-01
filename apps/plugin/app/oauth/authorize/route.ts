/**
 * OAuth authorize endpoint for the Pro plugin. GET validates the request
 * and shows the email step; POST handles the email and code steps. See
 * lib/oauth/flow.ts for the whole flow and why it uses an emailed code.
 */

import { attemptWithin } from '@/lib/oauth/consume';
import {
  confirmSignIn,
  startSignIn,
  validateAuthorizeRequest,
} from '@/lib/oauth/flow';
import { normaliseEmail } from '@/lib/oauth/identity';
import {
  codePage,
  emailPage,
  errorPage,
  htmlResponse,
} from '@/lib/oauth/pages';
import { verifyToken } from '@/lib/oauth/tokens';
import { getPublicOrigin } from 'mcp-handler';

const HOUR = 3600;
const SENDS_PER_EMAIL_PER_HOUR = 5;
const SENDS_PER_IP_PER_HOUR = 20;

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  return fwd.split(',').at(-1)?.trim() || 'unknown';
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const v = await validateAuthorizeRequest(req, params);
  if (v.kind === 'show_error') return htmlResponse(errorPage(v.message), 400);
  if (v.kind === 'redirect') return Response.redirect(v.location, 302);
  return htmlResponse(
    emailPage({ authReq: v.token, clientName: v.client.clientName })
  );
}

export async function POST(req: Request) {
  // Forms must come from our own pages.
  const origin = req.headers.get('origin');
  if (
    origin &&
    origin !== getPublicOrigin(req) &&
    origin !== process.env.PLUGIN_PUBLIC_URL
  ) {
    return htmlResponse(
      errorPage('This form was sent from somewhere else.'),
      403
    );
  }
  const form = new URLSearchParams(await req.text());
  const step = form.get('step');

  if (step === 'email') {
    const reqToken = form.get('req') ?? '';
    const email = normaliseEmail(form.get('email') ?? '');
    const authReq = verifyToken<{
      client_name: string;
      pur: 'authreq';
      jti: string;
      iat: number;
      exp: number;
    }>('authreq', reqToken);
    if (!authReq) {
      return htmlResponse(
        errorPage(
          'This sign-in has expired. Go back to ChatGPT and try again.'
        ),
        400
      );
    }
    const hour = Math.floor(Date.now() / 1000 / HOUR);
    const expires = (hour + 2) * HOUR;
    const withinEmail = await attemptWithin(
      'otp-send-email',
      `${email}:${hour}`,
      expires,
      SENDS_PER_EMAIL_PER_HOUR
    );
    const withinIp = await attemptWithin(
      'otp-send-ip',
      `${clientIp(req)}:${hour}`,
      expires,
      SENDS_PER_IP_PER_HOUR
    );
    if (!(withinEmail && withinIp)) {
      return htmlResponse(
        emailPage({
          authReq: reqToken,
          clientName: authReq.client_name,
          error: 'Too many codes requested. Wait an hour and try again.',
        }),
        429
      );
    }
    const started = await startSignIn(reqToken, email);
    if (!started.ok) return htmlResponse(errorPage(started.message), 400);
    return htmlResponse(codePage({ pending: started.pending }));
  }

  if (step === 'code') {
    const pending = form.get('pending') ?? '';
    const result = await confirmSignIn(req, pending, form.get('code') ?? '');
    if (result.ok) return Response.redirect(result.location, 302);
    if (result.retry)
      return htmlResponse(codePage({ pending, error: result.message }), 400);
    return htmlResponse(errorPage(result.message), 400);
  }

  return htmlResponse(
    errorPage('Something went wrong. Go back to ChatGPT and try again.'),
    400
  );
}
