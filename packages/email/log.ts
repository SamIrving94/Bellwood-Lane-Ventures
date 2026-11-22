import { database } from '@repo/database';

/**
 * The correspondence log (EmailMessage). `sendEmail` writes outbound rows,
 * /webhooks/resend/inbound writes inbound rows, and the dashboard /inbox
 * reads both.
 */

export type EmailLinks = {
  dealId: string | null;
  quoteRequestId: string | null;
};

/**
 * Best-effort link from an address to the deal / quote it belongs to: the
 * most recent Deal with that seller email and the most recent QuoteRequest
 * with that contact email. Null when nothing matches; never a guess.
 */
export async function findEmailLinks(address: string): Promise<EmailLinks> {
  const [deal, quote] = await Promise.all([
    database.deal.findFirst({
      where: { sellerEmail: { equals: address, mode: 'insensitive' } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    }),
    database.quoteRequest.findFirst({
      where: { contactEmail: { equals: address, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    }),
  ]);
  return { dealId: deal?.id ?? null, quoteRequestId: quote?.id ?? null };
}

export type RecordEmailInput = {
  direction: 'outbound' | 'inbound';
  counterparty: string;
  fromAddress: string;
  toAddress: string;
  subject: string;
  textBody?: string | null;
  htmlBody?: string | null;
  providerId?: string | null;
  messageId?: string | null;
  inReplyTo?: string | null;
  attachmentCount?: number;
  sentBy?: string | null;
  /** Skip the address lookup when the caller already knows the links. */
  links?: Partial<EmailLinks>;
};

/** Write one row. Throws on failure; callers decide whether that matters. */
export async function recordEmail(input: RecordEmailInput) {
  const found =
    input.links?.dealId !== undefined &&
    input.links?.quoteRequestId !== undefined
      ? { dealId: null, quoteRequestId: null }
      : await findEmailLinks(input.counterparty);

  return database.emailMessage.create({
    data: {
      direction: input.direction,
      counterparty: input.counterparty.toLowerCase(),
      fromAddress: input.fromAddress,
      toAddress: input.toAddress,
      subject: input.subject.slice(0, 500),
      textBody: input.textBody ?? null,
      htmlBody: input.htmlBody ?? null,
      providerId: input.providerId ?? null,
      messageId: input.messageId ?? null,
      inReplyTo: input.inReplyTo ?? null,
      attachmentCount: input.attachmentCount ?? 0,
      sentBy: input.sentBy ?? null,
      dealId: input.links?.dealId ?? found.dealId,
      quoteRequestId: input.links?.quoteRequestId ?? found.quoteRequestId,
    },
    select: { id: true, dealId: true, quoteRequestId: true },
  });
}
