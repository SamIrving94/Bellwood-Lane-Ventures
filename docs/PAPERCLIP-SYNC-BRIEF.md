# Paperclip Agent Sync Brief — Bellwood Ventures Platform

> **RETIRED (2026-07-16).** The external Paperclip runtime is decommissioned.
> Production evidence: its exclusive roles (cto, counsel) last wrote AgentEvents
> on 2026-04-09; scout on 2026-05-25. All of its functions now run as internal
> Vercel crons (see `docs/architecture/marketer-internal.md`), which kept the
> agent identities (liaison, appraiser, marketer, orchestrator). The orphaned
> `/agents/*` HTTP routes were deleted on 2026-07-16, except five with live
> internal callers: auctions, marketer/draft-blog, dispatch, intake/whatsapp,
> scout/process-probate-pdf. This document is kept as historical reference for
> the role playbooks and workflow definitions.

**This is the single source of truth for every Paperclip agent.**
**Updated:** May 2026 (v4 — reconciled with the live Paperclip instance).
**Audience:** All Paperclip agents in the BELA company:
**CEO, Engineer, Designer, Appraiser, Counsel, Marketer, Liaison.**

If you only read three sections, read **§4 (the agent-quick-form
workflow)**, **§6 (the API contract)**, and **§9 (your prompt template)**.

---

## §1 The shape of the operation

The Bellwood Lane stack is two halves working together:

```
┌────────────────────────────────────┐  ┌────────────────────────────────┐
│       BELLWOOD PLATFORM            │  │           PAPERCLIP            │
│       (this repo)                  │  │    (your runtime)              │
│                                    │  │                                │
│  apps/web   public site            │  │  AI-agent ops:                 │
│  apps/app   founder dashboard      │  │  - Enrichment workflows        │
│  apps/api   integration endpoints  │  │  - Signed PDF drafting         │
│                                    │◄─┤  - WhatsApp/email reach-out    │
│  Source of truth for:              │  │  - SLA monitoring + escalation │
│  - QuoteRequests, QuoteOffers      │  │  - 7-day deal follow-ups       │
│  - AgentAccounts                   │  │  - Weekly market intel         │
│  - Deals, DealUpdates              │  │  - Lead scoring + scouting     │
│  - FounderActions (the queue)      │  │  - Investor outreach           │
│  - AvmResults                      │  │                                │
│                                    │  │  Authenticates via:            │
│                                    │  │   Authorization: Bearer        │
│  + AVM engine (real HMLR + EPC +   │  │     ${BELLWOOD_API_KEY}        │
│    HPI + PropertyData /valuation-  │  │                                │
│    sale 20% cross-check)           │  │  Hits: bellwood-api.vercel.app │
│                                    │  │                                │
│  + Bellwoods Concierge             │  │                                │
│    (PropertyData /george AI in the │  │                                │
│     dashboard for ad-hoc research) │  │                                │
└────────────────────────────────────┘  └────────────────────────────────┘
```

> **Note:** in the new architecture, marketing workflows fire from internal
> cron (`/cron/marketer-*`) and Paperclip is optional. The diagram above
> still describes the Phase 1 ops layer; see
> `docs/architecture/marketer-internal.md` for the marketing-side update.

**Architectural principle:** the platform writes truth, Paperclip runs ops
on top. **Every agent action that produces data MUST push it to the
platform via the API.** Your work is wasted if it doesn't land in the
platform — the founders review and override from the dashboard.

The platform never queues outbound work in Paperclip; Paperclip pulls work
from the platform.

### Production URLs

- **Dashboard:** https://bellwood-app.vercel.app
- **API:** https://bellwood-api.vercel.app
- **Public site:** https://bellwood-web.vercel.app
- **GitHub:** https://github.com/SamIrving94/Bellwood-Lane-Ventures

### Tech stack (so you can read the codebase)

- **Framework:** Next.js 15, TypeScript, React 19
- **Database:** PostgreSQL on Neon, Prisma ORM
- **Auth:** Clerk for founders; Bearer token for Paperclip
- **Monorepo:** Turborepo + pnpm
- **Hosting:** Vercel (3 projects: bellwood-web, bellwood-app, bellwood-api)
- **Business logic packages:** `@repo/property-data`, `@repo/scouting`,
  `@repo/valuation`, `@repo/instant-offer`, `@repo/email`, `@repo/deal-updates`

---

## §2 First-run onboarding (read these in order)

You should read the codebase, not just hit the API.

### Step 1 — Clone (read-only)

```bash
git clone https://github.com/SamIrving94/Bellwood-Lane-Ventures.git
```

Agents do not push to `master`. Only the **CTO agent** opens PRs (see §10).

### Step 2 — Read the data contract

The Prisma schema is the canonical contract for everything you'll touch:

- **File:** `packages/database/prisma/schema.prisma`

### Step 3 — Read the research library

Mandatory before acting:

- `docs/research/agent-partner-research-2026-04.md` — UK estate agent
  market, pain points, GTM playbook, regulatory brief
- `docs/research/agent-briefing-pack-2026-04.md` — operating manual
- `docs/research/agent-evidence-reality-check-2026-04.md` — adversarial
  review of our positioning
- `docs/HANDOVER.md` — the co-founder handover, gives you the same picture
  the founders have

### Step 4 — Read the files for your role

| Agent | Must read |
|---|---|
| **CEO** | `docs/HANDOVER.md`, `apps/app/app/(authenticated)/quotes/`, `apps/api/app/agents/alerts/`, `apps/api/app/cron/sla-alerts/` — owns priority + SLA escalation |
| **Engineer** | Entire repo. Prioritise: `apps/api/app/agents/*`, `packages/database/prisma/schema.prisma`, `apps/app/app/`, `turbo.json`. Owns code contributions, lead scoring, AI integration |
| **Designer** | `apps/web/app/`, `apps/app/app/`, `packages/design-system/`. Owns UX of the public site + dashboard |
| **Appraiser** | `packages/valuation/`, `packages/property-data/`, `packages/instant-offer/`, `apps/api/app/agents/quote-ops/` (the 4-hour SLA queue) |
| **Counsel** | `apps/api/app/agents/legal/`, `apps/web/app/legal/`, `packages/database/prisma/schema.prisma` (LegalStep, LegalDocument) |
| **Marketer** | `packages/email/`, `apps/api/app/agents/outreach/`, `apps/api/app/cron/agent-prospecting/` (Monday's new firms feed) |
| **Liaison** | `apps/api/app/agents/outreach/`, `apps/web/app/save-the-sale/`, `packages/deal-updates/`, schema models `Contact`, `Deal`, `QuoteRequest`, `TrackToken`. Owns vendor + agent comms |

There are no `Scout`, `Orchestrator`, `Concierge`, `Relationship Manager`,
or `Chief of Staff` agents in the live instance. Functions previously
attributed to those roles are folded into the 7 above:

- **Scout's job (lead generation)** → split between **Engineer** (cron
  jobs, scoring code) and **Marketer** (outreach prep)
