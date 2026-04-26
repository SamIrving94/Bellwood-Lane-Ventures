# Paperclip Handoff — The Master Brief

**Audience:** Paperclip team (the AI-agent ops layer separate from this repo).
**Purpose:** One page that explains what the Bellwood platform does, what it
expects Paperclip to do on top, and exactly which APIs + tools you have.

If you only read one section, read **§4 — What Paperclip needs to do**.

---

## 1. The split — platform vs. ops

The Bellwood Lane stack is two halves working together:

```
┌────────────────────────────────────┐  ┌────────────────────────────────┐
│       BELLWOOD PLATFORM            │  │           PAPERCLIP            │
│       (this repo)                  │  │    (your separate environment) │
│                                    │  │                                │
│  apps/web   public site            │  │  AI-agent ops:                 │
│  apps/app   founder dashboard      │  │  - Enrichment workflows        │
│  apps/api   integration endpoints  │  │  - Signed PDF drafting         │
│                                    │◄─┤  - WhatsApp/email reach-out    │
│  Source of truth for:              │  │  - SLA monitoring + escalation │
│  - QuoteRequests, QuoteOffers      │  │  - 7-day deal follow-ups       │
│  - AgentAccounts                   │  │  - Weekly market intel         │
│  - Deals, DealUpdates              │  │  - Agent prospecting           │
│  - FounderActions (the queue)      │  │                                │
│  - AvmResults                      │  │  Authenticates via:            │
│                                    │  │   Authorization: Bearer        │
│                                    │  │     ${PAPERCLIP_API_KEY}       │
│                                    │  │                                │
│  + AVM engine (real HMLR + EPC +   │  │  Hits: bellwood-api.vercel.app │
│    HPI + PropertyData /valuation-  │  │                                │
│    sale 20% cross-check)           │  │                                │
│                                    │  │                                │
│  + Bellwoods Concierge             │  │                                │
│    (PropertyData /george AI in the │  │                                │
│     dashboard for ad-hoc research) │  │                                │
└────────────────────────────────────┘  └────────────────────────────────┘
```

**Architectural principle:** the platform writes truth, Paperclip runs ops on
top. The platform doesn't change between Phase 1 (manual ops) and Phase 2
(automated ops) — only Paperclip does. The platform never queues outbound
work in Paperclip; Paperclip pulls work from the platform.

---

## 2. What you can read from the platform

Single endpoint family, all auth-gated via the existing
`Authorization: Bearer ${PAPERCLIP_API_KEY}` shared secret:

### `apps/api/agents/quote-ops/`

| Method + Path | Purpose |
|---|---|
| `GET /agents/quote-ops?status=pending&hours=48` | Inbox — agent submissions awaiting signed PDF, oldest first, with their live SLA Founder Action |
| `GET /agents/quote-ops/[id]` | Full detail — QuoteRequest + QuoteOffer + DealUpdates + all matching FounderActions |
| `PATCH /agents/quote-ops/[id]` | Enrichment writeback (bedrooms, propertyType, condition, askingPricePence, notesAppend, optional replaceOffer) |
| `POST /agents/quote-ops/[id]/deal-update` | Append an event to the vendor-facing timeline (`DealUpdateKind` enum) |
| `POST /agents/quote-ops/[id]/resolve` | Mark the SLA Founder Action complete — stops the 4-hour clock |

Full request/response shapes in `agent-quick-form-ops.md` (this folder).

### Existing `apps/api/agents/*` routes you may also use

| Route | Purpose |
|---|---|
| `agents/dispatch` | Generic agent task dispatcher |
| `agents/leads` | Push new ScoutLeads into the platform |
| `agents/legal` | Update legal step state on a deal |
| `agents/outreach` | Push outreach activity records |
| `agents/valuations` | Push AvmResult enrichments |
| `agents/events` | Generic agent-event log |
| `agents/intake/whatsapp` | Push parsed WhatsApp intake records |

These predate the agent quick-form workflow and serve other Paperclip jobs
(scouting, legal automation, valuation enrichment for existing deals).

---

## 3. PropertyData — the data feed you share with the dashboard

PropertyData (propertydata.co.uk) is wired into the platform via
`@repo/property-data`. Two paths, both under the **same API key**:

### Path A — for ad-hoc research

- **Local Claude Code:** add the MCP server with the one-line command in
  `docs/setup/propertydata.md`. Gives natural-language access to 10 of
  PropertyData's tools (prices, rents, flood-risk, planning-applications,
  council-tax, crime, prices-per-sqf, sold-prices-per-sqf, rents-hmo,
  address-match-uprn).
