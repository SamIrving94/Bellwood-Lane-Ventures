# Bellwood Ventures — Estate Agent Partner Portal
## Product Requirements Document (PRD) v1.0

**Document owner:** Bellwood Ventures Founder
**Status:** Draft for review
**Last updated:** April 2026
**Version:** 1.0
**Classification:** Internal — Confidential

***

## Document Purpose

This PRD defines the requirements for the Bellwood Ventures Estate Agent Partner Portal — the primary digital product enabling estate agents to refer distressed, chain-break, probate, and problem-property deals to Bellwood for a cash purchase. It covers what the product must do, for whom, and how success is measured. It does not specify how to build it — that is for the delivery team.

This document should be treated as a living spec. Update it after every agent discovery interview and after each delivery sprint.

***

## 1. Problem Statement

### 1.1 The Agent's Problem

UK estate agents lose an estimated **£392 million per year** to sale fall-throughs. Chain breaks, probate delays, problem properties, and distressed sellers represent 20–30% of a typical agent's active pipeline at any given time — deals that are live but at serious risk of collapsing. When a deal breaks, the agent loses their commission, loses the seller relationship, and spends unrecovered time re-listing.

Today, when agents encounter these situations, they have three options:
1. Wait it out and hope the chain reforms — slow, uncertain
2. Refer to an existing cash buyer (We Buy Any House, Good Move, etc.) — fast, but agents hate re-trading, poor comms, and zero transparency
3. Refer to auction — transparent but uncertain price, slow setup, not always suitable for probate

**There is no product built specifically for the estate agent that makes referring a cash buyer feel safe, professional, and commercially rewarding.**

### 1.2 The Regulatory Problem

The TPO and NTSELAT referral fee guidance requires estate agents to disclose any referral arrangement to sellers in writing, at the earliest opportunity, including the amount or estimated value of any fee received. Under the DMCC Act 2025, the CMA can fine agents without going to court for failing to disclose material information.

The result: many agents who would otherwise refer to a cash buyer hesitate because they lack compliant disclosure paperwork. **No existing cash buyer provides this paperwork for the agent.**

### 1.3 Bellwood's Opportunity

Build the only cash-buyer partner portal that:
- Gives agents a safe, compliant referral workflow with pre-drafted disclosure docs
- Provides real-time deal status so agents are never chasing on behalf of their seller
- Pays agent commission transparently and on time, every time
- Generates an instant indicative Bellwood Score for any UK property — giving agents a tool to use in the seller's living room before they even refer

***

## 2. Product Vision

> **"The portal that makes referring a cash buyer feel like the professional choice, not the last resort."**

Bellwood's portal is the only B2B tool in the UK cash-buyer market built entirely from the agent's perspective. It removes risk, reduces admin, protects their reputation, and makes them money — on deals that would otherwise die.

***

## 3. Users & Personas

### 3.1 Primary User: The Referring Agent

| Attribute | Detail |
|---|---|
| **Role** | Branch manager, senior negotiator, or director at an independent or small-chain estate agency |
| **Deal volume** | 40–120 sales per year |
| **Tech comfort** | Moderate — uses CRM daily (Alto, Reapit, Dezrez), comfortable with email/WhatsApp, limited appetite for new tools unless they save time |
| **Primary pain** | Losing commission on broken deals; managing seller anxiety on stalled transactions |
| **Time pressure** | Extremely high — rarely at a desk for more than 30 minutes at a stretch |
| **Trust threshold** | Very high — needs proof before recommending anything to a client |
| **Failure mode** | Will abandon any tool that requires data entry, creates compliance risk, or slows them down |

**Key insight from discovery research:** Agents want to be able to refer a seller to Bellwood *during* a seller meeting — not after. The tool must work on a phone in under 2 minutes.

### 3.2 Secondary User: The Bellwood Internal Team

| Attribute | Detail |
| --- | --- |
| **Role** | Founder / deal operations (Year 1); Operations manager (Year 2+) |
| **Primary need** | Full deal pipeline visibility; AML compliance logs; commission tracking; investor matching |
| **Tech comfort** | High — can manage Airtable, Zapier, Softr admin |

