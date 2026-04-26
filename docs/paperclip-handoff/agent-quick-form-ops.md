# Paperclip Ops Brief: Agent Quick-Form Submissions

**Status:** Live as of this commit. Bellwood platform creates the records;
Paperclip runs the ops workflow on top. Manual at the start, automatable
later.

---

## What the Bellwood platform does (already built)

When an agent submits at `/save-the-sale` or `/agents` (form id:
`agent_quick_form`), the Bellwood platform:

1. Creates a `QuoteRequest` row in Postgres
   - `source = 'agent_quick_form'`
   - `notes` contains `Trigger: <chip>\nSource: agent_quick_form`
   - `contactEmail`, `contactPhone` (work mobile if shared), `firmName`
   - `address`, `postcode`, `sellerSituation` (mapped enum)
2. Generates an indicative offer via `@repo/instant-offer` → `@repo/valuation`
   - Real HMLR Price Paid Data, real EPC, real HPI when APIs respond
   - Synthetic fallback when APIs time out (flagged in `offer.confidenceScore`)
   - Stored as a `QuoteOffer` row
3. Creates a `FounderAction` with `expiresAt = +4h` — the SLA hook
4. Sends agent confirmation email via Resend (acknowledgement only)
5. Returns the offer figure to the form for on-screen display
6. Records a `DealUpdate` and generates a vendor-shareable `trackUrl`

The agent walks away with: an on-screen number, a confirmation email, and a
WhatsApp/email-ready vendor link.

---

## What Paperclip needs to do (the ops workflow)

### Trigger

Watch for new `QuoteRequest` rows where:

- `source = 'agent_quick_form'`
- `status = 'quoted'` (not `processing`, not `draft`)
- `createdAt > now - 4h`

Polling every 60s is fine for v1. Webhook later.

### Workflow (the 4-hour SLA)

**Within 30 minutes of submission:**

1. **Enrich the data the panic-form didn't capture**

   Use the PropertyData REST API (key in env as `PROPERTYDATA_API_KEY` —
   see `docs/setup/propertydata.md`) for the heavy lifting:

   | Endpoint | Returns | Why |
   |---|---|---|
   | `/floor-areas` | EPC sqft + bedrooms by postcode | Fixes the missing-inputs problem from the panic form |
   | `/property-info` | Property type, tenure, build year | Replaces the `propertyType: 'other'` default |
   | `/flood-risk` | Rivers/sea + surface water risk | Material risk factor |
   | `/planning-applications` | Active + recent apps near postcode | Enforcement notices, refusals — risk |
   | `/title` | Freehold/leasehold, lease length | Catches short leases before survey |
   | `/demand` | Days on market + sales-demand score | Informs how aggressive our offer can be |

   Then Companies House check on the agent's firm (already in
   `@repo/property-data`).

   Total credit cost per enrichment: ~12 credits = £0.10 at the 5k plan.

   PATCH the writeback via `PATCH /agents/quote-ops/[id]` with the new
   bedrooms / propertyType / condition / notesAppend.

2. **Re-run the AVM with full inputs**
   - Call `@repo/valuation.runAVM()` with the enriched inputs
   - The figure may move — record the delta vs. the indicative
   - If the new figure is >5% below the indicative, flag for founder review
     (raise priority on the existing `FounderAction`)

3. **Draft the signed offer PDF**
   - Use `docs/templates/binding-offer-letter.md` as the template
   - Include: address, agent firm, indicative figure, enriched figure,
     completion timeline, walk-away cover, RICS-defect carve-out, methodology
     reference, signature line
   - Generate PDF, stash in Vercel Blob, update `QuoteOffer.signedOfferUrl`

**Within 2 working hours:**

4. **Founder approval**
   - Surface in `/actions` (Action Centre) with link to PDF preview
   - Sam or co-founder clicks "Approve & Send"
   - On approve: PDF is signed (DocuSign or manual e-sig) and queued for send

**Within 4 working hours (the SLA):**

5. **Send the signed PDF**
   - Email the signed PDF to `contactEmail`, with a one-line agent message
   - If `contactPhone` is set, send a WhatsApp via Bellwood's business
     account: "Your signed offer for [address] just landed in [email].
     Reply here if anything urgent."
   - Resolve the `FounderAction` — set `status = 'completed'`, `resolvedAt = now`

### SLA breach handling

If `expiresAt` passes and the `FounderAction.status` is still `pending`:

- Escalate to founder mobile (WhatsApp + push)
- Update agent: WhatsApp message + email apologising for delay, giving a
  realistic new ETA, plus a small goodwill credit toward their next deal