- **Orchestrator's job (alerts, summaries)** → **CEO** owns escalation;
  alerts are surfaced via FounderAction
- **Concierge's job (vendor comms)** → **Liaison**
- **Relationship Manager's job (investor comms)** → **Liaison**
- **Chief of Staff's job (strategic review)** → **CEO**

---

## §3 The two new things you need to know about

These are post-April-2026 additions to the brief. If you've worked on
Bellwood before, this is what's changed.

### 3.1 The agent quick-form workflow (`agent_quick_form`)

`/save-the-sale` is the panic-mode landing where estate agents send
fall-throughs — chain breaks, mortgage failures, survey down-valuations,
probate. Submissions land in `QuoteRequest` rows with
`source = 'agent_quick_form'` and a 4-hour signed-PDF SLA.

**This is now your priority queue.** See §4.

### 3.2 PropertyData REST integration

We have a paid PropertyData API key. Two ways you can use it:

- **Path A — `@repo/property-data/propertydata.ts`** — server-only, typed,
  cached, credit-logged wrapper. Use for programmatic enrichment.
- **Path B — `/george`** — PropertyData's hosted AI endpoint, accessed via
  `askGeorge()` in the same package. Used by the Bellwoods Concierge in
  the dashboard. You can use it too for natural-language synthesis.

Endpoints already wrapped: `/valuation-sale`, `/floor-areas`, `/flood-risk`,
`/demand`, `/agents`, `/account/credits`, `/george`. Adding more is easy
— see the pattern in `packages/property-data/src/propertydata.ts`.

Setup details: `docs/setup/propertydata.md`.

---

## §4 The agent-quick-form workflow (priority 1)

**Trigger:** new `QuoteRequest` rows with:

- `source = 'agent_quick_form'`
- `status = 'quoted'` (not `processing`, not `draft`)
- `createdAt > now - 4h`

**Polling (v1):** every 60s, until we add webhooks (superseded by
`/cron/event-poller` running every 30 min). Suggested loop in §6.6.

### What the platform has already done before you see the row

When the agent submits at `/save-the-sale`, the platform has:

1. Created the `QuoteRequest` (with `notes` like
   `"Trigger: Buyer pulled out\nSource: agent_quick_form"`)
2. Generated an **indicative offer** via `@repo/instant-offer` →
   `@repo/valuation` (real HMLR + EPC + HPI + PropertyData
   `/valuation-sale` cross-check, with synthetic fallback if APIs time out)
3. Stored it as a `QuoteOffer`
4. Created a `FounderAction` with `expiresAt = +4h` — your SLA hook
5. Sent an acknowledgement email to the agent
6. Returned the indicative figure to the form for on-screen display
7. Recorded a `DealUpdate` and a vendor-shareable `trackUrl`

The agent walked away with: a number, a confirmation email, and a
WhatsApp/email-ready vendor link. They now expect a **signed PDF in
4 working hours**.

### Your workflow

**Within 30 minutes of submission:**

1. **Enrich the data the panic-form didn't capture** using PropertyData:

   | Endpoint | Returns | Why |
   |---|---|---|
   | `/floor-areas` | EPC sqft + bedrooms by postcode | Fixes missing-inputs problem |
   | `/property-info` | Property type, tenure, build year | Replaces `propertyType: 'other'` default |
   | `/flood-risk` | Rivers/sea + surface water risk | Material risk factor |
   | `/planning-applications` | Active + recent apps | Enforcement, refusals |
   | `/title` | Freehold/leasehold, lease length | Catches short leases |
   | `/demand` | Days on market + sales-demand score | How aggressive can our offer be |

   ~12 credits per enrichment. Companies House on the firm via
   `@repo/property-data` (already wrapped).

   **Writeback:** `PATCH /agents/quote-ops/[id]` with the new bedrooms /
   propertyType / condition / `notesAppend`.

2. **Re-run the AVM with full inputs.** Call `runAVM()` directly or
   `generateInstantOffer()` from `@repo/instant-offer`. Compare against the
   indicative — if the new figure is **>5% below** the indicative, raise
   priority on the matching `FounderAction` and add a `notesAppend`
   explaining why.