### 3.3 Out of Scope for v1.0

- **Sellers** — sellers do not log into this portal. Their experience is managed by email and phone.
- **Investors** — investor deal pack distribution is a separate workflow (see Deal Sourcing Module, Section 7)
- **Corporate chain agents** (Foxtons, Connells) — too much procurement friction for v1.0. Independent and 1–5 branch agents only.

***

## 4. Goals & Success Metrics

### 4.1 Business Goals (12 months)

| Goal | Metric | Target |
|---|---|---|
| Agent acquisition | Registered agent partners | 50 |
| Deal referral activity | Referrals submitted via portal | 120 |
| Deal conversion | Referrals → completed purchases | 15–20% conversion = 18–24 deals |
| Agent retention | Agents making 2+ referrals | >60% of registered agents |
| Compliance | TPO/AML disclosures completed | 100% of deals |

### 4.2 Product Health Metrics

| Metric | Target |
|---|---|
| Time to generate a Bellwood Score (from address input) | < 30 seconds |
| Time for agent to submit a referral | < 3 minutes |
| Time from referral submission to indicative offer | < 4 business hours |
| Portal uptime | 99.5% |
| Agent NPS | > 50 |

***

## 5. Feature Requirements — MoSCoW Prioritisation

### 5.1 MUST HAVE (Phase 0 — launch, Weeks 1–6)

These features block the first deal if absent.

***

#### F01 — Agent Registration & Onboarding

**User story:** As an agent, I want to register my agency and profile in under 5 minutes so I can start referring deals immediately without a phone call.

**Acceptance criteria:**
- Agent enters: name, agency name, branch postcode, email, phone, number of branches, rough annual sales volume
- Receives automated welcome email within 60 seconds containing: unique agent ID, partner agreement PDF (pre-signed by Bellwood), NTSELAT-compliant referral fee disclosure template, guide to referring first deal
- Bellwood admin notified instantly via Slack/email
- New agent record created in Airtable automatically via Zapier
- Registration takes < 5 minutes end-to-end

**Constraints:**
- No KYC on the agent at registration — this is a B2B partner, not a seller
- Do not ask for bank details at registration — commission setup handled after first deal completes
- Partner agreement must be reviewed by solicitor before launch

***

#### F02 — Bellwood Score (Instant Property Risk Assessment)

**User story:** As an agent, I want to enter a property address and immediately get an indicative risk score so I can have a confident conversation with a seller about whether Bellwood is the right option.

**Acceptance criteria:**
- Input: full UK property address (or postcode + house number)
- Output displayed within 30 seconds:
  - **Bellwood Score** (0–100): overall deal viability
  - **Deal Type Fit**: which of Bellwood's 3 deal types this property fits (Type A: chain break, Type B: probate/distressed, Type C: problem property)
  - **Risk flags** (from public data): knotweed risk zone (Environment Agency), flood risk band (EA), EPC rating (if available), leasehold with < 80 years remaining, listed building status, planning enforcement markers
  - **Indicative offer range**: expressed as "Bellwood would typically offer between X% and Y% of estimated market value for this deal type" — NOT a specific pound figure at this stage
  - **Disclaimer** (mandatory, visible): "This is an indicative assessment based on publicly available data. It is not a formal offer and is not a substitute for survey or title investigation."
- Score and flags saved automatically to agent's portal history
- Agent can share the Score output as a PDF to the seller

**Data sources:**
- Environment Agency knotweed risk zones (public API)
- Environment Agency flood risk (public API)
- MHCLG EPC Register (public API)
- HM Land Registry title data (public API — note up to 3-month lag)
- Planning Portal enforcement notices (public data)
- Rightmove/Zoopla AVM estimate via third-party API (e.g. Hometrack or GetAgent data)

**Constraints:**
- Do NOT present the Score as definitive. The disclaimer must be impossible to miss — above the score, not below it.
- Do NOT store seller personal data at this stage. The Score is a property assessment, not a seller profile.
- Score algorithm to be defined by founder based on deal type weights — not public-facing.

