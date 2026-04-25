/**
 * Email templates for deal-timeline updates.
 *
 * One render function with a kind-aware switch for headline copy.
 * Visual style mirrors the public site (navy/gold/cream, Georgia for
 * headlines, Inter/Arial for body).
 */

import 'server-only';

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
    subjectPrefix: 'Welcome to Bellwoods Lane',
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
        <div style="margin:24px 0;padding:16px;background:#FAF6EA;border-radius:12px">
          <p style="margin:0;font-size:13px;color:#0A1020">
            <strong>Live timeline:</strong>
            <a href="${ctx.trackUrl}" style="color:#0A2540">${ctx.trackUrl}</a>
          </p>
          <p style="margin:6px 0 0;font-size:12px;color:#6B7280">
            Open this link any time to see every step. No login.
          </p>
        </div>`
    : '';

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#FAFAF7;color:#0A1020">
      <p style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#0A2540;letter-spacing:-0.02em;margin:0">
        BELLWOODS LANE
      </p>
      <p style="margin:24px 0 0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#C6A664">
        ${escapeHtml(copy.eyebrow)}
      </p>
      <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:600;line-height:1.2;margin:8px 0 0;color:#0A1020">
        ${escapeHtml(ctx.title)}
      </h1>
      ${
        propertyLabel
          ? `<p style="margin:6px 0 0;font-size:14px;color:#6B7280">${escapeHtml(propertyLabel)}</p>`
          : ''
      }
      ${
        ctx.detail
          ? `<p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:#0A1020">${escapeHtml(ctx.detail).replace(/\n/g, '<br/>')}</p>`
          : ''
      }
      ${
        offerLine
          ? `<p style="margin:18px 0 0;font-size:14px;color:#0A1020"><strong>${escapeHtml(offerLine)}</strong></p>`
          : ''
      }
      ${trackBlock}
      <p style="margin:32px 0 0;font-size:13px;color:#6B7280;line-height:1.6">
        Anyone in the chain — seller, agent, solicitor — gets the same
        update at the same moment. If anything looks wrong, reply to this
        email or call us directly.
      </p>
      <p style="margin:32px 0 0;font-family:'Courier New',monospace;font-size:11px;color:#94A3B8;border-top:1px solid #E5E7EB;padding-top:16px">
        Bellwoods Lane Ltd · NAPB · TPO · HMRC AML supervised
      </p>
    </div>
  `;

  const text = [
    `BELLWOODS LANE`,
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
