// Type-only — erased at build time, so importing the template builder never
// constructs the Resend client. `sendHoldingReply` pulls the real sender in
// dynamically below, which keeps `buildHoldingReply` a pure function that
// tests can exercise without server-side env.
import type { SendEmailResult } from './index';

/**
 * The instant "holding reply" sent to every inbound vendor enquiry.
 *
 * WHY THIS EXISTS
 * Lead-response research is unambiguous: qualification odds collapse
 * between a 5-minute and a 30-minute reply, and the first responder wins
 * the large majority of enquiries. Sellers in this category typically
 * enquire with two or three cash buyers in the same afternoon, so being
 * first to reply is close to the whole game.
 *
 * WHY IT IS A FIXED TEMPLATE AND NOT AN LLM
 * This message goes to an individual vendor with zero founder review, so
 * it is the one vendor-facing send that bypasses `OutreachHold`. That is
 * only safe because it is deterministic: a template with named slots
 * cannot improvise a valuation, a price, or a completion date under
 * pressure. Do NOT route this through a model, and do NOT add a figure —
 * anything with a number in it belongs behind founder review.
 *
 * It acknowledges, it reassures, it sets expectations. It never promises.
 */

/** Anything that looks like a committed figure or a hard guarantee. */
const FIGURE_PATTERN = /[£$€]\s?[\d,]|\b\d[\d,]*\s?(?:k\b|gbp\b|pounds\b)/i;

const WHITESPACE = /\s+/;

export type HoldingReplyInput = {
  /** Full name as supplied. Only the first name is used. */
  contactName: string;
  contactEmail: string;
  /** Postcode, or a full address if we have one. Purely for recognition. */
  propertyRef?: string;
  /** Hours until the founder calls. Kept vague-but-honest; default 24. */
  callbackHours?: number;
};

export type BuiltHoldingReply = { subject: string; text: string };

function firstName(full: string): string {
  const first = full.trim().split(WHITESPACE)[0];
  return first && first.length > 1 ? first : 'there';
}

/**
 * Renders the holding reply. Exported separately from `sendHoldingReply` so
 * it can be asserted against in tests without touching Resend.
 *
 * Throws if a caller manages to inject a figure through one of the slots —
 * a loud failure here is much cheaper than a vendor receiving an implied
 * valuation we never agreed to.
 */
export function buildHoldingReply(input: HoldingReplyInput): BuiltHoldingReply {
  const { contactName, propertyRef, callbackHours = 24 } = input;

  for (const [slot, value] of Object.entries({ contactName, propertyRef })) {
    if (value && FIGURE_PATTERN.test(value)) {
      throw new Error(
        `[holding-reply] refusing to send: slot "${slot}" contains what looks like a figure. The holding reply must never carry a price or valuation.`
      );
    }
  }

  const about = propertyRef?.trim() ? ` about ${propertyRef.trim()}` : '';

  return {
    subject: propertyRef?.trim()
      ? `We've got your enquiry — ${propertyRef.trim()}`
      : "We've got your enquiry",
    text: [
      `Hi ${firstName(contactName)},`,
      '',
      `Thanks for getting in touch${about}. We have your details and they are with us now — this is not an automated dead end.`,
      '',
      `Someone will personally review your situation and call you within ${callbackHours} hours.`,
      '',
      'Here is exactly what happens next:',
      '  1. We check the property against comparable sales and public records.',
      '  2. We call to talk through your situation. No pressure, no obligation.',
      '  3. If it is a fit, you get a written offer — locked for 72 hours.',
      '',
      'We do not give a figure before we have looked properly. Anyone who does is guessing, and a guessed number tends to get revised down later.',
      '',
      'If anything changes in the meantime, just reply to this email.',
      '',
      'Bellwoods Lane',
      'Member of the Property Redress Scheme (PRS) · Follows The Property Ombudsman code',
      'HMRC AML supervised · ICO registered',
      'Cash property buying is not regulated by the FCA.',
      'hello@bellwoodslane.co.uk',
    ].join('\n'),
  };
}

/**
 * Builds and sends the holding reply. Never throws on a delivery failure —
 * a missing acknowledgement must not take down the intake path that just
 * captured the lead. Returns `null` when the send failed.
 */
export async function sendHoldingReply(
  input: HoldingReplyInput
): Promise<SendEmailResult | null> {
  try {
    const { subject, text } = buildHoldingReply(input);
    const { sendEmail } = await import('./index');
    return await sendEmail({ to: input.contactEmail, subject, text });
  } catch (err) {
    console.warn('[@repo/email] holding reply failed (non-fatal)', err);
    return null;
  }
}
