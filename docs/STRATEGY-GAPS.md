# Strategy → Product Gap Analysis

**Date:** 2026-06-27 · **Lens:** what the strategy (Decision Stack, PRDs,
roadmap) says we want vs what the code actually does. Companion to
`docs/CODE-REVIEW.md` (which covered code quality/scale). This one is about
**missing functionality & opportunities**, laddered to the Bets.

**Altitude:** pragmatic / ship-focused.

---

## Headline

**The product is more complete than a first code-read suggests.** The AVM
back-test, investor feed + sourcing-fee lifecycle, batch upload v2, short-lease
scout, and the agent quote→signed-PDF path are all **built**. So the biggest
opportunities are **finish & switch on**, not **build new**.

Status tags below: **IMPLEMENTED · PARTIAL · STUB · MISSING**.

---

## 1. Built but NOT switched on — fastest ROI

These exist in code and just need wiring/config. Highest leverage per hour.

| Capability | Status | Evidence | What's needed |
|:--|:--|:--|:--|
| **Short-lease scout** (marriage-value motivated sellers) | **PARTIAL (off)** | `packages/scouting/src/short-lease.ts` + tests; cron flag `scanShortLeases: false` in `apps/api/app/cron/scouting/route.ts` | Flip on + supply target postcodes (`shortLeaseSeeds`). A whole lead source sitting dark. |
| **Multi-touch outreach** (4–5 touch DTV sequences) | **PARTIAL (touch 1 only)** | Schema has `sequence`/`delayDays`/`currentStep` (`OutreachTemplate`/`OutreachRecipient`); `apps/api/app/cron/pipeline-outreach/route.ts` only sends `templates[0]` | Cron loop: send next template when `lastSentAt + delayDays < now` and `currentStep < total`. Roadmap #4. |
| **CRM loop** (`/save-the-sale` → Contact → outreach) | **PARTIAL** | `Contact` model exists; `apps/web/app/api/quote/route.ts` creates `QuoteRequest` + `AgentAccount` but **never a `Contact`** | Auto-create/link a `Contact` on submission and enrol in a nurture sequence. Decision Stack "Later". |

---

## 2. Silent risks that undermine a Bet — fix first

| Risk | Status | Evidence | Impact |
|:--|:--|:--|:--|
| **Synthetic EPC feeding the AVM** | **FIXED (this PR)** | `packages/property-data/src/epc.ts` fabricated EPC with `Math.random()` on fallback; consumed without `.catch` by `packages/valuation/src/base-valuation.ts:221`; `:243` `effectiveFloorArea = floorAreaSqm ?? epc.floorAreaSqm` | A random 60–200 m² floor area could drive the £/sqft number on a **binding offer**. Now returns an honest "unavailable" reading; synthetic is dev opt-in (`EPC_ALLOW_SYNTHETIC=true`). Protects Bet 2 / KR1.2. |
| **EPC endpoint retired (May 2026)** | **NEEDS VERIFY** | `epc.ts` base URL `epc.opendatacommunities.org/api/v1/domestic/search` flagged retired in `docs/SOURCING-PLAYBOOK.md` | With the synthetic fix above, a dead endpoint now degrades to "unavailable" (safe) — but confirm the live Open Data Communities endpoint and update if moved, or EPC signal is simply absent. |
| **4-hour SLA is founder-side, not agent-receipt** | **PARTIAL** | Signed PDF drafted by `apps/api/app/cron/quote-ops/route.ts` with a 4h *internal approval* `expiresAt`; agent only receives it after founder approval; breaches create a dashboard `FounderAction` only | KR2.3 (≥90% within 4h) has no real-time push. `@repo/notifications` (Knock) is **stubbed/unused**. Opportunity: wire a push (Slack/WhatsApp/email) on SLA-breach + a true visible countdown. Do **not** auto-send (safety rail). |

---

## 3. Accuracy gaps for whole channels — Bet 2

| Gap | Status | Evidence | Opportunity |
|:--|:--|:--|:--|
| **Auction discount rule** (≈10% below reserve → target 30% below market) | **MISSING** | Route enum + modern-auction fee handling exist in `packages/valuation` (`deal-model.ts`), but no 10%/30% formula in `offer-calculation.ts` | Auction lots are appraised without the auction policy. Roadmap "Next". Infra ready; just the formula. |
| **Receiver / mortgagee "forced sale" flag** | **MISSING** | No parsing of "by order of mortgagee" / "LPA receiver" in `packages/auctions/src/sources/*` | The strongest auction motivation signal is dropped. Add text parsing → scoring bonus. |
| **Price-reduction → offer calc** | **PARTIAL** | `daysOnMarket`/`priceChangeCount` feed lead scoring (`packages/scouting/src/scorer.ts`) but **not** the AVM offer adjustment | Wire into the offer % so we sharpen on genuinely stale/distressed stock. Roadmap "Next". |
| **Auction feed reliability** | **PARTIAL** | 3 brittle HTML scrapers (Auction House / Savills / Clive Emson); EIG aggregator absent | EIG (~£525/yr, ~70% coverage) replaces 3 fragile scrapers. Cost decision; defer until volume justifies. |

