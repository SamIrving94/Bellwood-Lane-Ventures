# Phase 2 — Score and rank plugin tool ideas

_Written: 2026-10-01. Based on `01-audit.md`, `01b-strategy-check.md`, a full scan of the live `apps/web` pages, and the probate / Keyhole strategy docs._

## Founder decisions this builds on

- **Aim: B.** People who **inherited a home** and ask "sell or keep / let?"
- **Kept does not buy tenanted homes.** The landlord-exit idea is dropped.
- **The web pages already exist** (`/probate`, `/chain-break`, `/problem-property`, Keyhole…). The plugin points to them, so we don't build new pages.

## Three facts that shape every score

1. **PropertyData can't be shown to the public.** Our licence covers internal use only (`apps/web/lib/keyhole/report.ts:8`). So **no PropertyData rents, yields or values** in the plugin. Rent comes from the user.
2. **No figure from us on screen** (founder rule). No AVM, no offer, no "indicative" range.
3. **ChatGPT already answers general questions well.** A plugin only earns a suggestion when it **does something ChatGPT can't**: real data for *this* address, or maths on *this* family's numbers. That is what "Recommendation fit" measures.

---

## Scoring key (1–5, higher is better)

| Score | Meaning |
|:--|:--|
| **Demand** | Would UK people really ask ChatGPT this? |
| **Lead** | Does it lead to a Kept seller? (Kept buys probate, chain-break, relocation, separation, problem property.) |
| **Effort** | 5 = easy, reuses existing code |
| **Data** | Is our answer accurate and defensible? |
| **Risk** | 5 = low risk (legal, privacy, plugin review rules) |
| **Rec fit** | **New.** Would ChatGPT likely suggest this plugin for common questions? |

## Ranked table

| Rank | Tool | Demand | Lead | Effort | Data | Risk | **5-score total** | **Rec fit** | **Total /30** |
|--:|:--|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **1** | **Inherited home: sell or keep?** (new) | 4 | 4 | 3 | 4 | 3 | 18 | **4** | **22** |
| **2** | **Property facts** (Keyhole report: EPC, street sales, refurb bands) | 4 | 2 | 5 | 4 | 4 | 19 | **3** | **22** |
| **3** | **Empty home checklist** (vacancy guard, new) | 3 | 4 | 4 | 3 | 4 | 18 | **3** | **21** |
| 4 | Problem property: can I sell it? | 4 | 5 | 4 | 3 | 3 | 19 | 2 | 21 |
| 5 | Probate timeline: what happens when (new) | 5 | 3 | 4 | 3 | 4 | 19 | 2 | 21 |
| 6 | Sold prices on my street (HMLR only) | 5 | 1 | 5 | 4 | 4 | 19 | 2 | 21 |
| 7 | "Is Kept right for me?" fit check | 2 | 4 | 5 | 5 | 4 | **20** | 1 | 21 |
| 8 | Cash offer / AVM valuation (**not building**) | 5 | 5 | 4 | 1 | 1 | 16 | 4 | 20 |
| 9 | Buyer pulled out: what now? (new) | 3 | 5 | 4 | 3 | 3 | 18 | 2 | 20 |
| 10 | Separation / relocation guides | 3 | 4 | 4 | 3 | 3 | 17 | 2 | 19 |
| 11 | Collect my details in chat (lead handoff tool) | 2 | 5 | 3 | 5 | 2 | 17 | 1 | 18 |
| 12 | House price trend (HPI) | 3 | 1 | 3 | 2 | 4 | 13 | 2 | 15 |
| 13 | Title and lease health check (new) | 2 | 3 | 2 | 2 | 3 | 12 | 2 | 14 |
| 14 | Rent / yield estimate (PropertyData) | 4 | 1 | 2 | 1 | 1 | 9 | 3 | 12 |
| — | Internal tools (scout DB, pipeline, founder actions, Companies House, auctions) | — | — | — | — | 0 | — | — | **Never** |

**Ties:** broken by Rec fit first, then Lead.

### Did "Rec fit" change the order? Yes.

- **Without it, the fit check ranked #1** (20/25). People only ask "is Kept right for me?" if they already know Kept. ChatGPT will never suggest a plugin for that. It drops to #7.
- **Guides drop:** probate timeline, buyer-pulled-out and separation. ChatGPT answers them well on its own.
- **The sell-or-keep calculator rises to #1.** It does maths ChatGPT can't do reliably on its own, for one family's numbers.
- **Property facts rises.** It returns real records for one address.

---

## Top 3 — one plugin, three tools

These three fit together. Inherited home → what is it, what does each route leave us with, how do we look after it meanwhile.

