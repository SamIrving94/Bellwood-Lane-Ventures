/**
 * Email templates for deal-timeline updates.
 *
 * One render function with a kind-aware switch for headline copy.
 * Visual style mirrors the Kept public site (cream ground, forest ink, leaf
 * for links, Courier for document labels). Georgia stands in for Libre Caslon:
 * webfonts do not load reliably in email clients, and Georgia is the documented
 * fallback in docs/brand/KEPT.md.
 *
 * Name, legal entity and domain come from @repo/brand so the whole ecosystem
 * turns over with NEXT_PUBLIC_BRAND_PHASE.
 */

import 'server-only';

import { brand } from '@repo/brand';
import type { DealUpdateKind } from '@repo/database';

export type UpdateEmailContext = {
  title: string;
  detail?: string;
  kind: DealUpdateKind;
  metadata?: Record<string, unknown>;
  trackUrl: string | null;
  property: { address: string; postcode: string } | null;
  offer: { offerPence: number; completionDays: number } | null;
};

const KIND_COPY: Record<
  DealUpdateKind,
  { eyebrow: string; subjectPrefix: string }
> = {
  quote_requested: {
    eyebrow: 'Quote received',
    subjectPrefix: 'Your cash offer is being prepared',
  },
  offer_sent: {
    eyebrow: 'Offer issued',
    subjectPrefix: 'Your binding cash offer',
  },
  offer_accepted: {
    eyebrow: 'Offer accepted',
    subjectPrefix: `Welcome to ${brand.name}`,
  },
  offer_declined: {
    eyebrow: 'Offer declined',
    subjectPrefix: 'Your offer status',
  },
  offer_expired: {
    eyebrow: 'Offer expired',
    subjectPrefix: 'Your offer has expired',
  },
  solicitor_instructed: {
    eyebrow: 'Solicitor instructed',
    subjectPrefix: 'Solicitor instructed on your sale',
  },
  searches_ordered: {
    eyebrow: 'Searches ordered',
    subjectPrefix: 'Local searches ordered',
  },
  survey_scheduled: {
    eyebrow: 'Survey scheduled',
    subjectPrefix: 'Survey booked',
  },
  survey_completed: {
    eyebrow: 'Survey completed',
    subjectPrefix: 'Survey results',
  },
  enquiries_raised: {
    eyebrow: 'Enquiries raised',
    subjectPrefix: 'Solicitor enquiries',
  },
  enquiries_resolved: {
    eyebrow: 'Enquiries resolved',
    subjectPrefix: 'Enquiries resolved',
  },
  exchange_target_set: {
    eyebrow: 'Exchange target set',
    subjectPrefix: 'Exchange target',
  },
  exchanged: {
    eyebrow: 'Exchanged',
    subjectPrefix: 'Contracts exchanged',
  },
  completion_target_set: {
    eyebrow: 'Completion target',
    subjectPrefix: 'Completion target',
  },
  completed: {
    eyebrow: 'Completed',
    subjectPrefix: 'Completion confirmed',
  },
  delay: {
    eyebrow: 'Delay',
    subjectPrefix: 'Update on your sale',
  },
  founder_review: {
    eyebrow: 'Founder review',
    subjectPrefix: 'Personal review on your offer',
  },
  resale_listed: {
    eyebrow: 'Resale listed',
    subjectPrefix: 'Resale instruction confirmed',
  },
  note: {
    eyebrow: 'Update',
    subjectPrefix: 'Update on your sale',
  },
};

export function renderUpdateEmail(ctx: UpdateEmailContext): {
  subject: string;
  html: string;
  text: string;
} {
  const copy = KIND_COPY[ctx.kind] ?? KIND_COPY.note;

  const propertyLabel = ctx.property
    ? `${ctx.property.address}, ${ctx.property.postcode}`
    : null;

  const subject = propertyLabel
    ? `${copy.subjectPrefix} · ${propertyLabel}`
    : copy.subjectPrefix;

  const offerLine = ctx.offer
    ? `Cash offer: £${Math.round(ctx.offer.offerPence / 100).toLocaleString('en-GB')} · target completion ${ctx.offer.completionDays} days`
    : '';

  const trackBlock = ctx.trackUrl
    ? `
        <div style="margin:24px 0;padding:16px;background:#EDE7D8;border:1px solid #E2DCCB;border-radius:2px">
          <p style="margin:0;font-size:13px;color:#1F332B">
            <strong>Live timeline:</strong>
            <a href="${ctx.trackUrl}" style="color:#2E7D5B">${ctx.trackUrl}</a>
          </p>
          <p style="margin:6px 0 0;font-size:12px;color:#4C5A50">
            Open this link any time to see every step. No login.
          </p>
        </div>`
    : '';

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#F7F3EA;color:#1F332B">
      <p style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1F332B;letter-spacing:-0.03em;margin:0">
        ${escapeHtml(brand.mark)}
      </p>
      <p style="margin:24px 0 0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#2E7D5B">
        ${escapeHtml(copy.eyebrow)}
      </p>
      <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:600;line-height:1.2;margin:8px 0 0;color:#1F332B">
        ${escapeHtml(ctx.title)}
      </h1>
      ${
        propertyLabel
          ? `<p style="margin:6px 0 0;font-size:14px;color:#4C5A50">${escapeHtml(propertyLabel)}</p>`
          : ''
      }
      ${
        ctx.detail
          ? `<p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:#1F332B">${escapeHtml(ctx.detail).replace(/\n/g, '<br/>')}</p>`
          : ''
      }
      ${
        offerLine
          ? `<p style="margin:18px 0 0;font-size:14px;color:#1F332B"><strong>${escapeHtml(offerLine)}</strong></p>`
          : ''
      }
      ${trackBlock}
      <p style="margin:32px 0 0;font-size:13px;color:#4C5A50;line-height:1.6">
        Anyone in the chain — seller, agent, solicitor — gets the same
        update at the same moment. If anything looks wrong, reply to this
        email and a person will pick it up.
      </p>
      <p style="margin:32px 0 0;font-family:'Courier New',monospace;font-size:11px;color:#4C5A50;border-top:1px solid #E2DCCB;padding-top:16px">
        ${escapeHtml(brand.legalName)} · Property Redress Scheme (PRS) · HMRC AML supervised · ICO registered
      </p>
    </div>
  `;

  const text = [
    brand.mark,
    `${copy.eyebrow.toUpperCase()}`,
    ``,
    ctx.title,
    propertyLabel ? `(${propertyLabel})` : '',
    ``,
    ctx.detail ?? '',
    offerLine,
    ctx.trackUrl ? `\nLive timeline: ${ctx.trackUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