---

## 4. Agent-channel completion — Bet 1 promises

| Capability | Status | Evidence | Note |
|:--|:--|:--|:--|
| **Resale / exit dispatch** (agent re-lists when we sell) | **STUB** | `apps/app/app/actions/deals/release-for-resale.ts` sets the flag only; no dispatch to the originating agent | Closes a Bet 1 relationship promise. Decision Stack "Later". |
| **E-signing** | **MISSING** | Binding offer is a pre-signed PDF (`packages/quote-ops/src/render-pdf.ts`) needing manual print/sign/return; no DocuSeal/PandaDoc | Friction on the "certainty" promise. A simple e-sign integration speeds completion. |
| **NTSELAT seller-disclosure / referral-fee pack** (PRD F05) | **MISSING** | Referenced in the agent portal; **no generator** found | A *compliance* gap for the agent channel (TPO / DMCC Act / referral-fee disclosure). Worth prioritising before scaling agent volume. |
| **Calendly booking** | **STUB** | `@repo/calendly` has link-gen + webhook-verify but is **not wired** into the flow; no `invitee.created` listener | Booking the vendor call (the "thought" that matters) is currently manual. |
| **WhatsApp intake** | **IMPLEMENTED (experimental)** | `@repo/whatsapp-parser` + `services/whatsapp-bridge` (whatsapp-web.js) | Works but long-running (not serverless) and against WhatsApp ToS — move to the official Cloud API for production. |

---

## 5. Flywheel opportunity — Bet 3 ("operator gets smarter")

- **`FounderFeedback` + `EvalConfig` exist** (the strategy wants founder decisions
  to *train* the scoring/eval weights). The `agents/export` endpoint already
  shapes feedback into training data.
- **Open question to confirm:** is the loop actually *closed* — does feedback
  feed back into `EvalConfig` weights that change future scoring, or is it only
  exported? If it's export-only, closing it is the highest-leverage "compounding"
  investment for a solo operator. Worth a focused check.

---

## 6. Data backbone status (reference)

| Source | Status | File |
|:--|:--|:--|
| Probate — The Gazette | **IMPLEMENTED** (free) | `packages/scouting/src/gazette.ts` |
| Probate — HMCTS | **STUB** (no public API; returns `[]` by design) | `packages/scouting/src/probate-data.ts` |
| PropertyData `/sourced-properties` (distressed/BMV) | **IMPLEMENTED** (paid) | `propertydata/endpoints/sourced.ts` |
| Short-lease (`/freeholds`) | **IMPLEMENTED** (opt-in) | `registered-leases.ts` + `scouting/short-lease.ts` |
| EPC open data | **AT-RISK** (endpoint retired; now degrades safely to "unavailable") | `packages/property-data/src/epc.ts` |
| HMLR Price Paid | **IMPLEMENTED** (free) | `packages/property-data/src/hmlr.ts` |
| Companies House | **IMPLEMENTED** (free) | `packages/property-data/src/companies-house.ts` |
| Auction scrapers | **PARTIAL/FRAGILE** | `packages/auctions/src/sources/*` |

---

## 7. Recommended sequence

Ordered by leverage × effort × risk, ship-focused:

1. **EPC synthetic-data safety fix** — *done in this PR*. Protects Bet 2.
2. **Switch on short-lease scout** — config + your target postcodes (a founder
   decision). Near-zero code; unlocks a source.
3. **Wire multi-touch outreach** — schema-ready; one cron loop. Grows DTV funnel.
4. **CRM auto-Contact from `/save-the-sale`** — closes Bet 1 → Bet 3 loop.
5. **SLA push notification + true countdown** — gives KR2.3 teeth (no auto-send).
6. **Price-reduction → offer calc** and **auction discount rule** — Bet 2 accuracy.
7. **Confirm/close the FounderFeedback → EvalConfig flywheel** — Bet 3 compounding.
8. **Later / cost-gated:** EIG auction feed, e-signing, NTSELAT pack, Calendly
   wiring, official WhatsApp Cloud API.

*Snapshot — update as items are actioned.*