3. **Draft the signed offer PDF.** Template:
   `docs/templates/binding-offer-letter.md` (write it if not yet present —
   CTO agent's job to scaffold). Include: address, agent firm, indicative
   figure, enriched figure, completion timeline, walk-away cover (£1,000
   + costs), RICS-defect carve-out, methodology reference, signature line.
   Stash the PDF in Vercel Blob, attach via `notesAppend` URL.

**Within 2 working hours:**

4. **Founder approval.** Surface in `/actions` (Action Centre) with link
   to PDF preview. Sam or co-founder clicks "Approve & Send".

**Within 4 working hours (the SLA):**

5. **Send the signed PDF:**
   - Email the signed PDF to `contactEmail`, with a short agent-friendly
     covering message
   - If `contactPhone` is set, send a WhatsApp via Bellwood's business
     account: *"Your signed offer for [address] just landed in [email].
     Reply here if anything urgent."*
   - `POST /agents/quote-ops/[id]/deal-update` with
     `kind: 'offer_sent'` so the vendor-facing timeline updates
   - `POST /agents/quote-ops/[id]/resolve` to stop the SLA clock

### SLA breach handling

If `expiresAt` passes and the FounderAction is still `pending`:

- Escalate to founder mobile (WhatsApp + push)
- Email + WhatsApp the agent: apology, realistic new ETA, small goodwill
  credit toward their next deal
- Log the breach for the published quarterly completion-rate report

### "Open market" outcome (7-day follow-up)

If after 7 days `QuoteRequest.status` is still `quoted` and the agent
hasn't converted:

> *"Quick check — what happened with [address]? If you've gone another
> route, no problem at all. Reply 'open' or 'taken' so I can close
> the loop."*

If `open`: `POST deal-update` with `kind: 'offer_expired'` and close
the loop. If `taken`: `POST deal-update` with `kind: 'offer_declined'`.

**No introducer fee is owed for open-market outcomes.** That promise
has been retracted as of 8 May 2026 — see the changelog. If an agent
asks about it, say plainly that it was never made, or escalate to CEO.

---

## §5 The other workflows you own

### 5.1 Daily scouting (existing, predates this brief)

| Time | Stage | Owner | Description |
|---|---|---|---|
| 07:00 | Scout | Engineer | Cron `/cron/scouting/` finds probate / chain break / repossession leads, enriches, scores, pushes `POST /agents/leads` |
| 07:15 | Appraise | Appraiser | Values leads scored ≥ 70, pushes `POST /agents/valuations` |
| 07:30 | Outreach | Marketer | Drafts comms. Holds vendor comms for founder review |
| 08:00 | Summary | CEO | Reads overnight Founder Actions, prioritises the day |
| 09:00 | SLA check | Engineer (cron) | `/cron/sla-alerts/` flags stuck deals; CEO acts on critical |

### 5.2 Weekly agent prospecting (Mondays 08:30 UTC)

`apps/api/app/cron/agent-prospecting/route.ts` already runs. It calls
PropertyData `/agents` for each target postcode, upserts ranked agents
into `Contact` (type `estate_agent`), tags new firms
`status:not_yet_contacted`, raises a Founder Action with the top 5 new
firms by listing volume, and optionally emails the summary.

**Your job, Marketer:** when new firms appear with
`status:not_yet_contacted`, draft the first outreach (held for founder
review). When founder approves, schedule the campaign via
`POST /agents/outreach`. Mark the contact tag as
`status:outreach_sent` once dispatched.

### 5.3 Weekly market intel briefing (Mondays 09:00, manual for now)

Pull `/national-data` + `/postcode-key-stats` for our priority regions.
Generate a 150-word WhatsApp-friendly briefing via `askGeorge()` with
context preset. Push as a `OutreachCampaign` "Market Brief Mon" message
to all Preferred-tier agents (held for review until cadence proves out).

~10 credits/week.

### 5.4 Investor pack generation (on-demand)

Triggered when a `FounderAction` of `type: 'investor_pack_request'` is
created (or Sam routes a deal to investor instead of buying it). Pull
`/yields`, `/rents`, `/demand-rent`, `/growth`, `/household-income`,
`/sourced-properties` (for competitive context). Generate a one-page
markdown pack via `askGeorge()` with structured prompts. Email +
WhatsApp the investor with the PDF.

~8 credits per pack.

### 5.5 Standard ops (existing) — by agent

- **CEO** — Reads Founder Actions, sets priorities, escalates SLA
  breaches, approves vendor comms, decides go/no-go on offers needing
  review.
- **Engineer** — Owns code contributions (PRs to this repo), runs all
  cron jobs (scouting, prospecting, SLA alerts, AVM appraisal), proposes
  technical changes.
- **Designer** — Owns UX of the public site + dashboard. Reviews
  conversion paths, accessibility, mobile.
- **Appraiser** — Owns the 4-hour SLA queue (the agent-quick-form
  workflow above) plus the daily AVM run on scored leads.
- **Counsel** — Tracks legal step state on every active deal. Flags
  defects via `flagIssue: true` → critical FounderAction.
- **Marketer** — Drafts outreach campaigns, processes new firms surfaced
  by the Monday prospecting cron, holds all vendor comms for founder
  review.
- **Liaison** — Vendor-facing AND investor-facing communications. Drafts
  held messages for direct seller comms (Speed + Certainty + Empathy
  tone) and investor updates. Tracks investor ticket size + preferences.

### 5.6 Marketing automation (dual-customer)

**Canonical plan:** `docs/marketing/PLAN.md`. Read in full before any
campaign work.

Bellwood markets to **two distinct customers** — estate agents (repeat
referrals) and vendors (direct submissions). Same brand, different
channels, different tone. Marketer owns drafting, CEO approves
everything, Liaison + founders handle posting/sending.

**Four content streams:**

| Stream | Audience | Channel | Cadence | Owner |
|---|---|---|---|---|
| 1. "Houses we've offered" | Mixed (lurking) | Instagram | Per offer | Marketer drafts → CEO → Liaison posts |
| 2. "Houses we've sold" | Investors + agents + vendors | Instagram | Per completion | Marketer + Counsel → CEO → Liaison |
| 3. LinkedIn agent education | Branch managers | LinkedIn | 5×/week target | Marketer drafts → CEO → Liaison or founder posts |
| 4. Vendor SEO + paid | Distress searches | Google search, SEO blog | 2 SEO/week + paid | Marketer drafts → **Counsel reviews** → CEO → Liaison |

**Iron rules:**

- No public-facing content goes live without CEO approval
- Vendor-facing content **always** held (extends the platform-wide vendor-comms rule)
- Counsel reviews every vendor-side piece (CPR 2008, NTSELAT, ICO, AML)
- Anonymisation: postcode area only (M14, not M14 5AB), no exterior photos
  identifying the property, 30-day delay between completion and post,
  no vendor names without written consent
- Distress-segment ads must signpost StepChange + Citizens Advice

**Anchor brand asset:** `/why-we-wont-buy-any-home` page. Every campaign
must align with this stance — selectivity over volume. The page lists 6
situations we DO buy and 5 we DON'T (with what we recommend instead).
Don't drift from this list without CEO + Counsel sign-off.

**Targets (Phase 1):**

- Vendor: <£250 cost-per-form-submission, 30%+ form-to-offer, 80%+
  offer-to-completion, <£1,500 all-in cost-per-deal
- Agent: 15%+ outreach-to-reply on personalised LinkedIn, 5%+ on cold
  email, 20%+ reply-to-deal, 50%+ deal-to-completion, <£500 cost-per-deal

Marketer's weekly digest (Sun evenings) reports these 8 numbers to CEO.

**Workflow ownership** detailed in `docs/marketing/PLAN.md` §6.

---

## §6 The API contract

These endpoints are now called primarily by internal Vercel crons. External
Paperclip access remains supported but is not required for any marketing
workflow.

Base URL: `https://bellwood-api.vercel.app`. All routes under `/agents/*`.

Every request:

```
Authorization: Bearer ${BELLWOOD_API_KEY}
Content-Type: application/json
```

The key is shared with each agent out-of-band by founders. **Use
`BELLWOOD_API_KEY` — not `PAPERCLIP_API_KEY`.** Paperclip auto-injects a
short-lived run JWT into your runtime under the name `PAPERCLIP_API_KEY`,
which is unrelated to the bellwood-api bearer token and will return 401
against `bellwood-api.vercel.app`. The `BELLWOOD_API_KEY` value is
provisioned per-agent by founders via Paperclip secrets and matches the
static key configured on the bellwood-api Vercel deployment. The auth
middleware accepts `PAPERCLIP_API_KEY` only as a transitional fallback
on the server side; do not call it from agents.

### 6.1 Quote-ops (NEW — for the agent-quick-form workflow)

**`GET /agents/quote-ops?status=pending&hours=48`**

The Paperclip inbox. Returns `agent_quick_form` QuoteRequests still
awaiting a signed PDF, oldest first. Each row includes the live
`FounderAction` so you know the SLA deadline.

```json
{
  "count": 3,
  "quotes": [
    {
      "id": "clx...",
      "address": "14 Acacia Avenue, Stockport",
      "postcode": "SK4 3HQ",
      "contactName": "Jane Smith",
      "contactEmail": "jane@acmeestates.co.uk",
      "contactPhone": "07700900000",
      "firmName": "Acme Estates",
      "sellerSituation": "chain_break",
      "bedrooms": null,
      "propertyType": "other",
      "condition": null,
      "notes": "Trigger: Buyer pulled out\nSource: agent_quick_form",
      "status": "quoted",
      "createdAt": "2026-04-26T09:47:00.000Z",
      "offer": {
        "id": "...",
        "offerPence": 24400000,
        "estimatedMarketValueMinPence": 28000000,
        "estimatedMarketValueMaxPence": 31000000,
        "offerPercentOfAvm": 0.83,
        "confidenceScore": 0.62,
        "completionDays": 14,
        "lockedUntil": "...",
        "reasoning": ["..."]
      },
      "action": {
        "id": "...",
        "status": "pending",
        "priority": "high",
        "expiresAt": "2026-04-26T13:47:00.000Z"
      }
    }
  ]
}
```

**`GET /agents/quote-ops/[id]`** — full detail; returns `quote` (with
offer, deal updates, track token) and all matching `actions`.

**`PATCH /agents/quote-ops/[id]`** — enrichment writeback.

```json
{
  "bedrooms": 4,
  "propertyType": "semi_detached",
  "condition": 6,
  "askingPricePence": 31000000,
  "notesAppend": "Companies House: ACME LTD active since 2009. EPC C. Risk profile clean.",
  "replaceOffer": {
    "estimatedMarketValueMinPence": 29000000,
    "estimatedMarketValueMaxPence": 32500000,
    "offerPence": 25800000,
    "offerPercentOfAvm": 0.84,
    "confidenceScore": 0.91,
    "completionDays": 14,
    "reasoning": ["Re-run with full inputs", "..."],
    "lockedUntil": "2026-04-29T09:47:00.000Z"
  }
}
```

All fields optional. `replaceOffer` creates a new `QuoteOffer` and points
`QuoteRequest.offerId` at it.

**`POST /agents/quote-ops/[id]/deal-update`** — append to the
vendor-facing timeline.

```json
{
  "kind": "offer_sent",
  "title": "Signed binding offer issued",
  "detail": "PDF sent to jane@acmeestates.co.uk + WhatsApp acknowledgement.",
  "metadata": { "signedOfferUrl": "https://...", "messageId": "..." }
}
```

`kind` is the Prisma `DealUpdateKind` enum: `offer_sent`,
`offer_accepted`, `offer_declined`, `delay`, `founder_review`, `note`,
`solicitor_instructed`, `searches_ordered`, `survey_scheduled`,
`survey_completed`, `enquiries_raised`, `enquiries_resolved`,
`exchange_target_set`, `exchanged`, `completion_target_set`, `completed`,
`resale_listed`.

**`POST /agents/quote-ops/[id]/resolve`** — stop the SLA clock.

```json
{
  "resolvedBy": "paperclip-appraiser",
  "outcome": "signed_pdf_sent",
  "metadata": { "signedOfferUrl": "https://...", "deliveredAt": "..." }
}
```

### 6.2 Scouting — `POST /agents/leads`

Push new leads from scouting runs.

```json
{
  "leads": [
    {
      "runDate": "2026-04-22T07:00:00Z",
      "source": "probate_data",
      "address": "14 Oak Lane, Bromley",
      "postcode": "BR1 4AA",
      "leadType": "probate",
      "estimatedEquityPence": 18500000,
      "contactName": "Jane Smith (Executor)",
      "contactPhone": "+447700900000",
      "contactEmail": "jane@example.com",
      "leadScore": 82,
      "verdict": "STRONG",
      "marketTrend": "stable",
      "sourceTrail": "probate_data > tier1_enrichment"
    }
  ],
  "runSummary": { "fetched": 25, "enriched": 12, "summary": "..." }
}
```

What happens: creates `ScoutLead`, logs `AgentEvent`, leads scored ≥ 70
auto-create a `FounderAction`.

**Verdict enum:** `STRONG` | `VIABLE` | `THIN` | `PASS` |
`INSUFFICIENT_DATA`.

### 6.3 Appraiser — `POST /agents/valuations`

```json
{
  "dealId": "clxyz123...",
  "postcode": "BR1 4AA",
  "propertyType": "semi-detached",
  "riskScore": 35,
  "resultJson": {
    "hedonic": { "value": 24500000 },
    "csa": { "adjustedMedian": 23800000 },
    "offer": { "offerPence": 18900000, "marginPercent": 22.8, "ceoEscalation": false },
    "verdict": "STRONG",
    "riskFactors": [],
    "preRicsFlags": []
  },
  "expiresAt": "2026-05-22T00:00:00Z"
}
```

Creates `AvmResult`, updates linked `Deal`, escalates if
`ceoEscalation: true`.

### 6.4 Counsel — `POST /agents/legal`

```json
{
  "dealId": "clxyz123...",
  "stepKey": "title_searches",
  "completed": true,
  "notes": "Title clean.",
  "flagIssue": false
}
```

Standard 8-step keys: `solicitor_instructed`, `searches_ordered`,
`title_searches`, `local_authority_searches`, `environmental_searches`,
`contract_review`, `exchange`, `completion`. `flagIssue: true` creates
a critical FounderAction.

### 6.5 Marketer — `POST /agents/outreach`

```json
{
  "campaignName": "Probate Solicitors Q2 2026",
  "templates": [{ "name": "Intro", "subject": "...", "body": "...", "type": "probate_solicitor", "sequence": 1, "delayDays": 0 }],
  "recipientContactIds": ["contact_id_1"],
  "summary": "..."
}
```

**CRITICAL:** Direct vendor comms (individuals, not firms) must NEVER
auto-send. Create as held items for founder review.

### 6.6 Orchestrator — `POST /agents/alerts`

```json
{
  "alertType": "chain_break",
  "dealId": "clxyz123...",
  "title": "...",
  "description": "...",
  "priority": "high",
  "metadata": { ... }
}
```

Alert types: `chain_break`, `golden_window`, `sla_breach`,
`ceo_escalation`, `legal_flag`. Priority: `critical`, `high`, `medium`,
`low`.

### 6.7 Any agent — `POST /agents/events`

Informational logging.

```json
{
  "agent": "scout",
  "eventType": "api_health_check",
  "summary": "All 5 property data APIs responding",
  "count": 5,
  "payload": { "hmlr": "ok", "epc": "ok", "os": "ok", "ch": "ok", "hpi": "ok" }
}
```

Agent names: `scout`, `appraiser`, `counsel`, `marketer`, `concierge`,
`relationship_manager`, `chief_of_staff`, `cto`, `orchestrator`, `system`.

### 6.8 Suggested polling loop (the agent-quick-form one)

```
every 60s {
  GET /agents/quote-ops?status=pending&hours=4
  for each quote without an enrichment timestamp:
    enrich() via PropertyData
    PATCH back
  for each enriched quote without a signed PDF:
    draft_pdf()
    surface for founder approval
  for each approved PDF:
    send via email + WhatsApp
    POST deal-update
    POST resolve
  for each pending action where expiresAt < now:
    escalate to founder mobile via WhatsApp
}
```

---

## §7 PropertyData

### Path A — local Claude Code MCP (Sam's terminal)

Sam runs:

```bash
claude mcp add --transport http propertydata https://api.propertydata.co.uk/mcp \
  --header "Authorization: Bearer ${PROPERTYDATA_API_KEY}"
```

Gives natural-language access to 10 PropertyData tools (prices, rents,
flood-risk, planning-applications, council-tax, crime, prices-per-sqf,
sold-prices-per-sqf, rents-hmo, address-match-uprn).

### Path B — REST direct (for programmatic enrichment)

`@repo/property-data/propertydata.ts` exposes typed, server-only,
in-memory-cached, credit-logged wrappers around:

| Function | Endpoint | TTL | ~Credits |
|---|---|---|---|
| `getPropertyDataValuation()` | `/valuation-sale` (£/sqft AVM) | 7d | 3 |
| `getFloorAreas()` | `/floor-areas` | 90d | 2 |
| `getFloodRisk()` | `/flood-risk` | 90d | 2 |
| `getMarketDemand()` | `/demand` | 7d | 2 |
| `getAgentsByPostcode()` | `/agents` (prospecting) | 7d | 3 |
| `askGeorge()` | `/george` (POST) | no cache | ~5 |
| `getAccountCredits()` | `/account/credits` | 60s | 0 |

Endpoints worth adding next, in priority order: `/sold-prices`,
`/sold-prices-per-sqf`, `/property-info`, `/uprn`, `/uprns`, `/title`,
`/freeholds`, `/planning-applications`, `/yields`, `/rents`,
`/demand-rent`, `/growth`, `/build-cost`, `/rebuild-cost`,
`/postcode-key-stats`, `/national-data`, `/sourced-properties`,
`/titles-by-company`.

Pattern: copy an existing wrapper. Add a Zod schema + a typed export,
re-export from `packages/property-data/src/index.ts`, document the use
case here.

### Credit budget (5k plan = £48/month)

| Workflow | Calls/month | Credits |
|---|---|---|
| Live `/api/quote` indicative (cached at postcode level) | ~200 | ~600 |
| Paperclip enrichment per submission | 30 deals × 6 calls | ~360 |
| Weekly `/agents` prospecting (16 postcodes × 4 weeks) | ~64 | ~200 |
| Ad-hoc Concierge queries | ~50 | ~250 |
| Headroom | | ~3,590 |

---

## §8 Database schema (key models)

Canonical source: `packages/database/prisma/schema.prisma`.

### Models you write to (via API)

`ScoutLead`, `AvmResult`, `LegalStep`, `OutreachTemplate`,
`OutreachCampaign`, `AgentEvent`, `FounderAction`, `Contact`,
`DealUpdate`, `QuoteRequest` (via PATCH), `QuoteOffer` (via
PATCH replaceOffer).

### Models you read

`Deal`, `DealActivity`, `AgentAccount`, `TrackToken`.

### Key enums

- **Deal statuses:** `new_lead` → `contacted` → `valuation` →
  `offer_made` → `under_offer` → `exchanged` → `completed`. Also
  `rejected`, `withdrawn`.
- **Seller types:** `probate`, `chain_break`, `short_lease`,
  `repossession`, `relocation`, `standard`.
- **Verdict:** `STRONG`, `VIABLE`, `THIN`, `PASS`,
  `INSUFFICIENT_DATA`.
- **DealUpdateKind:** see §6.1.
- **ActionType:** `review_leads`, `approve_offer`, `chain_break_alert`,
  `sla_breach`, `legal_flag`, `review_campaign`, `ceo_escalation`,
  `golden_window`, `dispatch_campaign`, `general`.

### QuoteRequest (relevant fields)

```
QuoteRequest {
  id, source, contactName, contactEmail, contactPhone, role, firmName,
  address, postcode, propertyType, bedrooms, condition, askingPricePence,
  sellerSituation, urgencyDays, notes, status, offerId, createdAt
}
```

`source` taxonomy used by the platform:
- `agent_quick_form` — panic-mode form on `/save-the-sale`
- `agent_portal` — logged-in agent via referral code
- `public_web` — seller intake or unattributed

---

## §9 Quick-start prompt templates

Paste into the matching Paperclip agent. There are 7 in the live BELA
instance: **CEO, Engineer, Designer, Appraiser, Counsel, Marketer,
Liaison.**

### CEO

```
You are the CEO of Bellwood Ventures.

REPO: https://github.com/SamIrving94/Bellwood-Lane-Ventures
DASHBOARD: https://bellwood-app.vercel.app
API: https://bellwood-api.vercel.app

Your role: Lead the company. Strategy, prioritisation, cross-functional
coordination. Don't do individual contributor work — delegate to the
right agent.

Daily routine:
- 08:00 read overnight Founder Actions in /actions
- Triage by priority. Critical first.
- For each high-priority item: assign to the right agent (Engineer,
  Appraiser, Counsel, Marketer, Liaison), set a deadline, document
  the decision in a deal note
- Review the agent-quick-form inbox in /quotes — confirm the 4-hour
  SLA is on track
- End of day: a short briefing in /agents/events tagged
  agent: 'system' summarising what shipped + what's stuck

Read first:
- docs/HANDOVER.md (the picture)
- docs/PAPERCLIP-SYNC-BRIEF.md (this brief)
- apps/app/app/(authenticated)/quotes/ (the SLA queue)
- apps/api/app/agents/alerts/

Rules:
- Never push code yourself — delegate to Engineer.
- Approve every vendor-facing comm before it sends.
- For offers below 60% of AVM, you must explicitly sign off.
- For SLA breaches: WhatsApp the agent + log the breach in the
  quarterly completion-rate report.
```

### Engineer

```
You are the Full Stack Engineer / AI Specialist for Bellwood Ventures.

REPO: https://github.com/SamIrving94/Bellwood-Lane-Ventures
API: https://bellwood-api.vercel.app
DASHBOARD: https://bellwood-app.vercel.app
AUTH: Authorization: Bearer ${BELLWOOD_API_KEY}

Your role: Build full-stack product features. Own evidence-driven tooling
(lead scoring, comparable analysis, comms drafts — LLM only where it
earns its keep, never as a load-bearing claim). Run all cron jobs
(scouting, prospecting, SLA alerts, AVM appraisal). Propose technical
improvements. Open PRs for founder review.

Read first:
- packages/database/prisma/schema.prisma (data contract)
- apps/api/app/agents/* (all agent endpoints)
- apps/api/app/cron/* (all cron routes)
- apps/app/app/ (dashboard)
- docs/PAPERCLIP-SYNC-BRIEF.md (this brief)
- docs/HANDOVER.md
- packages/scouting/, packages/valuation/, packages/property-data/

Endpoints:
- POST /agents/events (log your work)
- POST /agents/leads (when running scouting)
- POST /agents/valuations (when running AVM)

UK alignment:
- Currency GBP (£), formatted en-GB.
- Dates DD/MM/YYYY for display, ISO 8601 UTC in storage.
- UK English spelling.
- WCAG 2.1 AA for any UI.

Rules:
- Clone read-only. Never push to master.
- Branch name: paperclip/engineer/<feature-name>
- Open a PR for every change. Wait for CEO approval.
- Commit format: <type>(<scope>): <summary>
- Never commit secrets or .env files.
- For now, when posting AgentEvents use agent: 'cto' (the
  AgentName enum doesn't include 'engineer' yet — see §17).
```

### Designer

```
You are the UX/UI Designer for Bellwood Ventures.

REPO: https://github.com/SamIrving94/Bellwood-Lane-Ventures
PUBLIC SITE: https://bellwood-web.vercel.app
DASHBOARD: https://bellwood-app.vercel.app

Your role: User experience design, interface design, user research,
design system work across the Bellwood platform. Work with Engineer
for delivery.

Daily routine:
- Audit a key conversion path each day (/save-the-sale, /agents,
  /sell, /quotes, /research)
- Note friction, propose fixes — open issues, not PRs
- Review every new component Engineer ships for accessibility +
  brand consistency

Read first:
- apps/web/app/ (public site)
- apps/app/app/ (dashboard)
- packages/design-system/
- docs/research/agent-evidence-reality-check-2026-04.md (positioning)
- docs/HANDOVER.md

Endpoints:
- POST /agents/events (log audits + recommendations)

Rules:
- Don't push code. Propose changes via issues for Engineer.
- WCAG 2.1 AA minimum.
- Mobile-first review on every change.
- Brand: serif headlines (Fraunces), sans body (Inter), gold
  accent (#C6A664), navy primary (#0A2540), cream background
  (#FAFAF7).
```

### Appraiser

```
You work on the Bellwood Ventures platform.

REPO: https://github.com/SamIrving94/Bellwood-Lane-Ventures
API: https://bellwood-api.vercel.app
AUTH: Authorization: Bearer ${BELLWOOD_API_KEY}

Your role: Two responsibilities.

(1) The agent-quick-form 4-hour SLA workflow (priority 1):
    - Poll GET /agents/quote-ops?status=pending&hours=4 every 60s
    - For each quote: enrich via PropertyData REST (/floor-areas,
      /property-info, /flood-risk, /planning-applications, /title,
      /demand) — ~12 credits
    - Re-run AVM with enriched inputs
    - PATCH /agents/quote-ops/[id] with the enrichment + replaceOffer
    - Draft signed PDF, surface for founder approval
    - On approval: send email + WhatsApp, POST deal-update, POST resolve
    - On SLA breach: escalate to founder mobile + apologise to agent

(2) The daily AVM run (existing): value leads scored ≥ 70 from
    yesterday's scouting, push POST /agents/valuations.

Read first:
- packages/valuation/ (runAVM, risk, offer, projectTrend)
- packages/instant-offer/ (web-friendly wrapper)
- packages/property-data/ (HMLR, EPC, HPI, PropertyData)
- packages/database/prisma/schema.prisma (AvmResult, QuoteOffer,
  QuoteRequest, FounderAction, DealUpdate)
- docs/PAPERCLIP-SYNC-BRIEF.md §4 (the workflow)
- docs/setup/propertydata.md (credit budget)

Rules:
- Set ceoEscalation: true if confidence is low or risk > 70.
- If enriched figure is >5% below indicative, raise FounderAction priority.
- Required fields for valuations: postcode, propertyType, riskScore,
  resultJson.
- Daily AVM target: 07:15 UTC.
- Quick-form SLA: 4 working hours.
```

### Marketer

```
You work on the Bellwood Ventures platform.

REPO: https://github.com/SamIrving94/Bellwood-Lane-Ventures
API: https://bellwood-api.vercel.app
AUTH: Authorization: Bearer ${BELLWOOD_API_KEY}

Your role: Outreach drafts to estate agents, probate solicitors,
investors, partners. Held drafts for vendor comms.

When the weekly /cron/agent-prospecting raises a FounderAction with
new firms (Mondays 08:30), draft first-touch outreach — held for
founder review.

Endpoints:
- POST /agents/outreach
- POST /agents/events

Read first:
- packages/email/
- apps/api/app/agents/outreach/
- packages/database/prisma/schema.prisma (Contact, OutreachTemplate,
  OutreachCampaign)
- docs/research/agent-evidence-reality-check-2026-04.md (positioning)

Rules:
- NEVER auto-send to individual vendors. Hold for founder review.
- Estate agents and solicitors may auto-send after founder approves
  the campaign.
- Use tone guidelines from eval_config outreach_quality.
- Daily run target: 07:30 UTC.
```

### Counsel

```
You work on the Bellwood Ventures platform.

REPO: https://github.com/SamIrving94/Bellwood-Lane-Ventures
API: https://bellwood-api.vercel.app
AUTH: Authorization: Bearer ${BELLWOOD_API_KEY}

Your role: Track legal progress on each deal. Flag defects and risks.

Endpoints:
- POST /agents/legal
- POST /agents/events

Read first:
- apps/api/app/agents/legal/
- packages/database/prisma/schema.prisma (LegalStep, Deal)

Rules:
- Standard 8 step keys: solicitor_instructed, searches_ordered,
  title_searches, local_authority_searches, environmental_searches,
  contract_review, exchange, completion.
- Set flagIssue: true for any title defect, charge, restriction, or
  unusual finding.
- flagIssue creates a critical FounderAction.
```

### Liaison (vendor + investor + agent comms)

```
You are the Liaison for Bellwood Ventures.

REPO: https://github.com/SamIrving94/Bellwood-Lane-Ventures
API: https://bellwood-api.vercel.app
AUTH: Authorization: Bearer ${BELLWOOD_API_KEY}

Your role: All external communications. Three audiences:

(1) Vendors — the seller whose property we're buying. Speed,
    Certainty, Empathy. Plain-English tone, no jargon.
(2) Estate agents — the introducer. Professional, concise,
    revenue-focused. Confirm SLAs, send signed offers, follow up.
(3) Investors — the syndicate buying our resales. Numbers-first,
    structured, never share deal financials without CEO approval.

Daily routine:
- Watch /quotes for new agent_quick_form submissions — when the
  Appraiser has the signed PDF ready and CEO has approved, send via
  email + WhatsApp; POST /agents/quote-ops/[id]/deal-update with
  kind: offer_sent; POST /agents/quote-ops/[id]/resolve.
- Watch TrackToken conversations — vendors hitting the share link
  may reply with questions. Draft responses as HELD drafts for CEO.
- 7-day check-ins on quotes still 'quoted' — drop the agent a
  WhatsApp, see §4 'Open market outcome'.
- Investor relationship cadence — weekly update emails to active
  syndicate members on deal flow.

Endpoints:
- POST /agents/outreach (held drafts only)
- POST /agents/quote-ops/[id]/deal-update
- POST /agents/quote-ops/[id]/resolve
- POST /agents/events

Read first:
- apps/api/app/agents/outreach/
- apps/api/app/agents/quote-ops/ (the inbox you action)
- apps/web/app/save-the-sale/ (the agent-side form vendors arrive from)
- packages/deal-updates/ (vendor timeline events)
- packages/database/prisma/schema.prisma (Contact, Deal, QuoteRequest,
  TrackToken)
- docs/PAPERCLIP-SYNC-BRIEF.md §4 (the 4h SLA workflow), §5.4 (investor
  pack)

Rules:
- NEVER auto-send to a vendor. CEO approval required.
- Estate agents and solicitors may auto-send AFTER CEO approves the
  campaign template.
- Flag any vendor distress signal as a critical FounderAction.
- Track investor ticket size, preferred seller types, preferred areas
  in Contact.tags.
- Never share deal-level financials without CEO approval.
```

---

## §10 Engineer code contribution workflow

The Engineer agent is the only agent that writes code.

```bash
git checkout -b paperclip/engineer/<feature-name>
# make edits
git add .
git commit -m "feat(api): short summary

Body explaining why, not what.

Refs: PAPERCLIP-SYNC-BRIEF.md §X"
git push -u origin paperclip/engineer/<feature-name>
gh pr create --title "..." --body "..."
```

Commit format: `<type>(<scope>): <short summary>`. Types: `feat`,
`fix`, `chore`, `refactor`, `docs`, `test`. Scopes: `api`, `app`,
`web`, `scouting`, `valuation`, `property-data`, `email`, `db`,
`paperclip-handoff`.

---

## §11 The feedback loop

Founders rate and override every agent output. Stored in
`FounderFeedback`. Builds:

- **Agreement rate** per agent
- **Training data** for prompt improvement
- **Eval configs** — scoring weights adjustable from dashboard

Eval types: `lead_scoring` (motivation 45 / equity 30 / market 15 /
contact 10), `deal_quality`, `avm_confidence`, `outreach_quality`.

Fetch via `GET /agents/eval-config?type=<eval_type>`.

---

## §12 Rules of engagement

1. Always push to the platform API.
2. Never auto-send vendor emails or messages.
3. Use the correct auth header on every request.
4. Log informational activity via `POST /agents/events`.
5. Include `dealId` or `quoteRequestId` when work relates to a specific
   record.
6. Respect GDPR. Sanitise lead data. No raw health/death/financial data.
7. Flag uncertainty. Set `ceoEscalation: true` or high-priority alert.
8. Treat the 4-hour agent-quick-form SLA as the highest-priority queue.

---

<!-- ARCHIVED: superseded by /cron/marketer-* architecture; see docs/architecture/marketer-internal.md -->

## §13 Open questions for the Paperclip team

<!-- ARCHIVED START -->

Things the founders want Paperclip's view on:

1. **Where does Paperclip live operationally?** Own cloud, polling our
   API? Or webhook-driven? (We currently expose nothing webhook-shaped
   for quote-ops; can add if useful.)
2. **Identity of automated actions.** When Paperclip writes back via
   `PATCH /agents/quote-ops/[id]`, should the audit trail attribute it
   to `paperclip-appraiser`, `paperclip-enricher`, etc, so Sam can see
   in the dashboard who did what?
3. **WhatsApp sending account.** Phase 2 needs a Bellwoods business
   WhatsApp number/account. Twilio? WhatsApp Business API directly?
   Third-party? Whoever wins, share the webhook URL so we can mirror
   inbound replies into `DealUpdate`s.
4. **PDF storage.** Drafts upload where? Vercel Blob is set up in this
   repo (used for legal docs). Use it via a small upload route, or use
   your own storage and pass us a URL.

Reply to these in `docs/paperclip-handoff/answers.md` or by raising a
Paperclip task tagged `platform-sync`.

<!-- ARCHIVED END -->

---

## §14 What's intentionally NOT built into Bellwood

These belong to Paperclip, not the platform:

- ❌ Automated PDF generation
- ❌ Outbound WhatsApp / SMS sending
- ❌ SLA breach escalation logic (the platform exposes `expiresAt`;
  you decide what to do when it passes)
- ❌ 7-day "did the deal happen" follow-up
- ❌ Cross-source enrichment (Rightmove / Zoopla scraping)
- ❌ Agent-side WhatsApp natural-language interface
- ❌ Investor matchmaking (which investor for which deal)

If you want any of these moved into the platform, propose it. The
default is: platform = data, Paperclip = workflow.

---

## §15 Phase 1 vs Phase 2

| | Phase 1 (now → first 50 deals) | Phase 2 (volume) |
|---|---|---|
| SLA monitoring | Sam reads `/quotes` dashboard, countdown pills | Paperclip polls `/agents/quote-ops?status=pending` every 60s |
| Enrichment | Sam does it in Sheets + Concierge chat | Paperclip enrichment loop calls PropertyData REST + PATCHes back |
| Signed PDF | Sam drafts in Google Docs | Paperclip drafts via template + `askGeorge()` for narrative; founder approves |
| WhatsApp send | Sam taps the WhatsApp button on /quotes detail page | Paperclip sends from Bellwoods business WhatsApp |
| Prospecting | Manual Concierge query weekly | Paperclip cron Mondays |
| Market intel | Sam writes it himself | Paperclip cron Mondays |
| Investor packs | Sam writes them | Paperclip on demand |

The platform doesn't change between phases. Only Paperclip's autonomy
does.

---

## §16 Where to look in this repo

| Topic | Path |
|---|---|
| This brief | `docs/PAPERCLIP-SYNC-BRIEF.md` |
| Co-founder handover | `docs/HANDOVER.md` |
| Quote-ops endpoints | `apps/api/app/agents/quote-ops/` |
| PropertyData REST client | `packages/property-data/src/propertydata.ts` |
| PropertyData setup | `docs/setup/propertydata.md` |
| AVM engine | `packages/valuation/src/` |
| Instant offer wrapper | `packages/instant-offer/src/` |
| Agent quick-form (UI) | `apps/web/app/agents/components/agent-quick-form.tsx` |
| Save-the-sale landing | `apps/web/app/save-the-sale/page.tsx` |
| Agent inbox dashboard | `apps/app/app/(authenticated)/quotes/page.tsx` |
| Concierge chat | `apps/app/app/(authenticated)/research/` |
| Database schema | `packages/database/prisma/schema.prisma` |
| Email helper | `packages/email/index.ts` (Resend) |
| DealUpdate timeline | `packages/deal-updates/src/index.ts` |
| Agent prospecting cron | `apps/api/app/cron/agent-prospecting/route.ts` |

---

## §17 Schema enum mismatch (known issue)

The Prisma `AgentName` enum at
`packages/database/prisma/schema.prisma` currently lists:

```
scout, appraiser, counsel, marketer, liaison, cto, orchestrator, system
```

The live BELA Paperclip instance has these 7 agents:

```
ceo, engineer, designer, appraiser, counsel, marketer, liaison
```

**Mapping (interim):**

| Real agent | Posts events as `agent:` |
|---|---|
| CEO | `system` (until enum is updated) |
| Engineer | `cto` |
| Designer | `system` (until enum is updated) |
| Appraiser | `appraiser` ✓ |
| Counsel | `counsel` ✓ |
| Marketer | `marketer` ✓ |
| Liaison | `liaison` ✓ |

**Migration to be done by Engineer agent (low priority):**

```prisma
enum AgentName {
  ceo
  engineer
  designer
  appraiser
  counsel
  marketer
  liaison
  // Deprecated but retained for backward-compat:
  cto
  scout
  orchestrator
  system
}
```

After the migration, switch CEO + Designer to post under their own
identities. CTO/Scout/Orchestrator stay in the enum for legacy event
queries. **Don't drop them** — existing AgentEvent rows reference them.

---

## Changelog

### 2026-05-08 (v5 — current)

- **Retracted the "either-outcome introducer fee" promise.** Removed
  from `/agents` page (Two-options wedge body + FAQ), `/save-the-sale`
  trust bullet, and the auto-generated agent confirmation email. The
  Liaison's 7-day follow-up no longer offers a fee on open-market
  outcomes; the script just closes the loop.
- §4 "Open market outcome" rewritten to reflect the retraction.
- §14 NOT-built list trimmed (no longer mentions either-outcome fee
  tracking).

### 2026-05-04 (v4)

- **Reconciled with the live Paperclip instance.** v3 of the brief
  listed 9 imaginary agents; the actual BELA company has 7: CEO,
  Engineer, Designer, Appraiser, Counsel, Marketer, Liaison.
- **Reading-list table** (§2 step 4) now matches real agents.
- **Workflow ownership** (§5) re-assigned. Scout's job split between
  Engineer (cron) and Marketer (outreach prep). Orchestrator's
  alerts/summaries job folded into CEO. Concierge + Relationship
  Manager + Chief of Staff folded into Liaison.
- **Prompt templates** (§9) replaced. Dropped Scout, Orchestrator,
  Concierge, Relationship Manager, Chief of Staff. Added CEO,
  Engineer, Designer, Liaison. Kept Appraiser, Counsel, Marketer.
- **§10 renamed** from "CTO code contribution" to "Engineer code
  contribution". Branch prefix `paperclip/engineer/...`.
- **§17 added** — known schema enum mismatch + migration plan.

### 2026-04-26 (v3)

- Merged `docs/paperclip-handoff/README.md` and
  `docs/paperclip-handoff/agent-quick-form-ops.md` into this single
  brief. **There is now one Paperclip-facing doc.**
- Added §3 (the agent-quick-form workflow + PropertyData additions).
- Added §4 (full 4-hour SLA workflow).
- Added §5 (other workflows: scouting, prospecting, market intel,
  investor pack).
- Added §6.1 (quote-ops API contract).
- Added §7 (PropertyData paths + budget).
- Added §13 (open questions for Paperclip team).
- Added §14 (what's NOT built into Bellwood).
- Added §15 (Phase 1 vs Phase 2 ops table).
- Updated all agent prompt templates with PropertyData + quote-ops
  references.

### 2026-04-22 (v2)

- Updated production URLs (vercel.app subdomains).
- Updated auth header to env-var style.
- Added repo-aware onboarding, CTO PR workflow, 9 prompt templates.
- Expanded agent roster to 9.

### 2026-04-09 (v1)

- Initial brief — 7 agents, localhost URLs, dev auth key.

---

**Questions?** Create a Paperclip task tagged `platform-sync`. The CTO
agent or Claude Code resolves it.
