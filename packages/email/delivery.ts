/**
 * Pure delivery-status rules for the correspondence log. No I/O; tested in
 * apps/api/__tests__/email-delivery.test.ts.
 */

export type DeliveryStatus =
  | 'sent'
  | 'delayed'
  | 'delivered'
  | 'bounced'
  | 'complained'
  | 'failed';

/** Resend webhook event type → our status. Anything else is not a status. */
const EVENT_STATUS: Record<string, DeliveryStatus> = {
  'email.sent': 'sent',
  'email.delivery_delayed': 'delayed',
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
};

export function statusForEvent(type: string): DeliveryStatus | null {
  return EVENT_STATUS[type] ?? null;
}

/**
 * Webhooks arrive out of order and are retried. A higher rank is a later,
 * more final fact, so a late "sent" must never overwrite "delivered", and
 * "delivered" must never hide a bounce.
 *
 * `complained` outranks `delivered` on purpose: a spam report only happens
 * after delivery, and it is the one we need to see.
 */
const RANK: Record<DeliveryStatus, number> = {
  sent: 1,
  delayed: 2,
  delivered: 3,
  bounced: 4,
  failed: 4,
  complained: 5,
};

export function shouldReplaceStatus(
  current: DeliveryStatus | null | undefined,
  next: DeliveryStatus
): boolean {
  return !current || RANK[next] > RANK[current];
}

/** The email did not reach a person, or they objected to it. Raises a card. */
export function isDeliveryProblem(status: DeliveryStatus): boolean {
  return status === 'bounced' || status === 'failed' || status === 'complained';
}

/** Short label for the dashboard. */
export function deliveryLabel(status: DeliveryStatus): string {
  switch (status) {
    case 'sent':
      return 'Sent';
    case 'delayed':
      return 'Delayed';
    case 'delivered':
      return 'Delivered';
    case 'bounced':
      return 'Bounced';
    case 'complained':
      return 'Marked as spam';
    case 'failed':
      return 'Failed to send';
    default:
      return status satisfies never;
  }
}

/**
 * The bounce reason out of a Resend `email.bounced` / `email.failed` payload.
 * The shape is read defensively: a missing reason is null, never a guess.
 */
export function deliveryReason(data: Record<string, unknown>): string | null {
  for (const key of ['bounce', 'failed']) {
    const block = data[key];
    if (block && typeof block === 'object') {
      const b = block as Record<string, unknown>;
      const parts = [b.type, b.subType, b.message ?? b.reason].filter(
        (p): p is string => typeof p === 'string' && p.trim().length > 0
      );
      if (parts.length > 0) {
        return parts.join(': ').slice(0, 500);
      }
    }
  }
  return null;
}
