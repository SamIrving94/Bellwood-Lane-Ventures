# PRD: Keyhole — Estate & Property Intelligence Tool (Referral-Sourcing Product)

**Document owner:** Founder
**Status:** Draft — not yet decided; see `docs/proposals/prime-2m-plus-keyhole-flip.md` for the decision framing
**Last updated:** August 2026
**Classification:** Internal — Confidential

> **Provenance:** drafted via external deep research (Aug 2026), filed
> 2026-08-29. `[cite:NN]` markers refer to the research thread and are not
> resolvable here — the evidence base is
> `docs/research/prime-sourcing-deep-research-2026-08.md`.
>
> **Two repo rules this product must respect:**
>
> 1. **No figure on screen** (founder decision, Aug 2026) applies to OUR
>    OFFER to a seller. Keyhole reports show *market-value bands and refurb
>    context* to professionals — never an offer figure. Any actual offer
>    stays person-reviewed, sent by email, after viewing.
> 2. **Public promises — live site wins.** One SLA phrase in the researched
>    draft ("can typically complete in 2 weeks") was corrected below to the
>    signed-off promise wording: "can complete in **as little as** two
>    weeks". Never state faster SLAs than the live site.

## 1. Product Name (working title)

**Keyhole** — a free condition-and-value intelligence tool for solicitors, surveyors, wealth managers and care-transition advisers handling property-holding clients.

## 2. Problem Statement

Professionals who touch a property before it's marketed (probate solicitors, RICS surveyors, private bankers, care advisers) have no fast, standardised way to give clients a condition-adjusted view of what a house is worth as-is versus refurbished. They currently rely on ad-hoc estate agent valuations (slow, biased toward listing the property with that agent) or their own judgement. Meanwhile, our company needs earlier visibility of distressed/unmodernised £700k–£3M London period houses than portals, Gazette notices and Companies House data currently give us — visibility that only exists inside these professionals' case files, weeks or months before a property reaches the open market.

## 3. Goal

Build a tool professionals genuinely want to use for their own client work, which structurally routes early-stage property leads to us as a byproduct of normal use — without compromising their professional duty to their client or requiring them to actively "sell" us anything.

## 4. Target Users

| User | Primary use case | Volume signal |
|---|---|---|
| Probate/private-client solicitors | Speed up executor decision-making on estate property | Probate is our best-evidenced discount category (10–25% below market)[cite:12] |
| RICS surveyors (probate/bank valuation instructions) | Add a value-add appendix to reports they already write | Surveyors see condition data on nearly every distressed property, often pre-instruction |
| Wealth managers / private bankers | Proactive quarterly touchpoint for clients holding inherited/second homes | UHNW/estate clients frequently hold property assets requiring periodic review |
| Care-transition / later-life advisers | Help families weigh a fast sale to fund care costs | Time-pressured, cash-need-driven sellers |

## 5. Core User Flow

1. Professional enters a UK address (single lookup, or bulk CSV for solicitors managing multiple estates).
2. Tool pulls: EPC rating/band, Land Registry sold-price history for the address and street, estimated current condition-adjusted value (unmodernised) vs comparable-refurbished value, and an indicative refurb-cost range.
3. Tool generates a one-page PDF report, branded for the professional's own use with their client (white-label / co-branded).
4. Report includes a soft, clearly-labelled panel: "If a fast, certain, cash completion is relevant here, [Company] can complete in as little as two weeks" with a one-click referral button — opt-in, never automatic.
5. If the professional or their client clicks through, we receive a warm lead with the property details already validated.

## 6. Key Features (MVP → V2)

**MVP (Month 1–3):**
- Single-address lookup: EPC + Land Registry history + condition-adjusted value band.
- One-page PDF export, co-branded.
- Manual referral click-through to our acquisitions team.
- Web app, no login required for first use; email capture for report delivery.

**V2 (Month 4–8):**
- Bulk CSV upload for solicitors managing multiple probate cases at once.
- Wealth manager "portfolio watch" mode: quarterly auto-refreshed reports for a saved list of client properties.
- Surveyor plug-in: exportable appendix formatted to slot into standard RICS report templates.
- Referral CRM: professional can track status of any property they referred (without seeing our internal offer/negotiation detail).

**V3 (Month 9+):**
- API access for larger firms (multi-partner solicitor practices, wealth management platforms) to embed the valuation check into their own case-management systems.
- Automated "estate distress" scoring for wealth managers' entire client property book, flagging which addresses are most likely to face a sale decision in the next 12 months.

## 7. Non-Goals

- Not a public-facing consumer valuation tool (Zoopla/Rightmove already own that space).
- Not a marketplace or listing platform — we are not trying to disintermediate agents for the professional's other work.
- Not a lead-generation tool that pressures professionals to refer — the tool must remain useful and neutral even when the property never reaches us.

## 8. Data Sources Required