### 1. `compare_sell_or_keep` — Inherited home: sell or keep?

- **Does:** compares **sell now** vs **let it out** vs **keep it empty for now**, over a time period the user picks.
- **Uses only:**
  - **User-entered figures:** sale price they've been quoted, rent a letting agent quoted, mortgage if any.
  - **Statutory rules with sources:** CGT on inherited homes (probate value is the base cost; 18% / 24%; 60-day reporting). Council tax (probate exemption; 12-month premium exception after grant). Letting rules (EPC C by Oct 2030, Renters' Rights Act).
  - **Open data:** EPC band, for "would it need work before letting?"
- **Shows:** the maths, line by line, with sources. **No verdict.** No Kept figure.
- **Output = a decision record.** This matches Keyhole's "evidence for the decision file" framing and the executor's duty.
- **Handoff:** "Want a written offer for the decision file?" → link to `/probate`.
- **Why it ranks #1:** it does something ChatGPT can't, and it's aimed at Kept's #1 segment.
- **Watch:** tax numbers sit near the "advice" line. Copy says "an honest steer", never "advice". It also clashes with the "no numbers in probate copy" rule. **Founder call needed** (see Decisions).

### 2. `get_property_facts` — Property facts

- **Does:** the Keyhole report, via ChatGPT. EPC record, recorded Land Registry sales in the postcode, refurb cost bands.
- **Reuses:** `buildKeyholeReport()`. About £0 per call (open data, no LLM, no PropertyData).
- **Never:** a value for the property. "No record found" is an honest answer.
- **Needs:** HMLR attribution (OGL). Move the function out of `apps/web` into a package.
- **Why it ranks #2:** cheapest to build, real data for one address. Low lead value on its own, so it **feeds tool 1** (EPC band → letting cost).

### 3. `empty_home_checklist` — Empty home checklist (vacancy guard)

- **Does:** gives a dated checklist from the date of death and the grant date:
  - **Insurance:** the 30/60-day unoccupancy cliff. Signpost only: we never arrange insurance (FCA).
  - **Council tax:** exemption and premium dates.
  - **Drain-down, inspections, a log.**
- **Why it ranks #3:**
  - It's the strategy doc's **recommended next probate module**.
  - An empty inherited home is a Kept seller in waiting.
  - Weekly-useful, so it builds trust before the sale question.
- **Watch:** council tax premiums differ by council. Insurance terms differ by policy. Say so plainly.

---

## What I would NOT build, and why

| Tool | Why not |
|:--|:--|
| **Cash offer / AVM valuation** | Breaks the "no figure on screen" rule. No backtest reading yet. PropertyData licence. Highest demand, but it would end the brand. |
| **Kept Score** (agent indicative range) | Same as above, plus costs money per call. |
| **Rent / yield estimate** | PropertyData licence bars public display. Our `/yields` parse has never worked. |
| **Collect details in chat** | PII inside ChatGPT draws strict review, and the probate firewall applies. Link out to our existing form instead. |
| **Internal tools** (scout DB, pipeline, Companies House, auctions) | Expose leads' and bereaved families' personal data. Never public. |
| **Separation guide** | Family law, high emotion, highest "vulture" risk. ChatGPT answers it fine. |
| **HPI trend** | Our HPI source 404s today. Low lead value. |
| **Title / lease health** | Needs paid title registers (Land Registry). Data too thin to be defensible yet. |
| **Buyer pulled out / problem property / probate timeline guides** | **Good for Kept, weak as a plugin.** ChatGPT answers them natively, and the live pages already exist for web search to cite. Revisit if tools 1–3 prove the channel. |

---

## Handoff (all top 3)

- One button in the widget: **"Ask for a written offer for your decision file"**.
- It opens `wearekept.co.uk/probate#offer` in the browser. It does **not** collect details inside ChatGPT.
- ⚠️ **Blocker:** that form posts to `/api/quote`, which **emails a £ figure to the seller today** (P0 in `01-audit.md`). Fix before the plugin goes live.

---

## Example phrases (5 per tool, UK users)

### Inherited home: sell or keep? ⭐
1. "My mum passed away and left me her house. Should I sell it or rent it out?"
2. "We've inherited dad's bungalow in Stockport. What would we actually be left with if we sold vs let it?"
3. "Is it worth keeping an inherited house as a rental? It's a 3 bed semi, letting agent says £1,100 a month."
4. "Do I pay capital gains tax if I sell my nan's house straight after probate?"
5. "Me and my brother inherited a house. He wants to rent it, I want to sell. Can you lay out both options?"

### Property facts
1. "What's the EPC rating for 14 Elm Road, M14 5AB?"
2. "What have houses sold for on my mum's street in LS6?"
3. "Tell me what's on public record about this house before we decide what to do with it."
4. "How much might it cost to do up a dated 1930s semi, roughly?"
5. "When did 22 Victoria Street last sell and for how much?"

### Empty home checklist
1. "Mum's house is empty while probate goes through. What do I need to do?"
2. "Does home insurance still cover an empty house after someone dies?"
3. "Do we pay council tax on dad's house while we wait for probate?"
4. "Should I drain down the heating in an empty house over winter?"
5. "Make me a checklist for looking after my late father's house until it's sold."

### Problem property
1. "Can I sell a house with Japanese knotweed?"
2. "Who buys houses with subsidence in the UK?"
3. "My flat has 68 years left on the lease. Can I still sell it?"
4. "The survey found cladding issues. What are my options?"
5. "House needs a full renovation and no lender will touch it. What now?"

### "Is Kept right for me?"
1. "Is Kept a good cash house buyer?"
2. "Should I use a cash buyer or an estate agent?"
3. "What's the catch with companies that buy houses for cash?"
4. "Are quick house sale companies regulated?"
5. "Would a cash buyer make sense for my mum's house?"

### Probate timeline
1. "How long does probate take in England right now?"
2. "Can we sell a house before probate is granted?"
3. "What do executors have to do after someone dies?"
4. "When is inheritance tax due on an estate?"
5. "Do all the executors have to agree to sell the house?"

### Sold prices on my street
1. "What did number 8 sell for?"
2. "House prices on Cranbrook Road in the last 2 years."
3. "Show me recent sales in BS7 9."
4. "Has anything sold on my road recently?"
5. "What's the average sold price in my postcode?"

### Buyer pulled out
1. "Our buyer just pulled out. What do we do now?"
2. "Buyer's mortgage was refused a week before exchange. Help."
3. "Chain has collapsed and we'll lose our new house. Options?"
4. "Survey down-valued our house by £20k. Should we accept the lower offer?"
5. "How common is it for house sales to fall through in the UK?"

### Cash offer / AVM (not building)
1. "How much is my house worth?"
2. "Give me a cash offer for my house."
3. "What would a quick sale company pay for my house?"
4. "Value my mum's house for probate."
5. "What's 12 Oak Lane worth?"

### Separation / relocation
1. "We're divorcing. How do we sell the house quickly?"
2. "My ex won't agree to sell the house. What can I do?"
3. "I'm moving abroad for work next month. How do I sell my house fast?"
4. "Can I sell my house while living overseas?"
5. "Job relocation, need to sell in 6 weeks. Is that realistic?"

### Collect my details in chat (not building)
1. "Can you send my details to a cash buyer?"
2. "Get me a callback about selling my house."
3. "Book me a viewing with a house buyer."
4. "Pass my number to someone who can buy my mum's house."
5. "Sign me up for an offer."

### House price trend
1. "Are house prices going up in Manchester?"
2. "How much have prices in Leeds changed this year?"
3. "Is now a good time to sell in Bristol?"
4. "House price growth in my area over 5 years."
5. "Will house prices fall next year?"

### Title and lease health
1. "Is my mum's house registered with the Land Registry?"
2. "How do I check how many years are left on a lease?"
3. "What happens when a lease drops below 80 years?"
4. "The deeds are missing. Can we still sell?"
5. "Is it freehold or leasehold? How do I find out?"

### Rent / yield estimate (not building)
1. "How much rent could I get for a 2 bed in Salford?"
2. "What's the rental yield in Leeds LS6?"
3. "Is buy-to-let still worth it in 2026?"
4. "Average rent for a 3 bed semi near me."
5. "What would my house rent for?"

---

## Decisions needed before Phase 3

1. **Top 3 as one plugin?** Sell or keep + Property facts + Empty home checklist.
2. **Tax and cost figures in the sell-or-keep tool.** These are statutory rates plus the user's own numbers. Does that clash with "no numbers in probate copy"? I'd say the rule covers **our marketing copy**, not a calculator showing the user their own maths. Your call.
3. **Fix the P0 quote email first?** The handoff depends on it. I'd do it as a separate small PR.
4. **Compliance opinion.** The probate strategy says no legal claims (devastavit, best price) until the SRA/RICS/FCA opinion is in. The plugin copy will follow that. Has Ant commissioned it?

_Scores are my judgement, not measured data. "Rec fit" is a guess about how ChatGPT's recommender behaves; OpenAI only says it rewards usefulness and satisfaction._
