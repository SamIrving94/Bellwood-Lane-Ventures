# Phase 2 — Score and rank plugin tool ideas

_Written: 2026-10-01 · v2, rebuilt after a full scan of every tool in `apps/web`, `apps/app` and `packages/*`._

## What changed from v1

- **v1 was too narrow.** It leaned on Keyhole and missed most of what's built.
- **v2 covers everything:**
  - 14 public pages
  - ~40 dashboard tools
  - agent, investor and seller-journey tools
  - ~30 pure calculators in `packages/*`
- **Letting is gone.** Founder decision: Kept is not going down the letting route. No rent, yield or "let it out" anywhere.

## Founder decisions this builds on

- **Aim: B** — people who inherited a home.
- **No letting. No tenanted homes.**
- **The web pages already exist.** The plugin links to them; we build no new pages.

## Rules that shape every score

1. **No figure from Kept on screen.** No AVM, no offer, no "indicative" range (founder rule).
2. **No PropertyData in public.** Our licence is internal use only (`apps/web/lib/keyhole/report.ts:8`). Any AVM figure carries PropertyData comps, so it's out too.
3. **No personal data out.** Leads, executors, vendors, investors: never exposed.
4. **ChatGPT already answers general guides.** A plugin earns suggestions when it **computes something for this person**: their address, their numbers.

---

## Full inventory → candidate tools

Each built tool was mapped to one of: **plugin candidate**, **support** (feeds a candidate), or **never** (with reason).

### Public site (`apps/web`)

| Built tool | Where | Plugin use |
|:--|:--|:--|
| Seller offer forms (`/sell`, 6 situation pages) | `components/home/*offer-form.tsx` → `/api/quote` | **Handoff target** (link out). Not a tool: the quote figure must stay hidden. |
| Situation guides (probate, chain-break, separation, relocation, problem property, your-situation) | `lib/situation-content.ts` | Candidates: **S1**, **S8**, **S7**, guides |
| "Why we won't buy any home" routing | `why-we-wont-buy-any-home` | Candidate: **S5** (honest routes), fit check |
| Methodology page | `instant-offer/methodology` | Source text for **S5** (how cash offers are built) |
| Keyhole report | `lib/keyhole/report.ts` | Candidate: **S2** |
| Kept Score (agents) | `agents/score/actions.ts` | **Never** — shows a figure, uses PropertyData |
| Save-the-sale form (agents) | `save-the-sale` → `/api/quote` | Candidate: **A1** (agent plugin) |
| Partner portal | `portal`, `partners/*` | Candidate: **A2** (agent plugin) |
| Investor feed | `investors/[token]` | Candidate: **I1** (investor plugin) |
| Track page / accept offer | `track/[token]`, `api/quote/[id]/accept` | Candidate: **S11** (existing sellers) |
| Viewing report | `viewing/[token]` | **Never** — field-partner tool, address PII |
| OS Places lookup | `api/os-places` | **Support** — address search for S2 |

### Dashboard (`apps/app`) — founder-only

