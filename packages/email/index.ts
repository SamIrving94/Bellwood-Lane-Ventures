import { Resend } from 'resend';
import {
  DEFAULT_REPLY_TO,
  bareAddress,
  htmlToText,
  isOwnAddress,
} from './addresses';
import { keys } from './keys';
import { recordEmail } from './log';

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
  /** Where replies go. Defaults to RESEND_REPLY_TO, else the one live mailbox. */
  replyTo?: string;
  /** Extra headers, e.g. In-Reply-To / References when replying in a thread. */
  headers?: Record<string, string>;
  /**
   * The body holds a sign-in link or one-time code. The send is still logged
   * (who, when, subject) but the body is not stored.
   */
  sensitive?: boolean;
  /** Clerk userId when a founder wrote this by hand (replies from /inbox). */
  sentBy?: string;
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
 * - Every send carries a Reply-To that points at a mailbox that exists (see
 *   DEFAULT_REPLY_TO for why), and every send to someone outside our own
 *   domains is written to the correspondence log (EmailMessage) so the
 *   dashboard /inbox can show the conversation. The log write is best-effort:
 *   a logging failure never fails, or double-sends, an email.
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

  const replyTo = input.replyTo ?? env.RESEND_REPLY_TO ?? DEFAULT_REPLY_TO;

  const { data, error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text ?? '',
    html: input.html,
    replyTo,
    headers: input.headers,
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

  const counterparty = bareAddress(input.to);
  if (counterparty && !isOwnAddress(counterparty)) {
    await recordEmail({
      direction: 'outbound',
      counterparty,
      fromAddress: from,
      toAddress: input.to,
      subject: input.subject,
      textBody: input.sensitive
        ? '[Body not stored: it contained a sign-in link or code.]'
        : (input.text ?? (input.html ? htmlToText(input.html) : null)),
      htmlBody: input.sensitive ? null : (input.html ?? null),
      providerId: data.id,
      inReplyTo: input.headers?.['In-Reply-To'] ?? null,
      sentBy: input.sentBy ?? null,
    }).catch((err) => {
      console.warn('[@repo/email] sent, but not logged to EmailMessage', {
        id: data.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }
  return { skipped: false, messageId: data.id };
}
