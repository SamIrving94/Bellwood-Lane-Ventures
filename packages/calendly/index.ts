import { createHmac, timingSafeEqual } from 'node:crypto';
import { keys } from './keys';

/**
 * Build a prefilled Calendly booking URL for a given lead/deal.
 *
 * The `utm_content` param carries our internal id so we can match it back
 * when the `invitee.created` webhook arrives.
 */
export const getBookingLink = (leadId: string): string => {
  const base = keys().CALENDLY_EVENT_URL;
  const url = new URL(base);
  url.searchParams.set('utm_source', 'bellwood');
  url.searchParams.set('utm_content', leadId);
  return url.toString();
};

/**
 * Verify a Calendly webhook signature.
 *
 * Calendly sends a `Calendly-Webhook-Signature` header shaped like:
 *   `t=<timestamp>,v1=<hex hmac>`
 *
 * The signed payload is `<timestamp>.<raw body>` using the webhook
 * signing key as the HMAC-SHA256 secret.
 *
 * Returns `true` if the signature is valid, `false` otherwise.
 * Gracefully returns `false` on malformed input rather than throwing.
 */
export const verifyWebhookSignature = (
  payload: string,
  signature: string | null | undefined,
  secret: string | null | undefined,
): boolean => {
  if (!signature || !secret || !payload) return false;

  // Parse "t=...,v1=..."
  const parts = signature.split(',').reduce<Record<string, string>>(
    (acc, part) => {
      const [k, v] = part.split('=');
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    },
    {},
  );

  const timestamp = parts.t;
  const providedSig = parts.v1;
  if (!timestamp || !providedSig) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expected = createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  // Constant-time compare
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(providedSig, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

/** Shape of the `invitee.created` / `invitee.canceled` webhook payload we care about. */
export type CalendlyInviteeEvent = {
  event: 'invitee.created' | 'invitee.canceled' | string;
  payload: {
    event?: {
      start_time?: string;
      end_time?: string;
      uri?: string;
    };
    scheduled_event?: {
      start_time?: string;
      end_time?: string;
      uri?: string;
    };
    tracking?: {
      utm_source?: string | null;
      utm_content?: string | null;
      utm_medium?: string | null;
      utm_campaign?: string | null;
    };
    name?: string;
    email?: string;
    cancel_url?: string;
    reschedule_url?: string;
  };
};

/** Extract our internal lead/deal id from the webhook tracking params. */
export const extractLeadId = (event: CalendlyInviteeEvent): string | null => {
  return event.payload?.tracking?.utm_content ?? null;
};

/** Extract scheduled start time from either shape Calendly may send. */
export const extractEventStart = (
  event: CalendlyInviteeEvent,
): Date | null => {
  const raw =
    event.payload?.scheduled_event?.start_time ??
    event.payload?.event?.start_time ??
    null;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};
