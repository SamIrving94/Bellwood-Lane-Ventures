# Phase 1 — Audit

_Audited: 2026-10-01 · updated 2026-10-01 after founder answers + DevDay · branch `claude/bellwoods-chatgpt-mcp-app-nval4l`_

How this was checked:

- Every `route.ts`, server action and business package was read.
- Test suites were run (results below).
- Vercel runtime errors were pulled for all 3 projects (last 7 days).
- Key claims were re-checked by hand (marked ✅ verified).

Platform research (ChatGPT plugins + MCP) is in `00-platform-notes.md`.

---

## 1. Read this first — 5 things that change the plan

1. **We have no lettings product.** ✅ verified
   - The codebase is a **cash home-buyer** (sourced → appraised → offered → completed).
   - There is no tenancy, rent collection or management code. There is no landlord page on the live site.
   - "Landlord leads for Bellwoods" has **nowhere to land today**.
   - **Founder confirmed (1 Oct): no lettings service exists.** See section 11.
2. **We have no rent data.** ✅ verified
   - PropertyData `/rents`, `/valuation-rent` and `/demand-rent` are **not wired up**.
   - `/yields` is wired up but has **never returned a value**: our schema reads the wrong shape (LEARNINGS 2026-09-12).
   - A "sell or let?" answer needs a rent figure. We can't produce one today.
3. **The MCP server does not start.** ✅ verified
   - `packages/mcp-server` crashes on boot (ESM/CJS import error).
   - It is stdio only, with no HTTP and no auth. A ChatGPT plugin needs HTTP.
   - It also returns lead **phone numbers and emails** to any caller.
4. **P0 bug: every quote emails a price to the seller.** ✅ verified
   - `/api/quote` → `recordDealUpdate({kind:'offer_sent'})` with no `skipNotify`.
   - The seller gets an email headed "Your binding cash offer · Cash offer: £X".
   - This happens **even when `requiresReview` is true**.
   - It breaks two founder rules: "no figure before viewing" and "never auto-send".
   - `apps/web/app/api/quote/route.ts:625`, `packages/deal-updates/src/email-templates.ts:39,127`
5. **No AVM accuracy evidence yet.**
   - The backtest has only just started. No reading exists.
   - Bands are fixed at ±3/5/8% but labelled "80%". That is probably too narrow.
   - CLAUDE.md freezes the AVM method until the backtest reads.

---

## 2. Test status (run today)

| Workspace | Result |
|:--|:--|
| `@repo/valuation` | ✅ 139 / 139 |
| `@repo/property-data` | ✅ 79 / 79 |
| `apps/api` | ✅ 60 / 60 (only 1 route tested: `/health`) |
| `apps/app` | ✅ 29 / 29 (no route or action tests) |
| `@repo/mcp-server` | ⚠️ no tests |
| `apps/web` | ⚠️ no tests (this holds the public quote flow) |

## 3. Live errors (Vercel, last 7 days)

| Project | Error | Count |
|:--|:--|:--|
| bellwood-api | PropertyData `/agents` schema drift (`agent-prospecting`) | 16 since Aug |
| bellwood-api | `@repo/ai` "all providers failed" (morning briefing, LinkedIn) | 8 |
| bellwood-api | `@repo/ai` "no object generated" (auction extract, founder desk) | 8 |
| bellwood-app | `/guide` RSC "functions cannot be passed to client" | 5 |
| bellwood-web | none | — |

---

## 4. Data sources

