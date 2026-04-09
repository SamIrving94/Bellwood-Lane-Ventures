# Paperclip Agent Sync Brief — Bellwood Ventures Platform

**Date:** 9 April 2026
**From:** Samir (Founder)
**To:** All Paperclip Agents (Scout, Appraiser, Counsel, Marketer, Liaison, CTO, Orchestrator)

---

## What is the Bellwood Platform?

A Next.js dashboard and CRM at `C:\Users\samir\bellwood-app`. This is the **single source of truth** for all Bellwood Ventures deal pipeline, leads, valuations, contacts, and outreach. It runs at:

- **App (dashboard):** http://localhost:3000
- **API (agent ingestion + crons):** http://localhost:3002
- **GitHub:** https://github.com/SamIrving94/Bellwood-Lane-Ventures

**Every agent action that produces data must push it to the platform via the API.** The founders review, rate, and override your outputs from the dashboard. Your work is wasted if it doesn't land in the platform.

---

## Tech Stack

- **Framework:** Next.js 15, TypeScript, React 19
- **Database:** PostgreSQL on Neon (via Prisma ORM)
- **Auth:** Clerk (founders only)
- **Monorepo:** Turborepo + pnpm
- **Business Logic Packages:** `@repo/property-data`, `@repo/scouting`, `@repo/valuation`

---

## How to Push Data to the Platform

All agent API routes are at `http://localhost:3002/agents/*`.

### Authentication

Every request must include:
```
Authorization: Bearer bellwood-dev-paperclip-key-change-in-prod
Content-Type: application/json
```

### Available Endpoints

#### 1. Scout → `POST /agents/leads`

Push new leads from scouting runs.

```json
{
  "leads": [
    {
      "runDate": "2026-04-09T07:00:00Z",
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
  "runSummary": {
    "fetched": 25,
    "enriched": 12,
    "summary": "Scout found 3 qualified leads (2 STRONG, 1 VIABLE)"
  }
}
```

**What happens:**
- Creates `ScoutLead` records in the database
- Logs an `AgentEvent` (agent: "scout", eventType: "leads_created")
- If any lead scores >= 70, creates a `FounderAction` ("Review X new leads scored 70+")
- Founders see it in the Action Centre

**Required fields:** runDate, source, address, postcode, leadType, leadScore, verdict
**Verdict enum:** `STRONG` | `VIABLE` | `THIN` | `PASS` | `INSUFFICIENT_DATA`

---

#### 2. Appraiser → `POST /agents/valuations`

Push AVM results for a deal.

```json
{
  "dealId": "clxyz123...",
  "postcode": "BR1 4AA",
  "propertyType": "semi-detached",
  "riskScore": 35,
  "resultJson": {
    "hedonic": { "value": 24500000 },
    "csa": { "adjustedMedian": 23800000 },
    "offer": {
      "offerPence": 18900000,
      "marginPercent": 22.8,
      "ceoEscalation": false
    },
    "verdict": "STRONG",
    "riskFactors": [],
    "preRicsFlags": []
  },
  "expiresAt": "2026-05-09T00:00:00Z"
}
```

**What happens:**
- Creates `AvmResult` record
- Updates the linked `Deal` with estimatedMarketValuePence, ourOfferPence, marginPercent, verdict
- If `ceoEscalation: true`, creates a **critical** FounderAction requiring founder sign-off
- Otherwise creates a **medium** "Approve offer" FounderAction
- Logs activity on the deal timeline

**Required fields:** postcode, propertyType, riskScore, resultJson

---

#### 3. Counsel → `POST /agents/legal`

Update legal steps or flag issues on a deal.

```json
{
  "dealId": "clxyz123...",
  "stepKey": "title_searches",
  "completed": true,
  "notes": "Title clean. No charges or restrictions found.",
  "flagIssue": false
}
```

To flag a legal issue:
```json
{
  "dealId": "clxyz123...",
  "stepKey": "title_searches",
  "completed": false,
  "notes": "Title defect found — unregistered easement across rear garden",
  "flagIssue": true
}
```

**What happens:**
- Upserts the `LegalStep` record
- If `flagIssue: true`, creates a **critical** FounderAction ("Legal flag: ...")
- Logs activity on the deal timeline

