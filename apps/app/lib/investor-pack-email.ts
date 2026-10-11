/**
 * The "new deal" email that goes to each investor when a pack is sent.
 *
 * Deliberately short: a hero photo, the headline, the snippet, the price and
 * the date interest closes, then one button to the full pack. The pack page
 * does the persuading; the email only has to earn the click. Styling mirrors
 * packages/deal-updates/src/email-templates.ts (cream ground, forest ink,
 * Georgia for Libre Caslon, which does not load in email clients).
 *
 * Pure function so it can be unit-tested without a database or Resend.
 */

import { brand } from '@repo/brand';

export type PackEmailContext = {
  investorLabel: string;
  headline: string;
  snippet: string;
  /** e.g. "3 bed terraced house · NG7" (never the full address) */
  propertyLine: string;
  pricePence: number;
  marketValuePence: number | null;
  heroPhotoUrl: string | null;
  closesAt: Date;
  packUrl: string;
};

export function formatPounds(pence: number): string {
  return `£${Math.round(pence / 100).toLocaleString('en-GB')}`;
}

export function formatCloseDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/London',
  });
}

export function renderPackEmail(ctx: PackEmailContext): {
  subject: string;
  html: string;
  text: string;
} {
  const price = formatPounds(ctx.pricePence);
  const closes = formatCloseDate(ctx.closesAt);
  const belowValue =
    ctx.marketValuePence && ctx.marketValuePence > ctx.pricePence
      ? `${formatPounds(ctx.marketValuePence)} market value`
      : null;

  const subject = `New off-market deal: ${ctx.headline}`;

  const hero = ctx.heroPhotoUrl
    ? `<img src="${escapeAttr(ctx.heroPhotoUrl)}" alt="" width="496" style="display:block;width:100%;max-width:496px;height:auto;margin:24px 0 0;border-radius:2px" />`
    : '';

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#F7F3EA;color:#1F332B">
      <p style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1F332B;letter-spacing:-0.03em;margin:0">
        ${escapeHtml(brand.mark)}
      </p>
      <p style="margin:24px 0 0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#2E7D5B">
        Off-market · for ${escapeHtml(ctx.investorLabel)}
      </p>
      <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:600;line-height:1.2;margin:8px 0 0;color:#1F332B">
        ${escapeHtml(ctx.headline)}
      </h1>
      <p style="margin:6px 0 0;font-size:14px;color:#4C5A50">${escapeHtml(ctx.propertyLine)}</p>
      ${hero}
      <p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:#1F332B">${escapeHtml(ctx.snippet).replace(/\n/g, '<br/>')}</p>
      <div style="margin:24px 0 0;padding:16px;background:#EDE7D8;border:1px solid #E2DCCB;border-radius:2px">
        <p style="margin:0;font-size:22px;font-family:Georgia,serif;font-weight:700;color:#1F332B">${price}</p>
        ${belowValue ? `<p style="margin:4px 0 0;font-size:13px;color:#4C5A50">Against ${escapeHtml(belowValue)}</p>` : ''}
        <p style="margin:8px 0 0;font-size:13px;color:#4C5A50">Interest closes ${escapeHtml(closes)}.</p>
      </div>
      <p style="margin:28px 0 0">
        <a href="${escapeAttr(ctx.packUrl)}" style="display:inline-block;background:#1F332B;color:#F7F3EA;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:2px">View the full pack</a>
      </p>
      <p style="margin:28px 0 0;font-size:13px;color:#4C5A50;line-height:1.6">
        This link is yours alone. Please don't forward it. If the deal isn't for you, no reply is needed.
      </p>
      <p style="margin:32px 0 0;font-family:'Courier New',monospace;font-size:11px;color:#4C5A50;border-top:1px solid #E2DCCB;padding-top:16px">
        ${escapeHtml(brand.legalName)} · Property Redress Scheme (PRS) · HMRC AML supervised · ICO registered
      </p>
    </div>
  `;

  const text = [
    ctx.headline,
    ctx.propertyLine,
    '',
    ctx.snippet,
    '',
    `Price: ${price}${belowValue ? ` (against ${belowValue})` : ''}`,
    `Interest closes ${closes}.`,
    '',
    `View the full pack: ${ctx.packUrl}`,
    '',
    "This link is yours alone. Please don't forward it.",
    `${brand.legalName}`,
  ].join('\n');

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
