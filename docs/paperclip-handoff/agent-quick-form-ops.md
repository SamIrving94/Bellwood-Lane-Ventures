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
   - Look up bedrooms / property type from Rightmove / Zoopla via address
   - Run environmental risk lookup (radon / coal mining / flood / knotweed)
     against the postcode
   - Companies House check on the agent's firm
   - Update the `QuoteRequest` with enriched fields

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

Suggested approach: a service-account API token + a small set of dedicated
endpoints under `apps/api/app/agents/quote-ops/` (this repo, separate from
the existing `agents/` paperclip routes which serve a different purpose).
Out of scope for this brief — flag if you want me to scaffold those routes.

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