**Legal step keys (standard 8-step flow):**
`solicitor_instructed`, `searches_ordered`, `title_searches`, `local_authority_searches`, `environmental_searches`, `contract_review`, `exchange`, `completion`

---

#### 4. Marketer → `POST /agents/outreach`

Submit outreach campaigns for founder review.

```json
{
  "campaignName": "Probate Solicitors Q2 2026",
  "templates": [
    {
      "name": "Probate Solicitor Intro",
      "subject": "Supporting your clients through property sales",
      "body": "Dear {{name}},\n\nI'm writing from Bellwood Ventures...",
      "type": "probate_solicitor",
      "sequence": 1,
      "delayDays": 0
    },
    {
      "name": "Probate Solicitor Follow-up",
      "subject": "Following up — property support for executors",
      "body": "Hi {{name}},\n\nI wanted to follow up...",
      "type": "probate_solicitor",
      "sequence": 2,
      "delayDays": 7
    }
  ],
  "recipientContactIds": ["contact_id_1", "contact_id_2"],
  "summary": "Campaign targeting 15 probate solicitors in SE London"
}
```

**What happens:**
- Creates `OutreachTemplate` records
- Creates `OutreachCampaign` in "draft" status
- Creates a **medium** FounderAction ("Review outreach campaign: ...")
- Founders must approve before any emails send

**CRITICAL RULE:** Direct vendor comms (to individuals, not firms) must NEVER auto-send. The Marketer agent should create these as held items for founder review.

---

#### 5. Orchestrator → `POST /agents/alerts`

Send alerts for chain breaks, golden windows, deadlines.

```json
{
  "alertType": "chain_break",
  "dealId": "clxyz123...",
  "title": "Chain break alert: 8 Elm St — vendor mortgage expires in 6 weeks",
  "description": "The vendor has a mortgage offer expiring on 21 May 2026...",
  "priority": "high",
  "metadata": {
    "mortgageExpiryDate": "2026-05-21",
    "goldenWindowExpiresAt": "2026-05-14",
    "suggestedNextAction": {
      "action": "Schedule viewing and prepare offer",
      "reasoning": "High equity, motivated seller, 6-week window",
      "agent": "orchestrator"
    }
  }
}
```

**Alert types:** `chain_break`, `golden_window`, `sla_breach`, `ceo_escalation`, `legal_flag`
**Priority:** `critical`, `high`, `medium`, `low`

**What happens:**
- Creates FounderAction visible in the Action Centre
- If dealId provided, updates the deal's goldenWindowExpiresAt, mortgageExpiryDate, suggestedNextAction
- Logs on the deal timeline

---

#### 6. Any Agent → `POST /agents/events`

Log any agent activity (informational, no action needed).

```json
{
  "agent": "scout",
  "eventType": "api_health_check",
  "summary": "All 5 property data APIs responding normally",
  "count": 5,
  "payload": { "hmlr": "ok", "epc": "ok", "os": "ok", "ch": "ok", "hpi": "ok" }
}
```

**Agent names:** `scout`, `appraiser`, `counsel`, `marketer`, `liaison`, `cto`, `orchestrator`, `system`

---

## The Feedback Loop (Why This Matters)

The founders rate and override every agent output:

- **Leads:** 1-5 star rating, override leadScore and verdict
- **Valuations:** Rate accuracy, override estimated value and offer
- **Outreach:** Rate quality, edit emails, mark perfect templates
- **Deals:** Overall rating, override verdict

This feedback is stored in `FounderFeedback` records. Over time, it builds:
- **Agreement rate** per agent (how often founders agree vs override)
- **Training data** for improving agent prompts and scoring
- **Eval configs** — the founders can adjust scoring weights from the dashboard

### Eval Configs (Live Scoring Parameters)

The platform stores versioned JSON configs that agents should reference:

| Eval Type | Controls |
|:---|:---|
| `lead_scoring` | Motivation 45%, Equity 30%, Market 15%, Contact 10% + verdict thresholds |
| `deal_quality` | Seller type margins, min margin %, max risk score, preferred types/areas |
| `avm_confidence` | Data source weights, appreciation rate, type discounts, max discounts |
| `outreach_quality` | Tone guidelines per recipient type, follow-up schedules |

Agents should fetch the active eval config before each run. These will be exposed via a `GET /agents/eval-config?type=lead_scoring` endpoint (coming soon). Until then, use the defaults documented in the seed configs.