| Source | We use it for | Works today? | Licence / risk |
|:--|:--|:--|:--|
| **HMLR Price Paid** | AVM comps, backtest | ✅ (falls back to **synthetic** if the call fails) | OGL. **Attribution required. None found in UI.** |
| **HMLR UK HPI** | Trend, AVM nudge | ⚠️ PropertyData `/hmlr-hpi` 404s → synthetic HPI | OGL |
| **EPC (new gov API)** | Floor area, rating, build era | ✅ | OGL for data. Address fields carry Royal Mail / OS rights. |
| **OS Places** | Address → UPRN | ✅ with key (synthetic UPRN fallback) | Paid above free tier |
| **postcodes.io** | Geocoding | ✅ | OGL, free |
| **Companies House** | Officers, charges, insolvency leads | ✅ with keys | OGL. Officer data is personal data. |
| **The Gazette** | Probate / insolvency notices → leads | ✅ | OGL, but personal data. Outreach use needs legal check. |
| **planning.data.gov.uk** | Stalled consents | ✅ | OGL |
| **PropertyData** | AVM cross-check, comps, £/sqft, distress lists, flood, demand, **yields** | ⚠️ Partly. 11 endpoints never return values (schema drift). `/valuation-sale` sends the wrong param name. | **Paid. Terms generally bar redistributing raw data.** Must check before exposing in a plugin. |
| **Auction sites** (AH-UK, Allsop, Savills, Clive Emson) | Lot discovery | ⚠️ AH-UK + Allsop live. Others unverified. | Scraped. robots.txt not checked. |
| **HMCTS probate / ProbateData / BatchData** | Probate grants, contact append | ❌ Dead. HMCTS endpoint looks invented. BatchData is US-only. | — |
| **WhatsApp (whatsapp-web.js)** | Intake | ✅ locally | ❌ Breaks WhatsApp terms. Ban risk. |
| **LLMs** (OpenRouter, Anthropic, OpenAI, Mistral, Voyage, open-weight hosts) | Extraction, scoring, OCR, embeddings | ✅ mostly | PII goes to many processors. Needs DPAs. |
| **Resend / Calendly / Vercel Blob / Arcjet / Knock** | Email, booking, files, security | ✅ (Knock unused) | Blob is **public** — signed offer PDFs live there. |

---

## 5. Business packages

| Package | What it does | Works? | Main issues |
|:--|:--|:--|:--|
| **valuation** | `runAVM` (comps + HPI + EPC + PropertyData → value + offer). Flip ROI. Deep appraisal (LLM). Backtest snapshots. | ✅ | "Hedonic" pillar is mostly the comps figure again (`base-valuation.ts:269`). Fixed bands. Yield input never passed, so "investment grade" is always B. £250k hard-coded fallback (`:431`). |
| **property-data** | Adapters for all sources above. ~25 PropertyData wrappers. Rate limiter (4/10s). Durable cache. | ⚠️ | No rent endpoints. `/yields` drift. Synthetic fallbacks. |
| **instant-offer** | Public quote: AVM → range + offer + LLM narrative | ✅ | Ignores asking price. Condition changes confidence, not price. |
| **scouting** | Probate / distress discovery + scoring | ✅ core | Dead sources (HMCTS, BatchData). |
| **auctions** | Auction scrapers + vision screen | ⚠️ | ToS risk. Wrong domain in User-Agent. |
| **deal-updates** | Timeline + emails the chain | ✅ | **Auto-emails seller with £ figure (P0).** |
| **quote-ops** | Signed offer PDF + send | ✅ | PDF in **public** blob. Marks "sent" even when email fails. No tests. |
| **document-pipeline** | Probate PDF → OCR → cited extract | ✅ probably | Bypasses `@repo/ai` (breaks LEARNINGS rule). |
| **knowledge-base** | pgvector search | ✅ | Search doesn't filter by embedding model. |
| **calendly** | Booking link + webhook check | ✅ | No replay protection. |
| **email** | Resend wrapper | ✅ | Logs recipient addresses. |
| **ai** | LLM routing + fallback | ⚠️ | Live failures above. |
| **whatsapp-parser** | LLM parse of intake | ✅ | — |
| **mcp-server** | 9 tools (HMLR, EPC, OS Places, HPI, CH ×2, scout DB, pipeline, founder actions) | ❌ **Crashes** | stdio only. No auth. Exposes lead PII. SDK 1.6.1 (current is 1.31 / v2.2). |
| **notifications** | Knock | — | Dead code. |
| **security** | Arcjet + headers | ⚠️ | Off without key. CSP disabled. |

