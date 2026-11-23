export type RawMessageInput = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

// Header values come from database rows (recipient email, rendered subject).
// A stray line break there would let a value smuggle in extra headers
// (a Bcc, say), so line breaks are removed before anything is assembled.
const headerSafe = (value: string): string =>
  value.replace(/[\r\n]+/g, ' ').trim();

const isAscii = (value: string): boolean => /^[\x20-\x7E]*$/.test(value);

/** RFC 2047 encoded-word for subjects with a pound sign, accents, emoji. */
const encodeSubject = (subject: string): string =>
  isAscii(subject)
    ? subject
    : `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;

/**
 * Build the base64url RFC 2822 message the Gmail API takes for drafts and
 * sends. No From header: Gmail fills in the connected account, so a draft
 * can only ever come from the Kept mailbox.
 */
export const buildRawMessage = (input: RawMessageInput): string => {
  const isHtml = input.html !== undefined;
  const body = Buffer.from(input.html ?? input.text ?? '', 'utf8')
    .toString('base64')
    .replace(/(.{76})/g, '$1\r\n');

  const message = [
    `To: ${headerSafe(input.to)}`,
    `Subject: ${encodeSubject(headerSafe(input.subject))}`,
    'MIME-Version: 1.0',
    `Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset=UTF-8`,
    'Content-Transfer-Encoding: base64',
    '',
    body,
  ].join('\r\n');

  return Buffer.from(message, 'utf8').toString('base64url');
};