| Source | Purpose | Access |
|---|---|---|
| HM Land Registry Price Paid Data | Street-level sold prices, condition-pair matching | Free, monthly, API/CSV[cite:19] |
| EPC open data register | Condition proxy (band, age of certificate) | Free, public register |
| Rightmove/Zoopla sold-with-photos archive | Visual condition confirmation for comparables | Requires scraping/partnership — flag as a build risk |
| Our internal refurb-cost benchmarks | Refurb estimate ranges by scope (cosmetic/full/extension) | Already compiled internally from 2026 market data |

## 9. Success Metrics

- Number of professional accounts activated (target: 25 solicitor practices, 15 surveyor practices, 10 wealth management contacts in first 6 months — pilot-scale, not mass-market).
- Reports generated per month per active professional (adoption/stickiness signal).
- Referral click-through rate per report.
- Referrals converted to viewed properties, then to completed acquisitions.
- Time from professional first use to first referral (should shrink as trust builds).

## 10. Risks

- **Professional conflict of interest**: solicitors and surveyors owe duties to their client, not to us. Mitigation: referral panel must be opt-in, clearly labelled, and never the default action; tool must be equally useful when no referral results.
- **Adoption failure**: professionals are time-poor and skeptical of anything that looks like a sales funnel disguised as a tool. Mitigation: make the core lookup genuinely faster/better than their current alternative (calling an agent for an opinion), and pilot with a small trusted group first rather than mass outreach.
- **Data licensing**: Rightmove/Zoopla photo-archive scraping may require commercial agreement rather than ad-hoc scraping. Flag as an open legal/commercial question before V1 ships.
- **Referral economics unproven**: no public data quantifies referral-driven deal volume for buying agents using a comparable model[cite:81][cite:90] — this is a hypothesis to test, not a validated channel.

## 11. Go-To-Market Plan

### Phase 0 — Pilot design (Weeks 1–4)
- Build MVP single-address lookup + PDF export, no login required.
- Select 5–8 target relationships from our existing network or warm introductions: 3–4 probate/private-client solicitors, 2–3 RICS surveyors doing probate/bank valuation work, 1–2 wealth manager contacts.
- Do NOT do broad outreach yet — the goal is to validate that professionals actually use the tool unprompted before scaling.

### Phase 1 — Closed pilot (Weeks 5–12)
- Onboard the 5–8 pilot users personally (founder-led, not automated), explain the tool is genuinely free and neutral.
- Track: reports generated, referral click-throughs, qualitative feedback on report usefulness and professional trust.
- Iterate the report format based on direct feedback — likely 2–3 revisions before it feels "theirs" rather than "ours."
- Target: at least 1 real referred lead and 1 completed deal from the pilot group within 12 weeks, to prove the loop works end-to-end.

### Phase 2 — Controlled expansion (Months 4–6)
- Expand to 25–40 solicitor practices and 15–20 surveyor practices via warm referral from pilot users ("would you recommend this to a colleague?") rather than cold outreach — trust transfers faster this way in professional-services networks.
- Launch V2 features (bulk upload for solicitors, portfolio watch for wealth managers) based on pilot feedback.
- Begin light content marketing aimed at the professional audience: short guides on "understanding property condition risk in probate" distributed via solicitor/surveyor professional bodies and LinkedIn, positioning the tool as thought leadership rather than a sales pitch.

### Phase 3 — Scale and instrument (Months 7–12)
- Formalise referral fee/introducer agreements with professionals or firms generating consistent qualified leads (structure to be confirmed with legal — must not create conflict-of-interest or fee-sharing issues under SRA/RICS rules for solicitors and surveyors).
- Launch API/embed option for larger multi-partner practices and wealth platforms.
- Build the "estate distress scoring" V3 feature once enough usage data exists to validate which signals actually predict a sale decision.
- Review unit economics: cost to build/maintain tool vs value of deal flow generated, decide whether to continue self-funding as a sourcing cost center or spin out as a standalone product.

### Channel Prioritisation Rationale

Probate solicitors are the highest-priority channel to pilot first because probate is the only seller-situation with a robust, dated public discount figure (10–25% below market)[cite:12], giving the clearest expected payoff per relationship. Surveyors are second priority because they are structurally present on nearly every distressed property before any sale decision is made, but require a slightly different product form factor (report appendix, not standalone tool). Wealth managers and care advisers are third priority — logically strong but entirely unproven in the evidence gathered, and best tested only once the tool and referral mechanics are validated with the first two groups.

## 12. Open Questions Requiring Further Work

- Legal/regulatory check: can solicitors and RICS surveyors accept or route referrals to a commercial buyer without breaching professional conduct rules (SRA, RICS)? Requires a compliance opinion before Phase 2.
- Commercial structure for referral fees to regulated professionals — needs specific legal advice, not assumed from general buying-agent fee norms.
- Whether Rightmove/Zoopla data can be legally used for the condition-confirmation feature, or whether an alternative data source is needed.
