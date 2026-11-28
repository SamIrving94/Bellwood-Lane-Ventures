/**
 * Signed binding-offer PDF generator.
 *
 * Pure-JS via @react-pdf/renderer — no Chrome download, no puppeteer
 * cold-start hit. Renders to a buffer, then uploads to Vercel Blob.
 *
 * The visual structure mirrors docs/templates/binding-offer-letter.md so the
 * legal copy and the rendered PDF stay aligned. We do NOT read the template
 * at runtime; the wording lives in this file so the build can ship without
 * extra fs reads on a serverless function.
 */

import 'server-only';

import {
  Document,
  type DocumentProps,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer';
import { put } from '@repo/storage';
import * as React from 'react';

import { brand } from '@repo/brand';
import type { PdfInput } from './types';

// Kept. offer letter — cream paper, serif (Times) letterhead + figure, Courier
// typed labels, forest ink, the cash figure and the offer box carry the wax
// promise accent (the seal). Colours are the Kept tokens (docs/brand/KEPT.md);
// only @react-pdf built-in font families are used, so no TTF registration.
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    lineHeight: 1.5,
    fontFamily: 'Helvetica', // body / UI (Roboto-equivalent)
    color: '#1f332b', // forest ink
    backgroundColor: '#f7f3ea', // cream paper
  },
  header: {
    fontSize: 16,
    fontFamily: 'Times-Bold', // serif letterhead (Caslon-equivalent)
    color: '#1f332b',
    marginBottom: 8,
  },
  company: {
    fontSize: 10,
    color: '#4c5a50', // body
    marginBottom: 12,
  },
  rule: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2dccb', // hair
    marginVertical: 10,
  },
  metaRow: {
    fontSize: 9,
    fontFamily: 'Courier', // typed-document texture
    color: '#4c5a50',
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Courier-Bold', // Courier labels (PROPERTY, VALUATION…)
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#1f332b',
    marginTop: 14,
    marginBottom: 6,
  },
  paragraph: {
    marginBottom: 6,
  },
  label: { fontFamily: 'Helvetica-Bold' },
  list: { marginLeft: 12, marginBottom: 4 },
  footer: {
    marginTop: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2dccb', // hair
    fontSize: 8,
    color: '#4c5a50', // body
  },
  offerBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#ffffff', // card
    borderWidth: 1,
    borderColor: '#c33f35', // wax — the seal on the offer
    borderRadius: 4,
  },
  offerLabel: {
    fontSize: 9,
    fontFamily: 'Courier-Bold', // Courier label: OUR CASH OFFER
    color: '#c33f35', // wax — the promise moment
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  offerValue: {
    fontSize: 24,
    fontFamily: 'Times-Bold', // the figure, huge in serif
    color: '#c33f35', // wax
    marginTop: 4,
  },
  signLine: {
    marginTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f332b', // forest
    width: 220,
    height: 14,
  },
});