---

## Database Schema (Key Models)

### Models agents write to (via API):
- **ScoutLead** — leads from scouting runs
- **AvmResult** — valuation results (linked to deals)
- **LegalStep** — legal progress tracking
- **OutreachTemplate** / **OutreachCampaign** — email campaigns
- **AgentEvent** — audit log of all agent activity
- **FounderAction** — items requiring founder decision

### Models agents should know about:
- **Deal** — the core entity (address, postcode, type, beds, seller type, status, prices, verdict)
- **DealActivity** — timeline of events on a deal
- **Contact** — CRM contacts (estate agents, solicitors, vendors, investors)

### Deal statuses (pipeline stages):
`new_lead` → `contacted` → `valuation` → `offer_made` → `under_offer` → `exchanged` → `completed`
Also: `rejected`, `withdrawn`

### Seller types:
`probate`, `chain_break`, `short_lease`, `repossession`, `relocation`, `standard`

### Verdict enum:
`STRONG`, `VIABLE`, `THIN`, `PASS`, `INSUFFICIENT_DATA`

---

## The Daily Pipeline (Target Schedule)

| Time | Stage | Agent | Description |
|:---|:---|:---|:---|
| 07:00 | Scout | Scout | Find new leads, enrich, score, push via `/agents/leads` |
| 07:15 | Appraise | Appraiser | Value leads scored >= 70, push via `/agents/valuations` |
| 07:30 | Outreach | Marketer | Draft/send comms to agents & solicitors. HOLD vendor comms for review |
| 08:00 | Summary | Orchestrator | Create morning summary action for founders |
| 09:00 | SLA Check | System | Flag deals stuck too long in a stage |

---

## Business Logic Packages (Already Built by CTO/Scout/Appraiser)

These live in the platform repo and can be imported:

### `@repo/property-data`
- `lookupProperty(postcode)` — parallel calls to HMLR, EPC, Companies House, OS Places, HPI
- `getPricePaid(postcode)` — Land Registry comparable sales
- `getHousepriceIndex(postcode)` — Market trend data
- `getEpcData(postcode)` — Energy ratings
- `getEstateOwnership(postcode)` — Companies House data
- `resolveAddress(postcode)` — OS Places geocoding

### `@repo/scouting`
- `runScoutingPipeline({ limit, minScore })` — full pipeline: fetch → enrich → score → filter
- `scoreLead(lead, pricePaid, hpi)` — scoring engine
- `enrichLeads(leads)` — tier 1/2/3 data cascade
- `sanitiseForGdpr(data)` — GDPR field stripping

### `@repo/valuation`
- `runAVM(input)` — full AVM: base valuation → risk scoring → offer calculation → trend projection
- `calculateBaseValuation(postcode, propertyType, pricePaid, hpi)` — hedonic + CSA
- `calculateRiskScore(epc, hpi)` — 0-100 environmental + structural risk
- `calculateOffer(valuation, riskScore, sellerType)` — offer with margins
- `projectTrend(hpi)` — 36-month price forecast

---

## Rules of Engagement

1. **Always push to the platform API.** Don't store results only in Paperclip.
2. **Never auto-send vendor emails.** Estate agents and solicitors are OK. Individuals always require founder review.
3. **Use the correct auth header** on every request.
4. **Log events** even for informational activity — it feeds the agent performance dashboard.
5. **Include dealId** when your work relates to a specific deal — it appears on the deal timeline.
6. **Respect GDPR.** Run all lead data through the sanitiser before storing. No health, death, or financial data in raw form.
7. **Flag uncertainty.** If you're not confident, set `ceoEscalation: true` or create a high-priority alert. Better to ask the founders than to get it wrong.

---

## What's Coming Next

- **GET /agents/eval-config** — fetch active scoring weights before each run
- **GET /agents/feedback** — fetch founder feedback on your recent outputs to learn from
- **Outreach hold review** — founders approve/edit/reject vendor emails from the dashboard
- **Training data export** — JSONL export of all feedback for prompt improvement

---

## Questions?

If any agent is unclear on how to integrate, create a Paperclip task tagged `platform-sync` and the CTO agent or Claude Code will help resolve it.

**The platform is live. Start pushing data.**