---

## 6. Public endpoints (`apps/web`) — the ones a ChatGPT app could reuse

Rate limits use a home-grown Postgres limiter. It **fails open** on DB errors (`apps/web/lib/rate-limit.ts:96`).

| Route | Does | Auth | Works? | Risk |
|:--|:--|:--|:--|:--|
| `POST /api/quote` | Main lead capture. Runs AVM + offer. Stores QuoteRequest. Emails people. | None. 8/h per IP, 5/h per email. | ✅ | **P0 email bug.** Returns offer + AVM in JSON. No length caps. Client can fake `agent_quick_form`. Seller `notes` dropped. |
| `POST /api/quote/[id]/accept` | Records seller consent | Track token | ✅ | Only UI is in dead code |
| `POST /api/track/[token]/reply` | Seller message → founder card | Token | ✅ | — |
| `POST /api/keyhole/report` | Open-data property report (EPC + Land Registry, **no valuation**) | None. 20/h per IP. | ✅ | Good model for a safe public tool |
| `POST /api/keyhole/refer` | Opt-in referral | None | ✅ | Anyone with a report id can mark it referred |
| `GET /api/os-places` | Address lookup proxy | None. 60/min per IP. | ✅ | Paid quota |
| `POST /api/partners/signup` / `login` / `logout` | Agent partner magic link | None / HMAC | ✅ | Magic link reusable for 15 min |
| `POST /api/viewing/[token]` (+ `/photo`) | Field partner report | Token | ✅ | Per-token limit only |
| `POST /api/proof-of-funds` | Emails a request | None | ⚠️ | Not stored, despite comment |
| Action `calculateBellwoodScore` | "Kept Score" range for agents | None. 10/h per IP. | ✅ | Shows a figure publicly. Runs LLM on every call. Leaks raw errors. |

Public pages with problems:

- `/instant-offer/offer/[id]` shows address + offer + AVM **with no token**.
- `/agents`, `/save-the-sale` show the £ offer on screen.
- `chat-flow.tsx` holds the `SHOW_ONSCREEN_OFFER` gate, but **nothing imports it**. `/instant-offer` redirects to `/sell`.
- Referral tracking is broken end to end (redirect drops `?ref=`; counter bumps on every page view).

---

## 7. API routes (`apps/api`) — 33 total

### Agents (Bearer `BELLWOOD_API_KEY`, fails closed)

| Route | Does | Works? | Risk |
|:--|:--|:--|:--|
| `/agents/auctions` | Upsert auction lots | ✅ | No Zod. Partial writes on bad date. |
| `/agents/dispatch` | Log campaign dispatch | ✅ (no caller) | — |
| `/agents/intake/whatsapp` | Parse WhatsApp → lead | ✅ | PII |
| `/agents/marketer/draft-blog` | Draft + compliance check | ✅ | No `maxDuration` |
| `/agents/scout/process-probate-pdf` | OCR probate grant | ✅ | Fetches any URL (SSRF, behind key) |

### Crons (Bearer `CRON_SECRET`; compare is not timing-safe)

| Cron | When (UTC) | Works? | Main issue |
|:--|:--|:--|:--|
| pipeline-appraise | 07:15 daily | ✅ | Dead `topLeads` query |
| pipeline-outreach | 07:30 daily | ✅ | **Auto-sends B2B email, no opt-out line (PECR).** Never sends step 2+. |
| lead-appraise | 07:50 daily | ✅ | Spend cap counts successes only → can burn credits on failures |
| deep-appraisal | 08:30 daily | ✅ | Later auction lots starved |
| quote-ops | every 30 min | ✅ | Failed quotes re-run LLM up to 48×/day |
| agent-prospecting | Mon 08:30 | ⚠️ | Draft feature dead. Reads stale postcode key. Live schema-drift errors. |
| event-poller | every 30 min | ⚠️ | Vendor triage never matches (wrong filter) |
| weekly-patterns | Sun 18:00 | ⚠️ | Leads/week always 0 (wrong event name) |
| pipeline-summary | 08:00 daily | ⚠️ | Quiet-day check never fires. Live LLM errors. |
| ch-stream | every 30 min | ✅ with keys | Drops events past 40/run permanently |
| avm-backtest | 28th monthly | ✅ | One HMLR error skips later postcodes |
| marketer-daily / weekly / monthly | various | ✅ | Duplicates; same blog topic every week; re-drafts same 15 firms |
| overnight-research, sla-alerts, legal-chaser, watchdog, rate-limit-sweep, auction-scan, keep-alive | various | ✅ | Many have no heartbeat or `maxDuration` |
| scouting | founder-triggered | ✅ | Biggest credit spend |
| scout-debug | unscheduled | ✅ | Called "read-only" but spends more credits and returns PII |

