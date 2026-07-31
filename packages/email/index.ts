import { Resend } from 'resend';
import { keys } from './keys';

const env = keys();

/**
 * Shared Resend client. Will be `null` if RESEND_TOKEN is not configured —
 * callers should use `sendEmail()` which handles this gracefully.
 */
export const resend = env.RESEND_TOKEN ? new Resend(env.RESEND_TOKEN) : null;

export type SendEmailInput = {
  to: string;
  subject: string;
  /** Plain-text or HTML body. If only `text` is given, Resend sends text. */
  text?: string;
  html?: string;
  /** Override the default RESEND_FROM address. */
  from?: string;
  replyTo?: string;
};

export type SendEmailResult =
  | { skipped: true; reason: string }
  | { skipped: false; messageId: string };

/**
 * Graceful Resend wrapper.
 *
 * - If `RESEND_TOKEN` is not configured, logs and returns `{ skipped: true }`
 *   so callers (cron jobs, server actions) can continue without error.
 * - If `RESEND_FROM` is not configured and no explicit `from` is passed, also
 *   skips gracefully.
 * - On Resend API error, throws — callers should handle (or swallow) as
 *   appropriate for their pipeline.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!resend) {
    const msg = 'email skipped - no RESEND_TOKEN';
    console.warn(`[@repo/email] ${msg} (to=${input.to}, subject="${input.subject}")`);
    return { skipped: true, reason: msg };
  }

  const from = input.from ?? env.RESEND_FROM;
  if (!from) {
    const msg = 'email skipped - no RESEND_FROM configured';
    console.warn(`[@repo/email] ${msg} (to=${input.to}, subject="${input.subject}")`);
    return { skipped: true, reason: msg };
  }

  const { data, error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text ?? '',
    html: input.html,
    replyTo: input.replyTo,
  });

  if (error) {
    console.error('[@repo/email] Resend API error', {
      to: input.to,
      subject: input.subject,
      error,
    });
    throw new Error(`Resend error: ${error.name} - ${error.message}`);
  }

  if (!data?.id) {
    throw new Error('Resend returned no message id');
  }

  console.info(`[@repo/email] sent id=${data.id} to=${input.to}`);
  return { skipped: false, messageId: data.id };
}
