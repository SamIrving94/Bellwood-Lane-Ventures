# Legal: anchoring conveyancing to Orbital

**Status:** adopted 2026-08 · **Owner:** founder · **Code:** `packages/database/legal-steps.ts`, `apps/api/app/cron/legal-chaser/route.ts`, `apps/app/app/actions/legal/steps.ts`

## The decision

We do **not** build conveyancing software. We anchor to **Orbital** — the
AI platform that already automates title review, lease/contract-pack review,
searches analysis and enquiry drafting for UK conveyancers — by **instructing
panel firms that run it**, and drive those firms hard with our own
checklist + chaser machinery.

## Why Orbital

- **Scale proof:** ~200,000 supported transactions in 2025; $60M Series B
  (Jan 2026) to expand the platform.
- **Residential-specific product:** *Orbital Residential* automates lease,
  title register and contract-pack review, answers 300+ standard checks and
  drafts enquiries — exactly the slow middle of a purchase.
- **They now run their own firm:** **Farringdon** (launched April 2026,
  CLC-regulated, London) is Orbital's AI-native conveyancing firm, taking
  instructions from May 2026 via a referral-partner model (JLL signed at
  launch). Farringdon's workflows feed back into the tech used by every
  Orbital firm.

## What "anchoring" means in practice

Orbital sells to **conveyancers, not buyers** — there is no buyer-side API.
So the integration is commercial + operational, not code-to-code:

1. **Panel selection.** Instruct firms that run Orbital Residential.
   Known Orbital users to approach: **Enact, Simply Conveyancing, Sort
   Legal, Blacks, Knights** — plus **Farringdon** directly as a referral
   partner once buy-side instructions open up.
2. **Volume deal.** We are the dream client: chain-free cash buyer,
   repeatable instruction, clean AML file, searches money on day one.
   Negotiate a fixed fee + SLA per purchase (target: exchange in ~5-6 weeks,
   completion ~6-7 — vs the 12-20 week market average).
3. **Our machinery drives their machinery:**
   - `LEGAL_STEPS` (12-step cash-purchase checklist, per-step target days)
     seeds automatically when a deal goes `under_offer`.
   - The **legal-chaser cron** (weekday 09:30) finds solicitor-owned steps
     past target, drafts a chaser email, and raises a `legal_flag`
     FounderAction. **Never auto-sent** — founder reviews and fires from
     the deal page.
   - Searches are ordered **day one, not week three** — it's a named step
     with `targetDay: 2` and the single biggest drag in market data
     (local-authority searches: 2-8 weeks).

## Guardrails

- Target days in `legal-steps.ts` are **internal ops targets**. Never quote
  them to vendors — the live-site promise (offer in 24-48h of viewing,
  completion in weeks not months) is the only external commitment.
- Chasers are founder-reviewed before sending, same as vendor outreach.
- If docs and the live site disagree, the live site wins.

## Later (not now)

- Inbound document intake: the Postmark webhook already classifies
  `lease | contract` PDFs into `DocumentExtract`; wiring those to
  `LegalDocument` rows per deal would give a solicitor-independent paper
  trail.
- If Orbital ever exposes a client-side status API (Farringdon may), the
  chaser cron is the natural consumer — swap "draft an email" for "read
  matter status, only chase on real stalls".