### Other

| Route | Auth | Issue |
|:--|:--|:--|
| `POST /intake` | **None** | **Public, unvalidated PII write into `Deal`. Appears unused. Feeds paid crons. Remove or lock.** |
| `/webhooks/postmark/inbound` | Basic auth + allowlist | Allowlist trusts spoofable `From`. Leases go through the probate extractor. |
| `/webhooks/calendly` | HMAC | Skips check outside prod |
| `/webhooks/clerk` | Svix | Logs full payload with PII |
| `/health` | None | ✅ |

---

## 8. Dashboard (`apps/app`)

- Clerk middleware has **no `auth.protect()`**. Each route and action must guard itself.
- `requireFounder` falls back to **any Clerk org member** if the allowlist env vars are unset (`packages/auth/require-founder.ts:71`).

Auth bugs:

| Severity | Where | Bug |
|:--|:--|:--|
| 🔴 High | `actions/leads/clear-inbox.ts:21` | Any signed-in user can **delete all new leads** (`auth()` not `requireFounder()`) |
| 🟠 Med | `strategy/actions.ts:18`, `launch/actions.ts:21`, `settings/scouting/actions.ts:40,156` | Unguarded server-action reads |
| 🟠 Med | `settings/scouting/*actions.ts` | Hard-coded prod API host — previews hit prod crons |
| 🟡 Low | `leads/export/probate/route.ts:31` | CSV formula injection |

---

## 9. Unsafe to expose to ChatGPT (public)

**Never expose:**

- Anything that returns **lead / seller / executor PII** (scout DB, pipeline, founder actions, probate exports).
- Anything that **writes deals or sends email** without a human in the loop.
- Anything that **shows an offer figure** (founder rule: no figure on screen).
- The **AVM point estimate** as a valuation — no accuracy evidence yet, and it would read as advice.
- **Raw PropertyData values** until we confirm their terms allow redistribution.
- Gazette probate data (personal data about the recently bereaved).

**Probably safe, after fixes:**

- Open-data lookups: Land Registry sold prices, EPC rating, HPI trend (OGL, with attribution).
- The **Keyhole** pattern: open data only, no valuation, opt-in referral.
- A lead-capture tool that writes a **review card** (not an email to the seller).

---

## 10. Fix list (ranked)

| # | Fix | Why | Blocks the plugin? |
|:--|:--|:--|:--|
| 1 | Stop `/api/quote` emailing £ figures (`skipNotify` or new copy) | Breaks founder rule today, in prod | No — but fix now anyway |
| 2 | Lock or delete `POST /intake` | Open PII write + cost risk | No |
| 3 | `clearNewLeadsInbox` → `requireFounder()` | Data loss | No |
| 4 | Set `FOUNDER_USER_IDS` / `FOUNDER_EMAIL_ALLOWLIST` in prod | Auth fallback | No |
| 5 | Token-gate `/instant-offer/offer/[id]`; make offer PDFs private | Public figures | No |
| 6 | **Capture real PropertyData responses for `/rents`, `/demand-rent`, `/yields`** (probe script, ~6–9 credits for these 3 — approved 1 Oct, see section 11) | No rent data = no sell-or-let | **Yes** |
| 7 | **Check PropertyData terms for redistribution in a third-party AI plugin** | Licence | **Yes** |
| 8 | Rebuild MCP server on current SDK + HTTP transport, no PII tools | Doesn't run | **Yes** |
| 9 | Add HMLR attribution where we show Land Registry data | OGL condition | Yes (for the plugin) |
| 10 | Rate limiter: fail closed on paid routes | Cost risk | Yes (ChatGPT traffic is spiky) |