***

#### F03 — Deal Referral Submission

**User story:** As an agent, I want to submit a deal referral in under 3 minutes so I can do it during or immediately after a seller meeting.

**Acceptance criteria:**
- Form fields (mandatory): property address, seller name, seller phone, seller email, deal type (drop-down: chain break / probate / distressed / problem property / relocation / other), agent's brief (free text, max 200 words), seller's urgency (drop-down: < 2 weeks / 2–4 weeks / 1–3 months / flexible)
- Form fields (optional): current listed asking price, estimated market value, existing mortgage balance (rough), known issues (multi-select: knotweed / short lease / structural / cladding / other)
- On submission: agent sees confirmation screen with deal reference number and SLA ("You'll receive an indicative offer within 4 business hours")
- Bellwood team notified instantly via email/Slack with full referral detail
- Deal record created in Airtable automatically
- Seller receives automated SMS: "Hi [name], [Agent] has shared your property details with Bellwood Ventures. We'll be in touch within 4 hours. Questions? Call 0XXXX XXXXXX."
- Agent receives email confirming submission, with tracking link to deal status page (F04)

**Constraints:**
- Mobile-optimised. The majority of referrals will be submitted on an agent's phone.
- Do NOT require the agent to upload documents at referral stage — this creates friction. Documents come later.
- Seller consent: the referral form must include a mandatory checkbox: "I confirm the seller is aware their details are being shared with Bellwood Ventures for the purpose of receiving a cash offer." This is the agent's consent record.

***

#### F04 — Deal Status Tracker (Agent Dashboard)

**User story:** As an agent, I want to see the live status of every deal I've referred so I never have to chase Bellwood for an update and I can reassure my seller without a phone call.

**Acceptance criteria:**
- Agent dashboard shows all their referred deals in a list/table view
- Each deal shows: property address, deal reference, current status (see status pipeline below), last updated timestamp, assigned Bellwood contact, expected next step and date
- Agent can click into a deal for full detail view
- Status updates trigger automatic email/SMS notification to agent (and optionally seller)
- Agent can add a note or message Bellwood directly from the deal view (Slack/email relay in v1.0, in-portal messaging in v2.0)

**Deal Status Pipeline:**

| Stage | Label | SLA |
|---|---|---|
| 0 | Referral received | Immediate |
| 1 | Initial review | 4 business hours |
| 2 | Indicative offer sent | Day 1 |
| 3 | Offer accepted — progressing | — |
| 4 | Survey instructed | Within 5 working days of acceptance |
| 5 | Survey complete | 2–3 weeks |
| 6 | Formal offer confirmed | Within 48h of survey |
| 7 | Solicitors instructed | Within 5 working days of formal offer |
| 8 | Exchange target set | — |
| 9 | Exchanged | — |
| 10 | Completed | — |
| X | Deal paused | With reason |
| — | Deal withdrawn | With reason and date |

**Constraints:**
- Status must be updated by Bellwood team within 24 hours of any milestone change. Stale statuses destroy trust.
- Agents must never have to ask "what's happening?" — if they are asking, the portal has failed.

***

#### F05 — Compliance Document Pack (Auto-Generated)

**User story:** As an agent, I want to receive a pre-completed, solicitor-reviewed disclosure document when I submit a referral so I can give it to my seller and be fully compliant with TPO and NTSELAT requirements.

**Acceptance criteria:**
- On referral submission, agent's portal auto-generates a PDF pack containing:
  1. **Referral Fee Disclosure Notice** (NTSELAT-compliant): states that the agent has a referral arrangement with Bellwood Ventures, and that the agent will receive a fee of [X]% of Bellwood's purchase price upon completion
  2. **Seller Informed Consent Form**: confirms seller was advised of open-market alternative, understands the below-market offer rationale, and consents to proceed to offer stage
  3. **Bellwood Offer Terms Summary**: plain-English explanation of what Bellwood is, how it works, what the seller can expect