function formatGBP(pence: number | null | undefined): string {
  if (pence == null) return '—';
  return `£${Math.round(pence / 100).toLocaleString('en-GB')}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function BindingOfferDocument(
  props: PdfInput
): React.ReactElement<DocumentProps> {
  const {
    address,
    postcode,
    agentFirmName,
    agentContactName,
    appraisal,
    quoteId,
  } = props;
  const issuedAt = new Date();
  // 14 days, by founder decision (Nov 2026). The public promise is "binding
  // upon Kept for a week" and @repo/instant-offer locks for 7 days; this
  // signed letter deliberately holds for longer than the site promises,
  // never shorter. The letter states the 14 days in words (terms + footer),
  // so change all three together.
  const lockedUntil = new Date(issuedAt.getTime() + 14 * 24 * 3600_000);

  // Supplied by the caller. Never fall back to ARV: this document is binding,
  // and ARV is market value, not an offer.
  const { offerPence } = props;
  if (!Number.isFinite(offerPence) || offerPence <= 0) {
    throw new Error(
      'renderSignedOfferPdf: offerPence is required and must be positive — refusing to render a binding offer without an explicit price'
    );
  }
  const arvLow = appraisal.arv.ci80LowPence;
  const arvHigh = appraisal.arv.ci80HighPence;
  const confidencePercent = Math.max(
    0,
    Math.min(
      100,
      Math.round(100 - appraisal.confidence.estimatedErrorPercent * 2)
    )
  );

  const recipientName = agentContactName ?? agentFirmName ?? 'partner agent';

  return React.createElement(
    Document,
    {},
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(
        Text,
        { style: styles.header },
        `BINDING OFFER — ${address}`
      ),
      React.createElement(
        Text,
        { style: styles.company },
        `${brand.legalName} · registered in England & Wales · Company No. ${brand.companyNumber}`
      ),
      React.createElement(View, { style: styles.rule }),
      React.createElement(
        Text,
        { style: styles.metaRow },
        `Date issued: ${formatDate(issuedAt)}`
      ),
      React.createElement(
        Text,
        { style: styles.metaRow },
        `Offer reference: ${quoteId}`
      ),
      React.createElement(
        Text,
        { style: styles.metaRow },
        `Locked until: ${formatDate(lockedUntil)}`
      ),
      React.createElement(View, { style: styles.rule }),

      React.createElement(
        Text,
        { style: styles.paragraph },
        `Dear ${recipientName},`
      ),
      React.createElement(
        Text,
        { style: styles.paragraph },
        `Following our review of the property at ${address}, ${postcode}${agentFirmName ? ` introduced by ${agentFirmName}` : ''}, we are pleased to confirm the following binding cash purchase offer.`
      ),

      React.createElement(Text, { style: styles.sectionTitle }, 'Property'),
      React.createElement(
        Text,
        { style: styles.list },
        `Address: ${address}, ${postcode}`
      ),
      React.createElement(
        Text,
        { style: styles.list },
        `Description: ${appraisal.property.propertyTypeDescribed}`
      ),
      appraisal.property.epcRating
        ? React.createElement(
            Text,
            { style: styles.list },
            `EPC: ${appraisal.property.epcRating}`
          )
        : null,
      appraisal.property.floorAreaSqm
        ? React.createElement(
            Text,
            { style: styles.list },
            `Floor area: ${appraisal.property.floorAreaSqm} m²`
          )
        : null,

      React.createElement(Text, { style: styles.sectionTitle }, 'Valuation'),
      React.createElement(
        Text,
        { style: styles.list },
        `Indicative AVM range (80% CI): ${formatGBP(arvLow)} – ${formatGBP(arvHigh)}`
      ),
      React.createElement(
        Text,
        { style: styles.list },
        `ARV point estimate: ${formatGBP(appraisal.arv.pointEstimatePence)}`
      ),
      React.createElement(
        Text,
        { style: styles.list },
        `Confidence: ${appraisal.confidence.level} (±${appraisal.confidence.estimatedErrorPercent.toFixed(1)}%) · ${confidencePercent}/100`
      ),

      React.createElement(
        View,
        { style: styles.offerBox },
        React.createElement(Text, { style: styles.offerLabel }, 'Cash offer'),
        React.createElement(
          Text,
          { style: styles.offerValue },
          formatGBP(offerPence)
        ),
        React.createElement(
          Text,
          { style: { fontSize: 9, marginTop: 4 } },
          'Completion target 14–28 days from acceptance.'
        )
      ),

      React.createElement(
        Text,
        { style: styles.sectionTitle },
        'Terms and warranties (binding)'
      ),
      React.createElement(
        Text,
        { style: styles.paragraph },
        `This offer is binding upon ${brand.legalName} for 14 days from the date issued, subject only to the three exceptions below. There is no chain. There is no mortgage finance condition. Funds are confirmed prior to instruction.`
      ),
      // The three exceptions are the ones the live site promises (/sell FAQ,
      // /legal/fca-disclosure). Keep the wording and the count in step with
      // them: a fourth exception here would be a promise broken in writing.
      React.createElement(
        Text,
        { style: { ...styles.paragraph, ...styles.label } },
        '1. A material defect found on survey'
      ),
      React.createElement(
        Text,
        { style: styles.paragraph },
        `An independent RICS Level 2 or Level 3 survey, instructed by ${brand.shortName} within 7 days of acceptance, identifies a material defect that was not visible or disclosed at viewing. A material defect means one with an estimated remediation cost of 5% or more of the offer value.`
      ),
      React.createElement(
        Text,
        { style: { ...styles.paragraph, ...styles.label } },
        '2. A title issue'
      ),
      React.createElement(
        Text,
        { style: styles.paragraph },
        'A title issue emerges during conveyancing that materially affects value: title that is not marketable, an undisclosed leasehold issue, or an outstanding consent or planning enforcement matter.'
      ),
      React.createElement(
        Text,
        { style: { ...styles.paragraph, ...styles.label } },
        '3. Incorrect information'
      ),
      React.createElement(
        Text,
        { style: styles.paragraph },
        'Information provided about the property proves materially incorrect.'
      ),
      React.createElement(
        Text,
        { style: styles.paragraph },
        'If one of these applies we will explain it in writing. The seller may accept a revised price or walk away at no cost.'
      ),

      React.createElement(
        Text,
        { style: styles.sectionTitle },
        'The seller’s position'
      ),
      React.createElement(
        Text,
        { style: styles.paragraph },
        `This offer is not binding upon the seller until exchange of contracts. The seller may withdraw at any point before exchange at no cost. ${brand.shortName} charges the seller no fee at any point. The seller instructs their own solicitor and pays their costs; we pay ours. We encourage the seller to take independent legal advice before accepting.`
      ),

      React.createElement(Text, { style: styles.sectionTitle }, 'Methodology'),
      React.createElement(
        Text,
        { style: styles.paragraph },
        `Triangulated from HMLR Price Paid comparables, HMLR HPI regional trend, EPC register data, and a deep-appraisal pass run on ${formatDate(issuedAt)}. ${appraisal.arv.reasoning}`
      ),

      React.createElement(Text, { style: styles.sectionTitle }, 'Acceptance'),
      React.createElement(
        Text,
        { style: styles.paragraph },
        `To accept, please countersign below and return to ${brand.dealsEmail}. On acceptance ${brand.shortName} will instruct conveyancers within 1 working day.`
      ),

      React.createElement(View, { style: styles.signLine }),
      React.createElement(
        Text,
        { style: { fontSize: 9, marginTop: 4 } },
        `Sam Irving — Director, ${brand.legalName}`
      ),
      React.createElement(
        Text,
        { style: { fontSize: 9 } },
        `Date: ${formatDate(issuedAt)}`
      ),

      React.createElement(View, { style: styles.signLine }),
      React.createElement(
        Text,
        { style: { fontSize: 9, marginTop: 4 } },
        'Accepted by seller / authorised representative'
      ),

      React.createElement(
        Text,
        { style: styles.footer },
        `${brand.legalName} (trading as ${brand.name}). Registered in England & Wales, Company No. ${brand.companyNumber}. This offer is binding upon ${brand.legalName} for 14 days from the date issued, subject to the three exceptions above. ${brand.shortName} is a cash property buyer, not an FCA-authorised firm, and this letter is not financial or legal advice.`
      )
    )
  );
}

/**
 * Render the signed binding-offer PDF, upload to Vercel Blob and return the
 * public URL. Path: `signed-offers/<quoteId>/<timestamp>.pdf` so re-runs
 * never collide.
 */
export async function renderSignedOfferPdf(input: PdfInput): Promise<string> {
  const buffer = await renderToBuffer(BindingOfferDocument(input));
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const path = `signed-offers/${input.quoteId}/${ts}.pdf`;
  const result = await put(path, buffer, {
    access: 'public',
    contentType: 'application/pdf',
  });
  return result.url;
}