- Log the breach for the published quarterly completion-rate report

### "Open market" outcome

If after 7 days the `QuoteRequest.status` is still `quoted` and the agent
has not converted, ping them on WhatsApp:

> "Quick check — what happened with [address]? If the open market was the
> better route, no problem. We'll instruct as introducer if you'd like.
> Reply 'open' or 'taken'."

If the agent replies `open`, raise a `FounderAction` to issue the introducer
fee per our either-outcome promise.

---

## Data Paperclip needs access to

Read access to:

- `QuoteRequest` (and the joined `QuoteOffer`)
- `AgentAccount` (for firm details)
- `FounderAction`
- `DealUpdate`

Write access to:

- `QuoteRequest.notes`, `QuoteRequest.bedrooms`, `QuoteRequest.propertyType`,
  `QuoteRequest.condition` (for enrichment writeback)
- `QuoteOffer` (re-generation after enrichment)
- `FounderAction.status`, `.resolvedAt`, `.metadata` (workflow state)
- `DealUpdate.create` (for adding events to the vendor-facing timeline)

Endpoints are now scaffolded under `apps/api/app/agents/quote-ops/`. All
routes auth via `Authorization: Bearer ${PAPERCLIP_API_KEY}` (the existing
shared secret used by the rest of `apps/api/agents/*`).

### API contract

**`GET /agents/quote-ops?status=pending&hours=48`**

The Paperclip inbox. Returns agent_quick_form QuoteRequests still
awaiting a signed PDF, oldest first. Each row includes the live
`FounderAction` so Paperclip knows the SLA deadline.

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

**`GET /agents/quote-ops/[id]`**

Full detail for a single quote. Returns `quote` (with offer, deal
updates, track token) plus all matching `actions`.

**`PATCH /agents/quote-ops/[id]`**

Enrichment writeback after Paperclip looks up the missing data. Body:

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

All fields optional. `replaceOffer` creates a new `QuoteOffer` row and
points `QuoteRequest.offerId` at it.

**`POST /agents/quote-ops/[id]/deal-update`**

Append an event to the vendor-facing timeline (mirrors the same
`DealUpdate` shape the rest of the platform uses). Body:

```json
{
  "kind": "offer_sent",
  "title": "Signed binding offer issued",
  "detail": "PDF sent to jane@acmeestates.co.uk + WhatsApp acknowledgement.",
  "metadata": { "signedOfferUrl": "https://...", "messageId": "..." }
}
```

Uses Prisma `DealUpdateKind` enum — `offer_sent`, `offer_accepted`,
`offer_declined`, `delay`, `founder_review`, `note`, etc.

**`POST /agents/quote-ops/[id]/resolve`**

Stop the 4-hour SLA clock. Marks the matching `FounderAction(s)` as
`completed`. Body:

```json
{
  "resolvedBy": "paperclip-appraiser",
  "outcome": "signed_pdf_sent",
  "metadata": { "signedOfferUrl": "https://...", "deliveredAt": "..." }
}
```

### Suggested Paperclip polling loop

```
every 60s {
  GET /agents/quote-ops?status=pending
  for each quote:
    if not yet enriched → run enrichment, PATCH back
    if enriched + offer fresh + no PDF → draft PDF, await founder approval
    if PDF approved → send via email + WhatsApp, POST deal-update,
                       POST resolve
    if expiresAt < now and still pending → escalate to founder mobile
}
```

---

## What's intentionally NOT built into Bellwood

The following are Paperclip's job, not the platform's:

- ❌ Automated PDF generation
- ❌ Outbound WhatsApp sending
- ❌ SLA breach escalation
- ❌ 7-day "did the deal happen" follow-up
- ❌ Either-outcome introducer fee tracking
- ❌ Agent enrichment (Rightmove, Zoopla, Companies House lookups beyond
  what's already in `@repo/property-data`)

The Bellwood platform's job is the source-of-truth data store + the agent
landing experience. Everything operational lives in Paperclip.

---

## Phase 1 (manual) vs Phase 2 (automated)

**Phase 1 — first 50 deals**

Paperclip is Sam + co-founder reading the `/quotes` dashboard, doing the
enrichment in spreadsheets, drafting the signed PDF in Google Docs,
sending WhatsApp by hand. The Bellwood platform tracks the SLA via
`FounderAction.expiresAt`. The dashboard `/quotes` shows the inbox with
countdown pills.

**Phase 2 — once volume justifies**

Paperclip becomes a service that polls the DB and runs the workflow above.
Founder approval stays in the loop; everything else is automated.

The platform doesn't change between phases — only Paperclip does. That's
the architectural win.