- PDF auto-populated with: agent name, agency name, property address, date, deal reference number
- Bellwood fee percentage auto-inserted from agent's tier (Bronze/Silver/Gold — see Section 8)
- Agent downloads PDF and gives to seller before formal offer is made
- Completed/signed copy uploaded back to portal by agent (document upload, Phase 1 must-have)
- Document template reviewed and approved by a property solicitor before portal launch

**Constraints:**
- This document is Bellwood's primary legal protection and the agent's primary regulatory protection. It must not go live without solicitor sign-off.
- If the agent does not complete the disclosure flow, Bellwood will not issue a formal offer. This is enforced by system logic, not trust.

***

#### F06 — Agent Commission Tracker

**User story:** As an agent, I want to see exactly what I've earned and what's pending so I can forecast my income from Bellwood referrals.

**Acceptance criteria:**
- Dashboard widget shows: total commission earned (lifetime), commission pending (deals exchanged but not completed), total deals referred, total deals completed
- Each completed deal shows: property, completion date, Bellwood purchase price, commission rate, commission amount, payment date
- Commission paid via BACS within 5 working days of completion — confirmation email sent to agent
- VAT invoice auto-generated for each payment (agent receives copy)

**Constraints:**
- Commission rate must be agreed and documented before first referral — do not leave this ambiguous.
- Rates by tier: Bronze (standard) 1.5% +VAT, Silver (3+ completed deals) 2% +VAT, Gold (6+ completed deals) 2.5% +VAT. Subject to final commercial review.

***

### 5.2 SHOULD HAVE (Phase 1 — Weeks 7–16)

These significantly improve agent experience but don't block launch.

***

#### F07 — Document Upload & Management

**User story:** As an agent, I want to upload deal documents (EPC, title register, floor plan, photos) directly to a deal so everything is in one place for Bellwood.

**Acceptance criteria:**
- File upload on each deal: PDF, JPEG, PNG up to 20MB per file
- Accepted document types labelled (EPC, title register, photos, lease, survey, PoA, probate grant)
- Files stored securely (encrypted at rest), accessible only to agent and Bellwood team
- Bellwood team notified when documents uploaded

***

#### F08 — Agent Resource Library

**User story:** As an agent, I want to access up-to-date scripts, FAQs, and seller-facing materials so I can confidently explain Bellwood to any seller without calling Bellwood first.

