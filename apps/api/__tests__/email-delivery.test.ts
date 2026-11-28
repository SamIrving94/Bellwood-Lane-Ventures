import {
  deliveryReason,
  isDeliveryProblem,
  shouldReplaceStatus,
  statusForEvent,
} from '@repo/email/delivery';
import { describe, expect, it } from 'vitest';

describe('statusForEvent', () => {
  it('maps the Resend status events', () => {
    expect(statusForEvent('email.delivered')).toBe('delivered');
    expect(statusForEvent('email.bounced')).toBe('bounced');
    expect(statusForEvent('email.complained')).toBe('complained');
    expect(statusForEvent('email.delivery_delayed')).toBe('delayed');
  });

  it('is null for events that are not a delivery status', () => {
    expect(statusForEvent('email.opened')).toBeNull();
    expect(statusForEvent('email.received')).toBeNull();
    expect(statusForEvent('contact.created')).toBeNull();
  });
});

describe('shouldReplaceStatus', () => {
  it('takes the first status it hears', () => {
    expect(shouldReplaceStatus(null, 'sent')).toBe(true);
  });

  it('never lets a late "sent" overwrite "delivered"', () => {
    expect(shouldReplaceStatus('delivered', 'sent')).toBe(false);
  });

  it('never lets "delivered" hide a bounce', () => {
    expect(shouldReplaceStatus('bounced', 'delivered')).toBe(false);
    expect(shouldReplaceStatus('delivered', 'bounced')).toBe(true);
  });

  it('lets a spam report replace "delivered"', () => {
    expect(shouldReplaceStatus('delivered', 'complained')).toBe(true);
  });

  it('ignores a repeat of the same status', () => {
    expect(shouldReplaceStatus('bounced', 'bounced')).toBe(false);
  });
});

describe('isDeliveryProblem', () => {
  it('flags bounce, failure and spam report only', () => {
    expect(isDeliveryProblem('bounced')).toBe(true);
    expect(isDeliveryProblem('failed')).toBe(true);
    expect(isDeliveryProblem('complained')).toBe(true);
    expect(isDeliveryProblem('delivered')).toBe(false);
    expect(isDeliveryProblem('delayed')).toBe(false);
  });
});

describe('deliveryReason', () => {
  it('joins the parts Resend gives for a bounce', () => {
    expect(
      deliveryReason({
        bounce: {
          type: 'Permanent',
          subType: 'General',
          message: 'The email account does not exist.',
        },
      })
    ).toBe('Permanent: General: The email account does not exist.');
  });

  it('reads a failure reason', () => {
    expect(deliveryReason({ failed: { reason: 'Invalid recipient' } })).toBe(
      'Invalid recipient'
    );
  });

  it('is null when no reason is given, never a guess', () => {
    expect(deliveryReason({})).toBeNull();
    expect(deliveryReason({ bounce: {} })).toBeNull();
    expect(deliveryReason({ bounce: 'x' })).toBeNull();
  });
});