Everything else in sections 7–8 is real but does not block this project. Suggest a separate clean-up PR.

---

## 11. My honest view before Phase 2

I think the brief has a weak spot. Plainly:

- **We don't have the thing we'd sell.** Confirmed: no lettings or management service exists. A "let it" answer has nowhere to send the landlord.
- **Conflict of interest.** We are a cash buyer. A buyer-owned "sell or let?" tool will look rigged whichever way it answers. Keyhole learned this lesson on 29 Aug (LEARNINGS.md).
- **Regulation.** Letting agents must join a redress scheme and have client money protection. The Renters' Rights Act changes landlord economics a lot. A tool nudging people into landlording needs careful, neutral copy.
- **Data.** We'd lean on PropertyData rent estimates we have never once parsed successfully.
- **Platform.** UK availability of third-party plugins is **not verified**. Since DevDay (29 Sep), placement depends on usefulness and satisfaction — a tool that looks like a funnel will rank badly.

What would make it strong:

- A **neutral, open-data-first** comparison: sale proceeds (after costs) vs rental income (after tax, fees, voids, compliance). Show the maths. No verdict, no figure from our AVM.
- The handoff is "talk it through with a person". **No offer, no price.**

### Founder answers (1 Oct 2026)

1. **Lettings service? No.**
2. **Run the PropertyData probe? Yes.**

### What answer 1 means — "challenge before building" (CLAUDE.md)

The brief says the plugin "turns home sellers into **landlord leads**". With no lettings service, that loop is broken. Three ways forward:

| Option | How it works | Problem |
|:--|:--|:--|
| **A. Build lettings** | We become a letting agent | Big, regulated (redress, CMP, Renters' Rights Act). A new business, not a plugin. |
| **B. Refer landlords to partner agents** | "Let" answers go to a partner letting agent for a fee | Must disclose the fee. We already have an agent network (`AgentAccount`, prospecting). Still a funnel. |
| **C. Flip the aim** | Neutral sell-vs-let calculator. Bellwoods earns from the **sellers** it surfaces — people who run the numbers and decide letting isn't for them. | Smaller lead volume. Same conflict-of-interest question, handled by showing the maths openly. |

- **Strongest case against the whole idea:** a cash buyer's "sell or let?" tool is a funnel in disguise. Accidental landlords are exactly the people who distrust it. ChatGPT now ranks by satisfaction, so a funnel loses reach as well as trust.
- **The assumption that kills it:** "people who ask ChatGPT 'should I sell or let?' are our sellers." Many are looking for permission to keep the house. They will never sell to a cash buyer at a discount.
- **Who hates it and why:**
  - Letting agents — we'd be talking their clients out of letting.
  - Consumer groups — a buyer giving "advice".
  - OpenAI reviewers — if it reads as lead-gen dressed up as a tool.

**My recommendation: Option C, built dark** (developer mode only, no directory listing) until one real user tries it. Option B can be added later if partner agents want the referrals. I will score both framings in Phase 2.

### What answer 2 means — probe status

- **I couldn't run it from here.** propertydata.co.uk is blocked by the sandbox network, and the API key isn't in the sandbox (by design).
- **The script is ready.** `/rents` and `/demand-rent` are added. `/valuation-rent` is left out on purpose: its required inputs aren't verified.
- **Please run it locally** (3 endpoints, roughly 6–9 credits):

  ```sh
  npx tsx scripts/propertydata-probe.mts --postcode "M14 5AB" --endpoints rents,demand-rent,yields
  ```

- Then share the console output (shapes only, no addresses). Raw files save to `scratch/propertydata-probe/`, which is gitignored.