**Contents for launch:**
- "When to refer to Bellwood" one-page guide (deal type decision tree)
- Seller conversation script (how to introduce the cash offer option)
- FAQ: What is a cash buyer? Why is the offer below market value? How long does it take?
- Co-branded one-pager (agent's name/logo + Bellwood branding) — self-serve PDF download
- Current Bellwood offer discount ranges by deal type (updated monthly)
- TPO compliance guide: what to say, what to document

***

#### F09 — Agent Referral Leaderboard (Optional Display)

**User story:** As a competitive agent, I want to see how my referral activity compares to other Bellwood partners so I'm motivated to refer more deals.

**Acceptance criteria:**
- Opt-in leaderboard — agents choose whether to appear
- Shows: rank, number of completed referrals (current quarter), tier status
- Anonymised if agent opts out: "Agent in [region] — 4 completed deals"
- Resets quarterly

***

#### F10 — Investor Deal Pack Distribution (Deal Sourcing Module)

**User story:** As a Bellwood operator, I want to distribute deal packs to our investor network directly from the portal so I can activate the sourcing revenue stream without a separate system.

**Acceptance criteria:**
- Deals flagged as "sourcing route" (vs "Bellwood buys") trigger investor pack generation
- Pack contains: property summary, photos, Bellwood Score, comparable sales, deal financials, purchase price, sourcing fee
- Pack sent to selected investors from Bellwood's investor register via email with secure link (no login required for investors in v1.0)
- Investor interest recorded (click tracking on link)
- Sourcing fee agreed and documented before deal pack is sent
- COI declaration auto-included in every investor pack: "Bellwood may also be a principal buyer on this deal. This is disclosed in accordance with NAPSA Code of Conduct."

***

### 5.3 COULD HAVE (Phase 2 — Month 4–9)

Nice-to-have features that improve stickiness and brand.

***

#### F11 — MTD Landlord Alert Tool

Agents can enter a landlord client's portfolio size and get an instant alert: "Your client may be impacted by Making Tax Digital (from April 2026). Bellwood can provide a confidential portfolio exit valuation." Generates a warm referral into Bellwood's MTD landlord pipeline.

#### F12 — Auction Unsold Lot Pipeline

Integration with public SDL Auctions / Auction House UK unsold lot feeds. Alerts registered agents when a property in their postcode area failed to sell at auction. Agent can flag to Bellwood with one click.

#### F13 — Co-Branded Seller Landing Page

Each registered agent gets a unique URL (e.g. bellwoodventures.co.uk/agent/smithsestates). Seller lands on a co-branded page with the agent's photo, logo, and personalised message. Bellwood Score widget embedded. Seller submits their details directly — no agent admin required.

#### F14 — In-Portal Messaging

Replace email relay (Phase 0) with direct in-portal messaging between agent and Bellwood deal manager on each deal thread.

#### F15 — CRM Integration Webhooks

Outbound webhooks to trigger updates in Alto, Reapit, or Dezrez when a deal status changes — so agents never have to manually update their own CRM. API documentation required; delivery in Year 2.

***

### 5.4 WON'T HAVE (v1.0 — explicitly out of scope)

- **Seller-facing portal**: sellers do not log in. Manage by phone and email.
- **Automated offer generation**: offers are reviewed and approved by the Bellwood founder before issue. No AI auto-pricing in v1.0.
- **Rightmove/Zoopla listing integration**: not relevant — Bellwood is not listing properties via portals.
- **Mortgage calculator or lending tools**: Bellwood is a cash buyer, not a mortgage broker.
- **Open API for third parties**: Year 2+ only.
- **Mobile app (native iOS/Android)**: Softr's mobile-responsive web app is sufficient for v1.0.

***

## 6. User Flows

### 6.1 Core Flow: Agent Refers a Deal

```
Agent receives alert that chain has broken
→ Opens Bellwood portal on phone
→ Enters property address → Bellwood Score generated (30s)
→ Taps "Refer this deal"
→ Completes 8-field referral form (< 3 mins)
→ Submits → confirmation screen with deal ref
→ Auto-generated compliance PDF sent to agent email
→ Agent prints/forwards PDF to seller
→ Seller signs consent form
→ Agent uploads signed form to portal
→ Bellwood issues indicative offer within 4 hours
→ Agent sees offer update on dashboard
→ Agent calls seller to discuss
→ Seller accepts → deal progresses through status pipeline
→ Completion → agent receives commission payment + VAT invoice
```

### 6.2 Core Flow: Agent Checks Deal Status

```
Agent receives WhatsApp from worried seller
→ Opens Bellwood portal → taps deal reference
→ Sees current status: "Solicitors instructed — exchange target 14 May"
→ Reads latest note from Bellwood: "Title search returned clean — proceeding"
→ Agent replies to seller with confidence
→ No phone call to Bellwood required
```

### 6.3 Core Flow: New Agent Onboards

```
Agent attends Bellwood intro call (or receives LinkedIn DM)
→ Given portal URL
→ Registers in < 5 minutes
→ Receives welcome email with partner agreement + disclosure template
→ Reads "Refer your first deal" guide
→ Uses Bellwood Score on their next valuation appointment
→ Refers first deal within 14 days
```

***

## 7. Non-Functional Requirements

### 7.1 Performance

| Requirement | Target |
|---|---|
| Page load time (portal homepage) | < 2 seconds on 4G |
| Bellwood Score generation | < 30 seconds |
| Referral form submission confirmation | < 3 seconds |
| Portal uptime | 99.5% (Softr/Airtable SLA) |

### 7.2 Security & Data

- All data stored in UK-based servers (Airtable Business tier or above — EU/UK data residency)
- Agent and seller personal data processed under Bellwood's Privacy Policy (ICO registration required before launch)
- Portal login via email magic link or email + password (Softr native auth)
- Seller data encrypted at rest
- No seller financial data (bank details, mortgage account numbers) stored in portal
- AML compliance documents (KYC/CDD outputs) stored separately with restricted access

### 7.3 Accessibility & Device Support

- Mobile-first design — 80%+ of agent usage expected on phone
- Minimum: iOS Safari, Android Chrome, desktop Chrome/Firefox/Edge
- WCAG 2.1 AA compliance for text contrast and form labels
- Dyslexic-friendly font options preferred (OpenDyslexic or similar available as toggle)

### 7.4 Compliance (Non-Negotiable)

- NTSELAT referral fee disclosure baked into onboarding and referral workflow
- TPO Code of Practice compliance embedded in seller consent flow
- DMCC Act 2025 material information requirements reflected in Bellwood Score disclaimers
- ICO registration (data controller) completed before first seller data is processed
- HMRC AML registration completed before first deal progresses to offer stage

***

## 8. Commission & Pricing Structure

| Tier | Qualifying condition | Commission rate | Additional benefit |
|---|---|---|---|
| Bronze | Default on registration | 1.5% +VAT of Bellwood purchase price | Access to all portal features |
| Silver | 3+ completed Bellwood deals | 2.0% +VAT | Priority 2-hour offer SLA |
| Gold | 6+ completed Bellwood deals | 2.5% +VAT | Named account manager, co-branded materials |

**Example at Bronze, £220,000 purchase price:** agent earns £3,300 +VAT = £3,960 gross. Paid within 5 working days of completion.

**Note:** Commission rates must be disclosed to the seller in the auto-generated disclosure PDF at referral stage. The rate cannot be hidden or disclosed only at completion.

***

## 9. Tech Stack (Phase 0 — No-Code)

| Component | Tool | Purpose | Monthly cost (approx.) |
|---|---|---|---|
| Database & backend | Airtable Team | All deal, agent, document data | £45–90 |
| Portal frontend | Softr Pro | Agent-facing portal UI | £49 |
| Automation | Zapier Professional | Form → Airtable → email triggers | £49 |
| Email | Mailchimp or Brevo | Automated emails, notifications | £0–20 |
| Score data APIs | EA, MHCLG, HMLR | Public property data | Free |
| AVM API | Hometrack / GetAgent | Indicative property value | £100–300 |
| Document generation | DocuSeal or PandaDoc | PDF auto-generation | £29–50 |
| Website | Webflow | bellwoodventures.co.uk | £23 |
| **Total** | | | **~£295–£580/month** |

**Airtable migration trigger:** When Bellwood reaches 500 deals/year, or requires real-time multi-party data sync, migrate to Supabase + custom frontend. Define this trigger now, not when the system is already under strain.

***

## 10. Risks & Dependencies

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Solicitor review of disclosure docs delayed | Medium | **Blocks launch** | Engage solicitor week 1; this is the critical path |
| HMRC AML registration delayed beyond 45 days | Medium | Blocks deal 1 | Submit application with full risk policy — do not submit incomplete |
| Airtable API rate limit hit at scale | Low (v1.0) | Medium | Define migration trigger; monitor from deal 50+ |
| Agent submits referral without seller consent | Medium | Regulatory breach | System enforcement: portal blocks formal offer until consent form uploaded |
| Bellwood Score gives inaccurate risk signal | Medium | Trust-damaging | Prominent disclaimer on every score output; agent training in resource library |
| Agent uses disclosure doc incorrectly | Medium | TPO complaint | Include worked example in onboarding; resource library FAQ |
| Conveyancer delays breach "28-day exchange" promise | High | Reputation damage | Change promise to "28 days from survey sign-off, not from offer" |

***

## 11. Open Questions (Decisions Required Before Launch)

| # | Question | Owner | Deadline |
|---|---|---|---|
| OQ1 | What is the exact commission structure — do we differentiate by deal type or just by tier? | Founder | Week 1 |
| OQ2 | Which AVM API do we use for the Bellwood Score — Hometrack, GetAgent, or Sprift? | Founder + tech | Week 2 |
| OQ3 | Has the Seller Disclosure Form been reviewed and signed off by a property solicitor? | Solicitor | Before launch |
| OQ4 | What is the process for a deal where Bellwood decides NOT to proceed after indicative offer — how do we communicate this to the agent without destroying trust? | Founder | Week 2 |
| OQ5 | Do we show the Bellwood Score to the seller, or only to the agent? | Founder | Week 2 |
| OQ6 | What happens if an agent submits a deal and the seller has already accepted an offer from another buyer? | Ops | Week 3 |
| OQ7 | Are sourcing deals shown in the same portal as principal deals, or in a separate investor-only interface? | Founder | Week 4 |

***

## 12. Launch Checklist (Phase 0 Gates)

Before the portal is shown to a single agent, all of the following must be complete:

- [ ] Companies House incorporation complete
- [ ] HMRC AML registration submitted (with written risk policy)
- [ ] ICO data controller registration complete
- [ ] Partner agreement (B2B contract with agents) reviewed by solicitor
- [ ] Seller Disclosure Form reviewed and approved by solicitor
- [ ] Airtable base built with all required tables and views
- [ ] Softr portal live with: registration, Score, referral form, deal tracker, commission view
- [ ] Zapier automations tested end-to-end (registration → welcome email, referral → Airtable record → agent confirmation)
- [ ] Bellwood Score live with all six data sources connected
- [ ] Mobile tested on iOS Safari and Android Chrome
- [ ] Privacy Policy and GDPR cookie notice live on bellwoodventures.co.uk
- [ ] Resource library populated with: deal type guide, seller script, FAQ, disclosure template
- [ ] First 10 agent outreach contacts identified and personalised outreach drafted
- [ ] Internal SLA confirmed: offer issued within 4 business hours of referral submission

***

## Appendix A: Bellwood Score Algorithm (Working Draft)

The Bellwood Score (0–100) is an indicative deal viability rating. Higher = cleaner, lower = more complexity. It is NOT a valuation. It is a conversation starter.

**Scoring components (subject to founder calibration):**

| Factor | Weight | Data source |
|---|---|---|
| Flood risk (low / medium / high / very high) | 15% | Environment Agency |
| Knotweed risk zone | 15% | Environment Agency |
| EPC rating (A–G) | 10% | MHCLG EPC Register |
| Leasehold years remaining (if leasehold) | 15% | HMLR title register |
| Listed building status | 10% | Historic England |
| Planning enforcement active | 15% | Planning Portal |
| Estimated market value confidence (AVM) | 10% | AVM provider |
| Deal type match (how well the situation fits a Bellwood deal type) | 10% | Agent input at referral |

Scoring is inverse for risk factors: a flood risk of "very high" reduces the score significantly. A freehold property with EPC C, no knotweed, and no enforcement scores near 90.

**Mandatory disclaimer on all outputs:** "This Bellwood Score is an indicative risk assessment based on publicly available data. It is not a formal offer, a survey, or legal advice. Bellwood Ventures makes no warranty as to the accuracy or completeness of this assessment."

***

## Appendix B: Regulatory Reference Summary

| Regulation | Requirement | Where addressed in portal |
|---|---|---|
| NTSELAT Referral Fee Guidance | Disclose existence, counterparty, and amount of referral fee in writing at earliest opportunity | F05 auto-generated disclosure PDF |
| TPO Code of Practice | Agent must not mislead seller about market value; must document advice given | F05 seller consent form; F08 resource library |
| DMCC Act 2025 | Material information must not be omitted; CMA can fine without court | Bellwood Score disclaimer; F05 disclosure |
| CPR 2008 | Misleading omissions and misleading actions prohibited | F05 wording; solicitor review |
| HMRC MLR 2017 | AML registration; KYC on seller; source of funds check before exchange | Internal compliance workflow (not portal v1.0) |
| ICO / UK GDPR | Lawful basis for processing seller data; right to access; data retention | Privacy Policy; referral form consent checkbox |