- **Bellwoods Concierge in the dashboard:** founders open `/research` in
  apps/app and chat with George (PropertyData's hosted AI) on top of all 60+
  data feeds. Same data, no client install. Conversation history preserved
  per session.

You — Paperclip — can drive both surfaces if useful, but you have a third,
better path:

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

You will likely want more endpoints. The pattern in `propertydata.ts` is
clean — copy the existing wrappers. Endpoints worth adding next, in priority
order:

- `/sold-prices`, `/sold-prices-per-sqf` — richer comp set when HMLR is thin
- `/property-info`, `/uprn`, `/uprns` — address resolution and full property
  records (replaces our `propertyType: 'other'` fallback)
- `/title`, `/freeholds` — short-lease detection before survey
- `/planning-applications` — risk flagging
- `/yields`, `/rents`, `/demand-rent`, `/growth` — resale strategy +
  investor packs
- `/build-cost`, `/rebuild-cost` — problem-property underwriting
- `/postcode-key-stats`, `/national-data` — weekly market intel briefings
- `/sourced-properties`, `/titles-by-company` — outbound deal sourcing

Credit budget at the API 5k plan (£48/mo): comfortable headroom for current
volume. See `docs/setup/propertydata.md` § 4 for the budget model.

---

## 4. What Paperclip needs to do (the workflow)

The agent-quick-form workflow is the most concrete piece. Everything else is
adjacent.

### 4.1 The 4-hour SLA workflow (priority 1)

**Trigger:** new `QuoteRequest` rows with `source = 'agent_quick_form'`,
`status = 'quoted'`, `createdAt > now - 4h`.

**Polling (v1, until we add webhooks):**

```
every 60s:
  GET /agents/quote-ops?status=pending&hours=4
  for each quote without an enrichment timestamp:
    enrich() → PATCH the writeback
  for each enriched quote without a signed PDF:
    draft_pdf() → surface for founder approval
  for each approved PDF:
    send() → POST deal-update + POST resolve
  for each pending action where expiresAt < now:
    escalate() → notify founder mobile via WhatsApp
```

**Per-quote workflow:**

| When | Step | Tools used |
|---|---|---|
| 0–30 min | Enrichment | PropertyData `/floor-areas`, `/property-info`, `/flood-risk`, `/planning-applications`, `/title`, `/demand`. ~12 credits per quote. |
| 0–30 min | Re-run AVM with full inputs | `@repo/valuation.runAVM()` — Paperclip can call this in its own runtime, or post the result via `PATCH replaceOffer` |
| 30–60 min | Draft signed PDF | Use `docs/templates/binding-offer-letter.md` (template — write if not yet present); store in Vercel Blob; reference URL in `notesAppend` |
| 60–120 min | Founder approval | Surface in `/actions` via existing FounderAction |
| Within 4h | Send | Email + WhatsApp to agent's `contactEmail` / `contactPhone`; then `POST /agents/quote-ops/[id]/deal-update` (kind: `offer_sent`) and `POST /agents/quote-ops/[id]/resolve` |
| If `expiresAt < now` | Escalate | WhatsApp founder mobile + email apology + new ETA to agent + log breach for quarterly report |

### 4.2 7-day "did the deal happen" follow-up

After 7 days, if `QuoteRequest.status` is still `quoted`:

- WhatsApp the agent: *"Quick check — what happened with [address]? If the
  open market was the better route, no problem. We'll instruct as introducer
  if you'd like. Reply 'open' or 'taken'."*
- On reply `open`: raise a `FounderAction` to issue the introducer fee per
  our either-outcome promise (the wedge from /agents).
- On reply `taken`: `POST deal-update` with `kind: 'offer_accepted'` plus
  the outcome, close the loop.

### 4.3 Weekly agent prospecting (priority 2)

Cron, Mondays at 8am UK:

1. For each of our 20 target postcodes, call `getAgentsByPostcode()`
2. Cross-reference against existing `AgentAccount` records (skip already-
   contacted firms unless their listing volume changed materially)
3. Output a ranked list — feed into the existing outreach flow in
   `apps/app/(authenticated)/outreach`
4. Ping Sam in Slack/email with the new firms surfaced this week

~60 credits/month. The killer prospecting endpoint.

### 4.4 Weekly market intel briefing (priority 3)

Cron, Mondays at 9am UK:

1. Pull `/national-data` and `/postcode-key-stats` for our priority regions
2. Generate a 150-word WhatsApp-friendly briefing using `askGeorge()` (the
   `/george` endpoint) with our context preset
3. Push to the existing `OutreachCampaign` flow as a "Market Brief Mon"
   message → all Preferred-tier agents

~10 credits/week.

### 4.5 Investor pack generation (priority 4)

When Sam routes a deal to an investor (deal `status` transitions to a
to-be-defined `routed_to_investor` substate, or a `FounderAction` with
`type: 'investor_pack_request'`):

1. Pull `/yields`, `/rents`, `/demand-rent`, `/growth`, `/household-income`,
   `/sourced-properties` (for competitive context)
2. Generate a one-page markdown pack via `askGeorge()` with structured
   prompts
3. Email + WhatsApp to the investor with PDF attached

~8 credits per pack.

---

## 5. Authentication — how to call us

All quote-ops endpoints expect:

```
Authorization: Bearer ${PAPERCLIP_API_KEY}
```

The shared secret is set on Vercel for the `bellwood-api` project. Confirm
with Sam if you don't have it. Do not put it in source. Do not log it.

The PropertyData key (`PROPERTYDATA_API_KEY`) is set on `bellwood-web`,
`bellwood-app`, and `bellwood-api`. Paperclip can call PropertyData using
its own copy of the key — they're separate concerns. If Paperclip's call
volume needs to be tracked against ours for billing, share the same key;
otherwise PropertyData are happy to issue a second key.

---

## 6. What's intentionally NOT built into Bellwood

These belong to Paperclip, not the platform:

- ❌ Automated PDF generation
- ❌ Outbound WhatsApp sending
- ❌ SLA breach escalation logic (the platform exposes the deadline; you
  decide what to do when it passes)
- ❌ 7-day follow-up workflow
- ❌ Either-outcome introducer fee tracking past the FounderAction
- ❌ Cross-source enrichment (Rightmove, Zoopla scraping)
- ❌ Agent-side WhatsApp natural-language interface
- ❌ Investor matchmaking (which investor for which deal)

If you want any of these *moved* into the platform, propose it — there are
cases for it (centralised compliance audit trail, for example) — but the
default is: platform = data, Paperclip = workflow.

---

## 7. Phase 1 vs Phase 2

| | Phase 1 (now → first 50 deals) | Phase 2 (volume) |
|---|---|---|
| SLA monitoring | Sam reads `/quotes` dashboard, countdown pills | Paperclip polls `/agents/quote-ops?status=pending` every 60s |
| Enrichment | Sam does it in Google Sheets + Concierge chat | Paperclip enrichment loop calls PropertyData REST + PATCHes back |
| Signed PDF | Sam drafts in Google Docs | Paperclip drafts via template + `askGeorge()` for narrative; founder approves |
| WhatsApp send | Sam taps the WhatsApp button on /quotes detail page | Paperclip sends from Bellwoods business WhatsApp |
| Prospecting | Manual Concierge query weekly | Paperclip cron Mondays |
| Market intel | Sam writes it himself when he can | Paperclip cron Mondays |

The platform doesn't change between phases. Only Paperclip's level of
autonomy does.

---

## 8. Where to look in this repo

| Topic | Path |
|---|---|
| Quote-ops endpoints | `apps/api/app/agents/quote-ops/` |
| Quote-ops contracts | `docs/paperclip-handoff/agent-quick-form-ops.md` |
| PropertyData REST client | `packages/property-data/src/propertydata.ts` |
| PropertyData setup | `docs/setup/propertydata.md` |
| AVM engine | `packages/valuation/src/` |
| Agent quick-form (UI) | `apps/web/app/agents/components/agent-quick-form.tsx` |
| Save-the-sale landing | `apps/web/app/save-the-sale/page.tsx` |
| Agent inbox dashboard | `apps/app/app/(authenticated)/quotes/page.tsx` |
| Concierge chat | `apps/app/app/(authenticated)/research/` |
| Database schema | `packages/database/prisma/schema.prisma` |
| Email helper | `packages/email/index.ts` (Resend wrapper) |
| DealUpdate timeline | `packages/deal-updates/src/index.ts` |

---

## 9. Open questions for the Paperclip team

Things we'd appreciate Paperclip's view on before we lock the workflow:

1. **Where does Paperclip live operationally?** Does Paperclip run in your
   own cloud, polling our API? Or do you want us to push events via
   webhook? (We currently expose nothing webhook-shaped for quote-ops; can
   add if useful.)

2. **Identity of automated actions.** When Paperclip writes back via
   `PATCH /agents/quote-ops/[id]`, should the audit trail attribute it to
   `paperclip-appraiser`, `paperclip-enricher`, etc, so Sam can see in the
   dashboard who did what? (Currently just `resolvedBy` on FounderActions
   is freeform.)

3. **WhatsApp sending account.** Phase 2 needs a Bellwoods business
   WhatsApp number/account. Paperclip's choice of provider (Twilio,
   WhatsApp Business API directly, third-party). Whoever wins, share the
   webhook URL so we can mirror inbound replies into `DealUpdate`s for the
   vendor-facing timeline.

4. **PDF storage.** Paperclip drafts → uploads where? Vercel Blob is set up
   in this repo (used for legal docs). Paperclip can use it via a small
   `apps/api/blob-upload` route, or use its own storage and pass us a URL.
