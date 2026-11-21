_Last verified against the live site: 2026-11-17_

> **This file is a summary, not the source.** The wording that is actually
> sent lives in `packages/quote-ops/src/render-pdf.ts`. The promises it must
> match live on the site: `/sell` (FAQ) and `/legal/fca-disclosure`. If this
> file disagrees with either, this file is wrong.

# BINDING OFFER — {{address}}

**Bellwoods Lane Ventures Ltd** (trading as Kept)
Registered in England & Wales · Company No. 16454416

---

**Date issued:** {{issueDate}}
**Offer reference:** {{quoteRequestId}}
**Locked until:** {{lockedUntil}} _(14 days from the date issued — founder decision, Nov 2026. The site promises a week; this letter holds for longer, never shorter.)_

---

## Dear {{recipientName}},

Following our review of the property at **{{address}}, {{postcode}}** introduced by {{agentFirm}}, we are pleased to confirm the following binding cash purchase offer.

## Property

- **Address:** {{address}}, {{postcode}}
- **Description:** {{propertyTypeDescribed}}
- **EPC:** {{epcRating}}
- **Floor area:** {{floorAreaSqm}} m²

## Valuation

- **Indicative AVM range (80% CI):** {{avmMinFormatted}} – {{avmMaxFormatted}}
- **ARV point estimate:** {{arvFormatted}}
- **Confidence:** {{confidenceLevel}} (±{{estimatedErrorPercent}}%)

## Offer

- **Cash offer:** **{{offerFormatted}}**
- **Completion target:** 14–28 days from acceptance

## Terms and warranties (binding)

This offer is binding upon Bellwoods Lane Ventures Ltd for 14 days from the date issued, subject only to the three exceptions below. There is no chain. There is no mortgage finance condition. Funds are confirmed prior to instruction.

### 1. A material defect found on survey

An independent RICS Level 2 or Level 3 survey, instructed by Kept within 7 days of acceptance, identifies a material defect that was not visible or disclosed at viewing. A material defect means one with an estimated remediation cost of 5% or more of the offer value.

### 2. A title issue

A title issue emerges during conveyancing that materially affects value: title that is not marketable, an undisclosed leasehold issue, or an outstanding consent or planning enforcement matter.

### 3. Incorrect information

Information provided about the property proves materially incorrect.

If one of these applies we will explain it in writing. The seller may accept a revised price or walk away at no cost.

> **Rule:** three exceptions, no more. They are the three the live site
> promises. A fourth here would be a promise broken in writing.

> **Note (2026-08):** the former "walk-away cover" (£1,000 compensation on
> uncarved withdrawal) was retired in the July 2026 terms review. It must not
> appear in offers, emails, or marketing copy.

## The seller's position

This offer is not binding upon the seller until exchange of contracts. The seller may withdraw at any point before exchange at no cost. Kept charges the seller no fee at any point. The seller instructs their own solicitor and pays their costs; we pay ours. We encourage the seller to take independent legal advice before accepting.

## Methodology

Triangulated from HMLR Price Paid comparables, HMLR HPI regional trend, EPC register data, and a deep-appraisal pass run on {{issueDate}}. {{arvReasoning}}

## Acceptance

To accept, please countersign below and return to **sam@wearekept.co.uk**. On acceptance Kept will instruct conveyancers within 1 working day.

---

**Signed for and on behalf of Bellwoods Lane Ventures Ltd**

_________________________________
Sam Irving — Director
Date: {{issueDate}}

---

**Accepted by seller / authorised representative**

Signature: _________________________________

---

_Bellwoods Lane Ventures Ltd (trading as Kept). Registered in England & Wales, Company No. 16454416. This offer is binding upon Bellwoods Lane Ventures Ltd for 14 days from the date issued, subject to the three exceptions above. Kept is a cash property buyer, not an FCA-authorised firm, and this letter is not financial or legal advice._

---

## Not yet reviewed by a lawyer

This wording has been brought in line with the live site. It has **not** had
external legal review. Open points for that review:

- No statute is cited. The old footer cited the Consumer Protection from
  Unfair Trading Regulations 2008, which no longer apply; it was removed
  rather than replaced.
- The valuation block still shows an "Indicative AVM range (80% CI)". Check
  the label is accurate and whether the range belongs in the letter at all.
- The letter is addressed to the introducing agent by default, not the seller.
- There is no complaints or redress route in the letter.