| Built tool | Plugin use |
|:--|:--|
| Home briefing, Action Centre, leads, pipeline, deal page, quotes inbox, outreach holds, contacts, partners, investors admin, field network, works, legal checklist + chaser, book P&L, sourcing fees | **Never public.** Full of vendor/executor PII and commercial data. → Possible **private founder plugin** (Track 3, below). |
| Deal-model what-if (`appraiseDeal`, `maxOfferForRoi`, SDLT) | Candidate: **I2** (pure maths, user's own numbers) |
| Generate offer, batch appraise, deep appraisal, AVM backfill, scouting, Ask George | **Never** — PropertyData and/or Kept's offer figure |
| AVM backtest | **Later** — aggregate accuracy could become public evidence once it has a reading |
| Probate PDF extract, WhatsApp intake | **Never** — heavy PII |
| Auctions | Candidate: **S15** (scored low) |
| Valuation methodology explainer | Source text for S5 |

### Pure calculators (`packages/*`)

| Function | Plugin use |
|:--|:--|
| `estimateRefurb` (`valuation/src/refurb.ts:128`) | Candidate: **S4** |
| `computeSdltPence` (`valuation/src/deal-model.ts:264`) | Candidate: **S6**; support for I2 |
| `appraiseDeal`, `maxOfferForRoi` (`deal-model.ts:374,461`) | Candidate: **I2** |
| `computeRemainingLeaseYears`, `classifyLeaseDistress` (`property-data/src/registered-leases.ts:99,134`) | Support for **S7** |
| `assessModernisation` (`scouting/src/modernisation.ts:115`) | Support for S2 / S4 |
| `scoreRisk` (`valuation/src/risk-scoring.ts:432`) | Support for S7 (only with open-data inputs) |
| `normaliseUkAddress`, `distanceMiles`, `poundsPerSqft`, `calcAvgPrice` | Support |
| `calculateOffer`, `scoreLead`, `classifyTrack`, `computeConfidence`, `LEGAL_STEPS` target days | **Never** — Kept's margin policy and internal SLAs |

---

## Scoring key (1–5, higher is better)

| Score | Meaning |
|:--|:--|
| **Demand** | Would UK people really ask ChatGPT this? |
| **Lead** | Does it lead to a Kept customer? (seller in a Kept situation; agent referrer; syndicate investor) |
| **Effort** | 5 = easy, reuses existing code |
| **Data** | Is our answer accurate and defensible? |
| **Risk** | 5 = low risk (legal, privacy, plugin review) |
| **Rec fit** | Would ChatGPT likely suggest this plugin for common questions? |

**One gate:** a top-3 tool must score **Lead ≥ 3**. The plugin exists to win Kept customers. Without the gate, cheap generic calculators (stamp duty, sold prices) would win on ease alone.

**Ties:** broken by Rec fit, then Lead.

## Ranked table

Audience: **P** = public seller (no login) · **Pro** = logged-in agent or investor.

| Rank | ID | Tool | Aud. | Dem | Lead | Eff | Data | Risk | Rec fit | **Total /30** |
|--:|:--|:--|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **1** | S5 | **Compare ways to sell** (agent vs auction vs cash buyer) | P | 4 | 5 | 3 | 3 | 3 | 4 | **22** |
| **2** | S1 | **Inherited home: what now?** (dated executor plan) | P | 4 | 4 | 3 | 4 | 3 | 4 | **22** |
| — | I2 | Flip / deal ROI calculator | P | 3 | 2 | 5 | 4 | 4 | 4 | 22 ⛔ Lead gate |
| **3** | S4 | **Renovation cost estimate** | P | 4 | 3 | 5 | 3 | 4 | 3 | **22** |
| — | S2 | Property facts (Keyhole) | P | 4 | 2 | 5 | 4 | 4 | 3 | 22 ⛔ Lead gate → **support** |
| — | S6 | Stamp duty calculator | P | 4 | 1 | 5 | 5 | 5 | 2 | 22 ⛔ Lead gate |
| 4 | S3 | Empty home checklist (→ merged into S1) | P | 3 | 4 | 4 | 3 | 4 | 3 | 21 |
| — | S9 | Sold prices on my street | P | 5 | 1 | 5 | 4 | 4 | 2 | 21 ⛔ Lead gate |
| 5 | S14 | "Is a cash buyer right for me?" fit check | P | 2 | 4 | 5 | 5 | 4 | 1 | 21 |
| ✖ | S13 | Cash offer / AVM valuation | P | 5 | 5 | 4 | 1 | 1 | 4 | 20 — **never** |
| 6 | S7 | Problem property check (lease, construction, EPC) | P | 3 | 5 | 3 | 3 | 3 | 3 | 20 |
| 7 | A1 | Agent: refer a collapsing sale | Pro | 2 | 5 | 3 | 5 | 3 | 2 | 20 |
| 8 | S8 | Buyer pulled out: what now? | P | 3 | 5 | 4 | 3 | 3 | 2 | 20 |
| 9 | G1 | Separation / relocation guides | P | 3 | 4 | 4 | 3 | 3 | 2 | 19 |
| 10 | A2 | Agent: my referral status | Pro | 2 | 3 | 3 | 5 | 4 | 1 | 18 |
| 11 | I1 | Investor: released deals feed | Pro | 2 | 4 | 4 | 3 | 3 | 1 | 17 |
| 12 | S11 | Seller: where's my sale? (track) | P* | 1 | 1 | 4 | 5 | 3 | 1 | 15 |
| 13 | S12 | House price trend (HPI) | P | 3 | 1 | 3 | 2 | 4 | 2 | 15 |
| 14 | S15 | Upcoming auctions near me | P | 3 | 1 | 3 | 3 | 2 | 2 | 14 |

_*S11 needs the seller's private track link._

### What the scores say

- **Two tools win on fit:** "compare ways to sell" and "inherited home: what now?". Both compute something for one person, and both point at Kept's core segments.
- **Property facts and stamp duty are cheap and safe** but bring nobody to Kept. Property facts becomes a **support tool**: it feeds the EPC floor area into the renovation estimate.
- **Rec fit drops guides and brand questions.** "Is a cash buyer right for me?" scores 20/25 without it, then falls to #5.
- **Professional tools (A1, A2, I1) score low on Rec fit, and that's fine.** Agents and investors install once and come back. Rec fit matters for strangers, not repeat users. They are a separate plugin (Track 2).

---

## Top 3 — one public plugin

Theme: **"Selling an inherited or hard-to-sell home: your plan, your costs, your options."**

### 1. `compare_sale_routes` — Compare ways to sell

- **Does:** lays out estate agent vs auction vs cash buyer side by side, for **the user's own numbers**:
  - money left after fees
  - typical time to complete
  - fall-through risk
  - who each route is wrong for
- **Inputs:**
  - a price the user has been quoted, or their own estimate
  - any offers they hold
  - whether they need certainty or speed
- **Reuses:**
  - Kept's published, sourced facts: agent fee "1–1.5% plus VAT"; "~1 in 3 agreed sales collapse" (TwentyCi 2025)
  - the honest routes on `/why-we-wont-buy-any-home`
  - the methodology page
- **Never:** a Kept figure. The cash-buyer row uses an offer **the user enters**, or stays blank.
- **Why #1:** it is Kept's brand promise in tool form: "we'll tell you when we're wrong for you". It is also the **net-proceeds comparator** already planned for Keyhole V1.1 (user figures only, buyer-agnostic), so it works as evidence for an executor's decision file.
- **New code:** a pure comparator function plus sourced constants.

### 2. `plan_inherited_home` — Inherited home: what now?

- **Does:** from the date of death (and grant date, if known), builds a **dated plan** for the house:
  - probate steps and what's allowed when (you can agree a sale before the grant, but not complete)
  - empty-home duties: the insurance 30/60-day cliff, the council tax exemption and premium dates
  - CGT basics if sold later: probate value is the base cost; 60-day reporting
  - the decision point: "ready to choose a sale route?" → tool 1
- **Reuses:**
  - `/probate` page content (`lib/situation-content.ts`)
  - the vacancy-guard design (probate shelf tree, module B)
- **Never:** "advice". Copy says "general information", as on `/probate`.
- **Why #2:** Kept's #1 segment, a real per-family computation (dates), and it absorbs the empty home checklist (#4) rather than building it twice.

### 3. `estimate_renovation_cost` — Renovation cost estimate

- **Does:** gives light / full / heavy refurbishment budget bands for a home.
- **Inputs:** postcode + address (floor area from the EPC record) **or** a floor area the user enters.
- **Reuses:**
  - `estimateRefurb` (pure, already public in Keyhole)
  - `getEpcData` and `assessModernisation`
  - support tool `get_property_facts`
- **Never:** a property value. Shows bands, "budget bands, not quotes".
- **Why #3:** "do we do it up first, or sell as it is?" is a common question for dated inherited homes and problem properties. Both are Kept situations. It's also nearly free to build.

### Support tool (not ranked, ships with the top 3)

- `get_property_facts` — the EPC record and Land Registry sales for one address. Feeds tools 2 and 3. HMLR attribution shown.

### Handoff (all tools)

- One widget button: **"Ask Kept for a written offer"** → opens the matching live page (`/probate`, `/problem-property`, `/sell`).
- Nothing is collected inside ChatGPT.
- ⚠️ **Blocker:** those forms post to `/api/quote`, which **emails a £ figure to the seller today** (P0, `01-audit.md`). Fix before launch.

---

## Track 2 — a separate plugin for agents and investors (later)

- **A1 Refer a collapsing sale**, **A2 Referral status**, **I1 Released deals feed**.
- These are **logged-in professional tools**. Install friction matters less: they install once and use it every time a sale collapses.
- **Bet 1 (agents) and Bet 4 (capital) fit** better than the public plugin does.
- **Needs first:** OAuth on top of the partner magic-link login. Remove the AVM value from the investor feed (PropertyData licence).
- **Recommend:** build after the public plugin proves the channel.

## Track 3 — a private founder plugin (optional)

- Ask ChatGPT "what needs my decision today?" against the Action Centre and pipeline.
- **Not lead generation.** It's productivity for you and Ant.
- Private workspace only, behind founder login. The broken `packages/mcp-server` was heading this way.

---

## What I would NOT build, and why

| Tool | Why not |
|:--|:--|
| **Cash offer / AVM valuation** (S13) | Breaks "no figure on screen". PropertyData licence. No backtest reading yet. |
| **Kept Score** | Shows a figure; PropertyData. (It shows one on the live site today too — see "found in this scan".) |
| **Generate offer, batch appraise, deep appraisal, Ask George, scouting** | PropertyData and/or Kept's own figure. |
| **Lead, pipeline, quotes, outreach, contacts, probate PDF, WhatsApp intake** | Vendor/executor/investor PII. Founder-only, forever. |
| **Offer policy, scorer, track classifier, confidence, legal target days** | Kept's commercial logic and internal SLAs. |
| **Stamp duty, sold prices** | Safe and easy, but no route to a Kept customer. gov.uk and the portals already do them. |
| **Flip ROI calculator** | Good maths, but it attracts flippers who compete with us, not sellers. Reconsider for Track 2 (syndicate investors). |
| **Upcoming auctions** | Attracts buyers, not sellers. Scraping terms untested. |
| **House price trend** | Our HPI source 404s. No lead value. |
| **Collect details in chat** | PII in ChatGPT draws strict review; the probate firewall applies. Link out instead. |
| **Anything about letting or rent** | Founder decision: not our route. |

---

## Found in this scan — rule conflicts on the live site

The scan found these. **Not fixing them in this project**, just flagging:

1. **Kept Score shows an "indicative" ±3% range** to agents, built from PropertyData (`apps/web/app/agents/score/actions.ts`). This conflicts with both the no-figure rule and the licence.
2. **The investor feed shows the AVM market value** and a discount computed from it (`apps/web/app/investors/[token]/page.tsx:53`). That value contains PropertyData comps.
3. **The methodology page says "Get an indicative offer"**, but the FCA page says "We do not issue indicative offers".
4. **The FCA page and `/agents` still say "72 hours"**, but the promise is now one week.

---

## Example phrases (5 per tool, UK users)

### S5 Compare ways to sell ⭐
1. "Should I sell my house through an estate agent or a cash buyer?"
2. "We've had an offer of £210k from a cash buyer. Agent says it'd fetch £250k. What would we actually end up with each way?"
3. "Is selling at auction a good idea for my dad's house?"
4. "What are the pros and cons of quick house sale companies?"
5. "Agent wants 1.5% plus VAT. How does that compare to selling for cash?"

### S1 Inherited home: what now? ⭐
1. "My mum died last month and left the house to me and my sister. What do we do with it?"
2. "We're waiting for probate. What do we need to do about dad's empty house?"
3. "Can we sell my nan's house before probate is granted?"
4. "Do we have to pay capital gains tax if we sell the house we inherited?"
5. "Give me a timeline for sorting out my late father's house."

### S4 Renovation cost estimate ⭐
1. "How much would it cost to renovate a 3 bed semi that hasn't been touched since the 80s?"
2. "Should we do up mum's house before selling or sell it as it is?"
3. "Rough cost of a full refurb for a 1930s terrace in Leeds?"
4. "The EPC is F. How much work does this house need?"
5. "Budget for modernising an 85 square metre bungalow?"

### S2 Property facts (support)
1. "What's the EPC rating for 14 Elm Road, M14 5AB?"
2. "When did this house last sell?"
3. "What's on public record about my mum's house?"
4. "How big is 22 Victoria Street in square metres?"
5. "What have houses sold for on this street?"

### I2 Flip ROI calculator
1. "If I buy at £180k and spend £30k, what's my profit selling at £260k?"
2. "Work out stamp duty and costs on a £200k buy-to-flip."
3. "What's the most I should pay for a house to make 20% on a flip?"
4. "Bridging loan costs on a 6 month refurb project?"
5. "Is this flip deal worth it? Numbers below."

### S6 Stamp duty calculator
1. "How much stamp duty on a £350k house?"
2. "Stamp duty for a second home at £220k?"
3. "First-time buyer stamp duty on £400k?"
4. "Stamp duty if I'm buying before I sell mine?"
5. "What's the stamp duty surcharge in 2026?"

### S3 Empty home checklist (merged into S1)
1. "Mum's house is empty while probate goes through. What do I need to do?"
2. "Does home insurance still cover an empty house after someone dies?"
3. "Do we pay council tax on dad's house while we wait for probate?"
4. "Should I drain down the heating in an empty house over winter?"
5. "Checklist for looking after my late father's house until it's sold."

### S9 Sold prices on my street
1. "What did number 8 sell for?"
2. "House prices on Cranbrook Road in the last 2 years."
3. "Recent sales in BS7 9."
4. "Has anything sold on my road recently?"
5. "Average sold price in my postcode?"

### S14 Is a cash buyer right for me?
1. "Should I use a cash house buyer?"
2. "What's the catch with companies that buy houses for cash?"
3. "Are quick house sale companies regulated?"
4. "When does selling for cash make sense?"
5. "Is Kept a good cash house buyer?"

### S13 Cash offer / AVM (never)
1. "How much is my house worth?"
2. "Give me a cash offer for my house."
3. "What would a quick sale company pay for my house?"
4. "Value my mum's house for probate."
5. "What's 12 Oak Lane worth?"

### S7 Problem property check
1. "Can I sell a house with Japanese knotweed?"
2. "My flat has 68 years left on the lease. Can I still sell it?"
3. "Is a non-standard construction house hard to sell?"
4. "No lender will touch my house. Who will buy it?"
5. "The survey found subsidence. What are my options?"

### A1 Agent: refer a collapsing sale
1. "My buyer's mortgage fell through on 12 Oak Road. Can Kept look at it?"
2. "Send this fall-through to Kept: 3 bed semi, M20, chain collapsed today."
3. "I need a cash buyer for a probate sale I'm handling."
4. "Refer a sale to Kept before I re-list."
5. "Can Kept view a property in Stockport this week?"

### S8 Buyer pulled out
1. "Our buyer just pulled out. What do we do now?"
2. "Buyer's mortgage was refused a week before exchange. Help."
3. "The chain has collapsed and we'll lose our new house. Options?"
4. "Survey down-valued our house by £20k. Should we accept the lower offer?"
5. "How common is it for house sales to fall through in the UK?"

### G1 Separation / relocation guides
1. "We're divorcing. How do we sell the house quickly?"
2. "My ex won't agree to sell. What can I do?"
3. "I'm moving abroad next month. How do I sell my house?"
4. "Can I sell my house while living overseas?"
5. "Job relocation, need to sell in 6 weeks. Is that realistic?"

### A2 Agent: my referral status
1. "Where are my Kept referrals up to?"
2. "Has Kept viewed 12 Oak Road yet?"
3. "When does the Kept offer on my vendor's house run out?"
4. "How many deals have I referred to Kept this year?"
5. "Has Kept's offer for my client been sent?"

### I1 Investor: released deals feed
1. "Any new Kept deals in Manchester under £200k?"
2. "Show me released deals with a 3 bed."
3. "What's come onto the Kept feed this week?"
4. "Kept deals needing light refurb only?"
5. "Register my interest in the Salford terrace."

### S11 Where's my sale?
1. "Where's my Kept sale up to?"
2. "Has my solicitor sent the contracts to Kept yet?"
3. "When is my completion date?"
4. "Send Kept a message about my sale."
5. "How long is my Kept offer held for?"

### S12 House price trend
1. "Are house prices going up in Manchester?"
2. "How much have prices in Leeds changed this year?"
3. "Is now a good time to sell in Bristol?"
4. "House price growth in my area over 5 years."
5. "Will house prices fall next year?"

### S15 Upcoming auctions near me
1. "Property auctions near Leeds this month?"
2. "Cheap houses at auction in the North West."
3. "What's coming up at Allsop?"
4. "Auction properties needing renovation in Kent."
5. "Guide prices for houses at auction near me."

---

## Decisions needed before Phase 3

1. **Top 3 as one public plugin?** Compare ways to sell + Inherited home plan + Renovation cost, with Property facts as support.
2. **Figures in the tools.** The tools show **the user's own numbers** and sourced public facts (agent fees, tax rates, fall-through rates), never a Kept figure. Is that OK under "no numbers in probate copy"? I think the rule covers our marketing copy, not a user's own maths.
3. **Fix the P0 quote email first**, in its own small PR? The handoff needs it.
4. **Track 2 (agents and investors) later?** Yes or no is enough for now.
5. **Compliance opinion:** has Ant commissioned the SRA/RICS/FCA opinion? Until then the plugin makes no legal claims.

_Scores are my judgement, not measured data. "Rec fit" is a guess at ChatGPT's recommender; OpenAI only says it rewards usefulness and satisfaction._
