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
import { put } from '@vercel/blob';
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
  const lockedUntil = new Date(issuedAt.getTime() + 14 * 24 * 3600_000);

  const offerPence =
    appraisal.bidCap?.hardCapPence ?? appraisal.arv.pointEstimatePence;
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
          `Completion target 14–28 days from acceptance.`
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
        `This offer is binding on ${brand.legalName} subject only to the carve-outs below. There is no chain. There is no mortgage finance condition. Funds are confirmed prior to instruction.`
      ),
      React.createElement(
        Text,
        { style: { ...styles.paragraph, ...styles.label } },
        'RICS-defect carve-out'
      ),
      React.createElement(
        Text,
        { style: styles.paragraph },
        `This offer is conditional on no major undisclosed defect being identified by an independent RICS Level 2 or Level 3 survey instructed by ${brand.shortName} within 7 days of acceptance. A major undisclosed defect means any defect not previously disclosed AND with estimated remediation cost of 5% or more of the offer value.`
      ),
      React.createElement(
        Text,
        { style: { ...styles.paragraph, ...styles.label } },
        'Title and legal carve-outs'
      ),
      React.createElement(
        Text,
        { style: styles.paragraph },
        'Conditional on marketable title, no undisclosed leasehold issues, and no outstanding consent or planning enforcement that materially affects value.'
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
        `${brand.legalName} (trading as ${brand.name}). Registered in England & Wales, Company No. ${brand.companyNumber}. This is a binding offer issued pursuant to the Consumer Protection from Unfair Trading Regulations 2008 and is subject to the carve-outs above.`
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
