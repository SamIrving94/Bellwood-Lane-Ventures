/**
 * @repo/deal-updates
 *
 * Single place to record a deal-timeline event AND notify every party
 * in the chain. Transparency is the differentiator — sellers, agents,
 * solicitors, and our own team all hear about every state change at the
 * same moment.
 *
 * Usage:
 *   import { recordDealUpdate } from '@repo/deal-updates';
 *
 *   await recordDealUpdate({
 *     quoteRequestId: quote.id,
 *     kind: 'offer_accepted',
 *     title: 'Cash offer accepted',
 *     detail: 'We will instruct solicitors today.',
 *     metadata: { offerPence: 18240000, completionDays: 18 },
 *   });
 */

import 'server-only';

import {
  type DealUpdateKind,
  type DealUpdateVisibility,
  type Prisma,
  database,
} from '@repo/database';
import { sendEmail } from '@repo/email';
import {
  renderUpdateEmail,
  type UpdateEmailContext,
} from './email-templates';

export type {
  DealUpdateKind,
  DealUpdateVisibility,
} from '@repo/database';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type RecordUpdateInput = {
  /** Either a Deal id OR a QuoteRequest id (or both — they get linked) */
  dealId?: string;
  quoteRequestId?: string;
  kind: DealUpdateKind;
  title: string;
  detail?: string;
  metadata?: Record<string, unknown>;
  visibility?: DealUpdateVisibility;
  /** Skip the email dispatch (useful for internal-only events) */
  skipNotify?: boolean;
  /** Manual recipient list — overrides chain auto-detection */
  notifyOverride?: string[];
  /** Identifier for who triggered this — e.g. 'paperclip:scout' or userId */
  notifiedBy?: string;
};

export type RecordedDealUpdate = {
  id: string;
  trackUrl: string | null;
  notifiedTo: string[];
};

/**
 * Records a DealUpdate, ensures a TrackToken exists for the related
 * QuoteRequest / Deal, and dispatches a notification email to every
 * party in the chain (or the override list).
 */
export async function recordDealUpdate(
  input: RecordUpdateInput,
): Promise<RecordedDealUpdate> {
  if (!input.dealId && !input.quoteRequestId) {
    throw new Error('recordDealUpdate: dealId or quoteRequestId required');
  }

  // 1. Make sure a TrackToken exists for whichever entity we have.
  const trackToken = await ensureTrackToken({
    dealId: input.dealId,
    quoteRequestId: input.quoteRequestId,
  });

  // 2. Resolve the chain — every email we should notify.
  const chain = input.notifyOverride
    ? { recipients: dedupeEmails(input.notifyOverride), context: null }
    : await resolveChain(input);

  // 3. Build a placeholder DealUpdate row so we can include the URL in
  //    the email and persist who-was-notified.
  const visibility = input.visibility ?? 'public';
  const created = await database.dealUpdate.create({
    data: {
      dealId: input.dealId,
      quoteRequestId: input.quoteRequestId,
      kind: input.kind,
      title: input.title,
      detail: input.detail,
      metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
      visibility,
      notifiedBy: input.notifiedBy,
      notifiedTo: [],
    },
  });

  // 4. Dispatch emails (graceful — failure does not block the record).
  let notifiedTo: string[] = [];
  if (!input.skipNotify && chain.recipients.length > 0) {
    const trackUrl = trackToken
      ? `${getWebOrigin()}/track/${trackToken.token}`
      : null;

    const emailCtx: UpdateEmailContext = {
      title: input.title,
      detail: input.detail,
      kind: input.kind,
      metadata: input.metadata,
      trackUrl,
      property: chain.context?.property ?? null,
      offer: chain.context?.offer ?? null,
    };

    const rendered = renderUpdateEmail(emailCtx);

    for (const recipient of chain.recipients) {
      const result = await sendEmail({
        to: recipient,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      }).catch((err) => {
        console.warn('[deal-updates] send failed', recipient, err);
        return { skipped: true, reason: 'error' as const };
      });
      if (!('skipped' in result) || !result.skipped) {
        notifiedTo.push(recipient);
      } else if (result.reason !== 'error') {
        // resend not configured — still log the recipient so we know who
        // we *would* have notified
        notifiedTo.push(`${recipient} (skipped:${result.reason})`);
      }
    }
  }

  if (notifiedTo.length > 0) {
    await database.dealUpdate.update({
      where: { id: created.id },
      data: { notifiedTo },
    });
  }

  return {
    id: created.id,
    trackUrl: trackToken
      ? `${getWebOrigin()}/track/${trackToken.token}`
      : null,
    notifiedTo,
  };
}

// ---------------------------------------------------------------------------
// Track token
// ---------------------------------------------------------------------------

export async function ensureTrackToken(input: {
  dealId?: string;
  quoteRequestId?: string;
}): Promise<{ token: string }> {
  const where = input.dealId
    ? { dealId: input.dealId }
    : { quoteRequestId: input.quoteRequestId! };
  const existing = await database.trackToken.findFirst({ where });
  if (existing) return { token: existing.token };

  const token = generateToken();
  const created = await database.trackToken.create({
    data: {
      token,
      dealId: input.dealId,
      quoteRequestId: input.quoteRequestId,
    },
  });
  return { token: created.token };
}

function generateToken(): string {
  // 24 chars of url-safe base64 from random bytes
  const bytes = new Uint8Array(18);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = (Math.random() * 256) | 0;
  }
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ---------------------------------------------------------------------------
// Chain resolution
// ---------------------------------------------------------------------------

type ChainContext = {
  property: { address: string; postcode: string } | null;
  offer: { offerPence: number; completionDays: number } | null;
};

async function resolveChain(input: RecordUpdateInput): Promise<{
  recipients: string[];
  context: ChainContext;
}> {
  const recipients = new Set<string>();
  let property: ChainContext['property'] = null;
  let offer: ChainContext['offer'] = null;

  if (input.quoteRequestId) {
    const q = await database.quoteRequest.findUnique({
      where: { id: input.quoteRequestId },
      include: { offer: true },
    });
    if (q) {
      property = { address: q.address, postcode: q.postcode };
      if (q.offer) {
        offer = {
          offerPence: q.offer.offerPence,
          completionDays: q.offer.completionDays,
        };
      }
      // Seller / agent / solicitor — currently we have only the submitter
      // email. Future: separate seller-vs-agent capture during chat.
      if (q.contactEmail) recipients.add(q.contactEmail);

      // If a referral code was used, email the agent account
      if (q.referralCode) {
        const agent = await database.agentAccount.findUnique({
          where: { referralCode: q.referralCode },
        });
        if (agent?.email) recipients.add(agent.email);
      }
    }
  }

  if (input.dealId) {
    const d = await database.deal.findUnique({
      where: { id: input.dealId },
    });
    if (d) {
      if (!property) {
        property = { address: d.address, postcode: d.postcode };
      }
      if (d.sellerEmail) recipients.add(d.sellerEmail);
    }
  }

  // Always notify Bellwoods Lane founder
  recipients.add(getFounderEmail());

  return {
    recipients: dedupeEmails(Array.from(recipients)),
    context: { property, offer },
  };
}

function dedupeEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of emails) {
    const norm = e.trim().toLowerCase();
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    out.push(e.trim());
  }
  return out;
}

function getFounderEmail(): string {
  return (
    process.env.BELLWOODS_FOUNDER_EMAIL || 'anthony@bellwoodslane.co.uk'
  );
}

function getWebOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3001'
  ).replace(/\/$/, '');
}
