# A buyer's-side AI agent — could Kept become a consumer product?

_Filed 2026-09-09. Desk research (web) + a full audit of this repo. Status:
**research only — nothing built, no decision taken.**_

**The bet, in the founder's words:** in five years, the admin and
coordination between buyers, sellers and agents will be done by AI agents.
Build the buyer's one now: it finds the right homes, contacts and chases
estate agents, replies to them, books viewings, and walks the buyer through
the whole purchase.

---

## 1. Short answer

- **The gap is real.** Nobody in the UK does the whole loop for an
  ordinary buyer. The search half is crowded. The **chase, coordinate and
  progress** half is empty.
- **The hard part is not the code.** It is (a) getting listings data we are
  allowed to use, (b) getting the seller's agent to deal with a machine
  acting for a buyer, and (c) who pays. All three are unproven.
- **We reuse more than half of the plumbing.** Property data, AVM,
  the purchase timeline, the hold-for-review pattern and the AI wrapper
  transfer almost as-is. The whole product surface is new.
- **The one thing that would kill it:** estate agents won't engage with a
  bot for a buyer unless it makes *their* job easier. Test that with real
  agents before writing product code.
- **Recommendation:** run a **concierge test** (five buyers, founder plus
  tooling, ship dark) before any build. See §7.

---

## 2. What is out there now

### 2a. UK — buyer side

| Product | What it does today | Where it stops | Stage |
|:---|:---|:---|:---|
| **Jitty** | AI search over agent-fed listings. Natural-language search, floor-plan reading, shortlists, collaboration. "Homebuying assistant" chat in private beta (Mar 2026). | Search and understanding. Does **not** contact agents or run the purchase yet — but "always on the buyer's side" is its stated direction. | 3m users. $3.8m seed led by REA Group (~10%), plus Google's Gradient Ventures. Agents list free. |
| **One Place** | Meta-search across the market, deduplicated. "Give it a brief, it asks what a buyer's agent would ask, returns a ranked shortlist." | Search only. | Live, UK + Europe. |
| **AI Property Searcher** | Scrapes Rightmove daily, emails personalised digests. | Search only. Scraping-based. | Small, live. |
| **Homesearch** | Listings "structured for AI discovery", sourced from agents. | Data/portal play. | Live. |
| **HomeFinder AI** (London) | "One point of contact": humans plus AI who **speak to agents and developers on your behalf**, incl. off-market. | High-net-worth London only. Human-led. | Small. **Closest to the idea, but boutique.** |
| **Human buying agents** (Garrington, Property Vision, Black Brick, Domus Holmes) | Full service: brief, search, off-market, negotiate, progress. | Prime only. **Fees 1–3% + VAT, £500–3k retainer.** | Established. Kept already courts them as buyers of our exits (`docs/templates/buying-agent-first-look.md`). |
| **Keith** | AI-native **regulated law firm** (Council for Licensed Conveyancers). 24/7 AI client agent, target 70% faster transactions, 80% of legal work automated. | Conveyancing leg only. | £2m seed (Backed VC, Breega). Launch Q3 2026. **Natural partner, not competitor.** |
| **Coadjute "Super App"**, Moverly, Kotini, Property Passport, Veya | Digital property packs, TA6 forms, progress visibility between conveyancer, agent and client. | Data plumbing for the professionals. Buyer sees a timeline, not an agent. | Live. |
| **Tembo** (+ Nude) | Savings → LISA → mortgage broker. "Whole journey" from the money side. | No property search, no agent contact. | Established, award-winning broker. |

### 2b. UK — the other side of the table

This matters: **the agents are getting bots too.**

- **Rightmove in ChatGPT** (Feb 2026): `@Rightmove` search inside ChatGPT. An "experiment" for early-stage search.
- **Zoopla × OpenAI** enterprise deal (Apr 2026): frontier models for agents *and* consumers; aim is to spot intent before the search phase. Zoopla reports +80% listing views, +150% leads on AI features.
- **Agent CRMs**: Alto "Lead Flow" answers portal, WhatsApp and email enquiries 24/7 and books viewings into diaries. Street.co.uk has 24/7 online booking and an open API. Reapit has viewing booking in phased rollout and the broadest API (Foundations).
- **Salesrook**: 50,000 WhatsApp property enquiries a week, handled by AI, on behalf of agents.
- **Dwelly**: £69m to roll up UK agencies and run them on AI.

So the 5-year picture is **agent-to-agent** on both sides. The buyer's agent
will be talking to the seller's agent's bot. That is not a threat to the
thesis. It is the thesis. It also means the *counterparty's* bot will be
built by Alto/Street/Reapit, and our bot must speak their language.

### 2c. US — a year or two ahead

| Product | Model |
|:---|:---|
| **Zillow AI Mode** (Mar 2026) | Conversational search → shortlist → affordability → **book tours, draft offers**. Zillow is the only property app inside ChatGPT. |
| **Realtor.com in ChatGPT** | Pre-search Q&A, routes intent back to agents. |
| **Modern Realty** (YC S24) | An **AI-native brokerage**. Buyers tour and offer without a human realtor; "automation index above 90%". Bay Area first. |
| **Homa** | Buyer tool, not a brokerage. $1,995 flat fee when a selling agent is involved; free otherwise. Florida. |
| **Zown** | End-to-end buying; takes the seller-paid commission and rebates up to $25k to the buyer. CA/TX. |
| **GetMyHome** | High-touch first-time-buyer service, ~$6–7.5k flat. |
| **Ridley** | Seller side, $1.5–5k flat instead of 3%. Raised from Fifth Wall to add **buyer** services. |
| **Flyhomes** | Consumer AI search tech bought by The Real Brokerage (Jul 2025). |

**Why the US is ahead and why it may not transfer:** the 2024 NAR
settlement made the buyer's-agent commission (≈3%) visible and negotiable.
Every US startup above is selling **a cheaper buyer's agent**. In the UK,
buyers **already pay nothing** to anyone. There is no fat commission to
undercut. So the UK product cannot be "cheaper than the alternative". It
has to be "better than doing it yourself", and someone has to pay for it.

---

## 3. The gap, precisely

The pain is documented and large:

- Agents reply to **under 25%** of portal emails. **48%** of sales enquiries
  get no answer at all. Average reply time is about **four working hours**;
  the worst is five working days.
- Enquiries peak 7–10pm; offices shut at 6pm. Evening and Sunday leads sit
  up to 15 hours.
- 78% of buyers work with whichever agent answers first — the buyer's
  outcome is set by whoever bothers to reply.

Nobody serves the mainstream UK buyer with the **persistence layer**:
enquire on every match, chase until answered, hold a viewing slot, follow
up after viewing, keep the offer moving, chase the solicitor. Prime buyers
pay a human 1–3% for exactly this. Everyone else does it themselves,
badly, on evenings.

That is the wedge. Not search. **Search is a commodity by Christmas.**

---

## 4. The case against (challenge before building)

The repo rule from Keyhole applies: state the strongest case against, the
assumption that kills it, and who hates it. Here it is.

### 4a. The recipient problem (the assumption that kills it)

The seller's agent works for the seller and is paid by the seller. Our bot
is the counterparty. To them it is one more lead-form email — the thing
they already ignore 75% of the time.

The only way through is to be the **best buyer in the inbox**: proceedable,
verified, no time-wasting. Agents rank buyers on proof of funds, mortgage
in principle, chain position and seriousness. A bot that arrives *carrying
that evidence*, books into the agent's own diary tool and never no-shows is
a gift to a busy negotiator. A bot that arrives with none of it is spam.

**Test before build:** put ten real enquiries in front of ten agents, half
"from a buyer's AI assistant with verified AIP and chain-free status", half
plain. Measure reply rate and tone. If agents will not deal with a
disclosed machine, the whole product is a chatbot with a nicer search.

### 4b. Listings data

- Rightmove has **no public API** and sells no listing feed. Zoopla likewise.
- Scraping is widespread and "legal for public data" but contested, blocked,
  and against portal terms. The Keyhole PRD already flags this as an open
  legal risk (§8, §12). Jitty and Homesearch solved it by getting agents to
  **feed them directly**, which took years and a portal-sized ambition.
- Our PropertyData licence is **internal use only** — we may not display
  its data to third parties. It cannot be the listings source for a
  consumer product as licensed.

Options: (1) agent-fed listings via Street/Reapit/Alto APIs, starting with
partner agents we already know; (2) buyer brings the links (the buyer
pastes Rightmove URLs and the agent works from those); (3) licensed
aggregator. Option 2 is ugly but legal and needs no permission.

### 4c. Regulation

Under the **Estate Agents Act 1979**, "introducing and/or negotiating" for
someone who wants to buy, in the course of business, **is estate agency
work.** The moment our bot negotiates, we must: join a redress scheme
(Property Ombudsman / PRS), register with HMRC for anti-money-laundering
supervision, hold client money rules, and meet the coming Code of
Practice. Search and admin alone probably sit outside; **negotiating and
offering do not.** Kept is already inside this regime for its own buying,
which is an advantage, but a consumer product is a separate, larger
compliance surface (and a data-protection one: it holds buyers' financial
proofs).

### 4d. Who pays

- UK buyers do not pay agents. Willingness to pay is unproven.
- Three models: **subscription** (£20–50/month while searching);
  **success fee** (0.25–0.5% at completion, needs the regulated wrapper);
  **referral** (mortgage, conveyancing, survey commissions).
- Referral is the tempting one and the **Keyhole trap**: a "free buyer's
  agent" that earns by routing you to a broker is a lead funnel wearing a
  costume, and buyers will smell it. If we go referral, disclose it in the
  product, not the terms.

### 4e. Conflict with Kept

Kept buys houses below market. A Kept buyer's agent advising a consumer
whether a price is fair, in a market where Kept is also a buyer, is a
conflict — small in practice (different stock), obvious in a headline.
Either a **separate brand** or a public wall between the two.

### 4f. Who hates it, and why

- **Estate agents**: lose control of the buyer relationship; extra inbound
  noise; some will block the domain. Mitigation: make their life easier
  (proceedable buyers, diary-booked, no no-shows).
- **Portals**: bot traffic against their terms; they want the buyer inside
  their own AI. Mitigation: never scrape at scale; go agent-fed.
- **Human buying agents**: we are currently trying to sell to them
  (`buying-agent-first-look.md`). Launching against them ends that.
- **Conveyancers**: another chaser. Mitigation: chase with data (Coadjute /
  Moverly milestones) not with emails.
- **OpenAI / Google**: they want to be the buyer's assistant. Rightmove,
  Zoopla, Zillow and Realtor.com are already inside ChatGPT. Our edge has
  to be *doing*, not *answering*.

### 4g. Focus

Kept has a seller-side business that is not yet at scale, a founder who
reviews every vendor email, and a repo that is single-tenant. A consumer
product is a second company. Only do it if the seller business can run
without the founder's daily hands, or if this *is* the pivot.

---

## 5. What we already have (repo audit)

Full audit in the session; the headlines. **Have** = reuse as-is or nearly.
**Partial** = skeleton exists, needs rework. **Missing** = build from
scratch.

| Capability the product needs | Status | Where it lives |
|:---|:---|:---|
| Address resolution, UPRN, lat/lng | **Have** | `packages/property-data/src/os-places.ts` |
| Sold prices, HPI, EPC, leases, flood, planning, demographics, council tax | **Have** | `packages/property-data` (HMLR + EPC free; rest via PropertyData) |
| Active listings with agent name + phone | **Partial** | `getActiveListings()` via PropertyData — internal-use licence only |
| "Is this asking price fair?" (AVM + confidence + comps + risk) | **Have** | `packages/valuation` `runAVM()`, `generateCompRationale()` |
| Buyer's cost breakdown (SDLT, legals, refurb) | **Have** | `computeSdltPence()`, `computePurchaseLegalsPence()`, `estimateRefurb()` |
| Brief → match → score → shortlist → plain-English "why" | **Partial** | `packages/scouting` skeleton: `screenDealbreakers`, `scoreLead`, `selectShortlist`, `enrichRationaleWithLlm`. Weights are for distress, not buyer taste. |
| Config-driven scoring, retune without deploy | **Have** | `EvalConfig` + `FounderFeedback` + `/settings/evals` |
| Draft-then-approve before anything is sent | **Have** | `OutreachHold` + holds review UI. Becomes "approve what my agent sends". |
| Per-listing enquiry to an agent | **Missing** | Current outreach is B2B to firms, not per-property |
| Conversation threads with an agent | **Missing** | No thread model anywhere |
| Inbound email reply parsing and classification | **Missing** | Only inbound route is PDF forwarding (`webhooks/postmark/inbound`) |
| Follow-up / chase scheduler | **Missing** | `delayDays` is displayed, never executed; only step 1 ever sends |
| Viewing booking with the agent | **Missing** | Calendly is one-way into the founder's diary |
| Outbound SMS / WhatsApp / voice | **Missing** | Email (Resend) is the only outbound channel |
| Buyer-facing "where is my purchase" timeline | **Have** | `packages/deal-updates` + `TrackToken` + `/track/[token]` — 19 update kinds, no login needed |
| Conveyancing checklist | **Partial** | `LEGAL_STEPS` is a 12-step cash, chain-free list. Needs mortgage offer, survey, chain, gifted deposit. |
| Solicitor chaser (drafted, held) | **Have** | `cron/legal-chaser` |
| Document reading (OCR + extraction) | **Partial** | `packages/document-pipeline` — probate is the only rich doc type |
| Public intake flow (stepped, rate-limited) | **Have** | `apps/web/app/instant-offer` chat-flow skeleton |
| No-account magic links | **Have** | `TrackToken`, `Viewing.token`, `InvestorAccessToken` pattern |
| LLM wrapper: caching, fallback chain, per-feature model routing, cost log | **Have** | `packages/ai/claude.ts`, `routing.ts`, `LlmCallLog` |
| An agent loop with tools | **Missing** | Every LLM call is one-shot. Multi-step = cron + FounderAction queue. |
| Knowledge base (RAG) | **Have** | `packages/knowledge-base` — re-point at buyer guides |
| Multiple users, each seeing only their own data | **Missing** | **Single-tenant.** No `userId` on Deal, Lead, Contact, Campaign, Hold, LegalStep. Every query assumes "all rows are ours". |

**Reuse score:** roughly half the plumbing. Zero of the product surface.

**The biggest single job is multi-tenancy.** Adding an owner key to a dozen
models and scoping every server action and cron. Do it once, early, or
fork a fresh app that imports the packages and leaves `apps/app` alone.

---

## 6. What we would need to build

In the order a buyer meets it.

1. **Buyer brief.** Structured: budget, AIP status, chain, must-haves,
   nice-to-haves, commute anchors, deal-breakers. Verified proofs
   (AIP letter, proof of deposit) because the bot's credibility with agents
   depends on carrying them. New model: `Buyer`, `Brief`, `Proof`.
2. **Listings source.** Start with buyer-pasted URLs plus agent-fed listings
   from partner agents. Add a scraper only with legal sign-off. New:
   `Listing`, `Match`.
3. **Matcher.** Reuse the scouting skeleton with buyer-taste weights.
   Reuse AVM for "fair price?" and SDLT for "true cost". Rationale in
   plain English.
4. **Enquiry + thread.** Per-listing enquiry drafted in the buyer's name,
   carrying the proofs, **held for the buyer's one-tap approval** (our
   existing safety rail, pointed at the buyer instead of the founder).
   New: `Thread`, `Message`, inbound email parsing (Postmark/Resend
   inbound), reply classification (viewing offered / sold / need info /
   silence).
5. **Chase scheduler.** Real follow-ups: 24h, 72h, then phone script.
   Replace the decorative `delayDays`.
6. **Viewing booking.** Integrations with Street / Reapit / Alto diaries
   where the agent has them; fallback to proposing three slots by email
   and writing the confirmed one to the buyer's calendar.
7. **Offer support.** AVM-backed offer range, offer letter, chain and
   proof pack. **Stop short of negotiating** until the regulated wrapper
   exists (§4c).
8. **Purchase tracker.** Reuse `deal-updates` + `/track` as the buyer's
   home screen. Extend `LEGAL_STEPS` for mortgaged, chained purchases.
   Partner with Keith or a Coadjute-connected firm for the legal leg
   rather than building it.
9. **Channels.** Email first. WhatsApp Business API (not `whatsapp-web.js`)
   for buyer notifications. Voice (Vapi/Bland-style) for agent chasing
   later — agents answer phones, not emails.
10. **Accounts.** Clerk already there. Multi-tenant schema. Separate
    brand and domain.

Rough shape: **3–4 months** for a founder plus one engineer to a
working Phase 1 (brief → matches → approved enquiries → threads → chase),
assuming agent-fed or pasted listings and email only. Multi-tenancy and
the inbound parser are the long poles.

---

## 7. Recommended path — ship dark, prove the mechanism

Following the Keyhole rules: the premise must survive one real user
before product code.

**Phase 0 — concierge (2–3 weeks, no product code).**
- Five real buyers (friends, waitlist), one shared inbox, the founder as
  the "agent", helped by scripts on top of the existing packages
  (AVM, SDLT, property data) and a Notion board.
- Send enquiries as "X's buying assistant", carrying the AIP.
- Measure: agent reply rate vs the 25% baseline, viewings booked per
  enquiry, buyer NPS, and what buyers say they would pay.
- Kill gate: if agents reply to the disclosed assistant *less* than they
  reply to the buyer directly, stop.

**Phase 1 — private beta (if Phase 0 clears).** Brief, matcher, approved
enquiries, threads, chase. Twenty buyers. Noindex. No outreach.

**Phase 2 — viewings + tracker.** Diary integrations, the purchase
timeline, Keith/conveyancer partnership.

**Phase 3 — the regulated leg.** Redress scheme, AML, negotiation and
offers. Only if Phases 1–2 show buyers finishing purchases through it.

---

## 8. Why the timing might be right

- **Government reform (announced 19 Jun 2026):** upfront digital sales
  packs, binding conditional contracts, digital ID and e-signatures, an
  agent Code of Practice. Not law yet. But every one of these makes the
  transaction **machine-readable** — exactly what an agent-to-agent world
  needs. A buyer's agent that reads the sales pack the day it is listed is
  the product this reform is quietly asking for.
- **Both sides are automating.** Agent CRMs are shipping bots. Portals are
  in ChatGPT. The buyer is the last unrepresented party.
- **Search is being commoditised** by the portals and OpenAI. The value
  moves to *doing*.

And why it might not: OpenAI or Zoopla ships "book me a viewing" inside
their assistant first, agent CRMs refuse bot enquiries, or UK buyers never
pay. The Phase 0 test answers the second; nothing answers the first.

---

## 9. Decisions for the founder

1. **Is this a Kept product, a sister brand, or a new company?** (§4e, §4g)
2. **Do we run the Phase 0 concierge test?** Five buyers, three weeks,
   founder time only.
3. **Which listings path do we accept:** buyer-pasted, agent-fed, or
   licensed? (No scraping without legal advice.)

---

## Sources

UK buyer side: [Jitty seed round](https://www.onlinemarketplaces.com/articles/jitty-raises-3-8-million-seed-round-led-by-rea-group/), [Jitty homebuying assistant launch](https://aimgroup.com/2026/03/27/jitty-launches-homebuying-assistant-as-users-hit-3-million/), [Jitty conversational search](https://www.estateagenttoday.co.uk/breaking-news/2026/03/jitty-launches-ai-conversational-search-to-help-reduce-fall-throughs/), [One Place](https://one-place.com/news/ai-property-search-vs-traditional-portals), [AI Property Searcher](https://www.aipropertysearcher.com/), [Homesearch](https://homesearch.co.uk/), [HomeFinder AI](https://www.homefinder.ai/faqs), [Keith £2m seed](https://thenextweb.com/news/keith-ai-law-firm-2m-seed), [Keith launch](https://www.eu-startups.com/2026/03/a-law-firm-that-never-sleeps-uk-based-keith-raises-e2-3-million-ahead-of-q3-2026-launch/), [Coadjute Super App](https://www.coadjute.com/resources/coadjute-property-super-app), [Kotini](https://kotini.co.uk/), [Property Passport](https://www.propertypassport.uk/guides/digital-property-logbooks-compared-uk), [Tembo acquires Nude](https://www.tembomoney.com/learn/tembo-acquires-lifetime-isa-provider-nude), [Buying agent fees — HomeOwners Alliance](https://hoa.org.uk/advice/guides-for-homeowners/i-am-buying/buying-agents/), [Buying agent fees — Perrygate](https://perrygate.london/buying-agent-fees/).

UK agent side: [Rightmove in ChatGPT](https://www.rightmove.co.uk/press-centre/rightmove-becomes-first-uk-property-portal-to-launch-in-chatgpt/), [Zoopla × OpenAI](https://www.estateagenttoday.co.uk/breaking-news/2026/04/zoopla-signs-enterprise-agreement-with-openai-to-help-agents-engage-earlier/), [Alto / Street / Reapit compared](https://www.estateagenttoday.co.uk/sponsored-content/2026/05/the-best-ai-crms-for-estate-agents-in-2026-alto-street-and-reapit-compared/), [Salesrook](https://www.barchart.com/story/news/30689060/salesrook-reports-127-revenue-growth-and-50000-weekly-property-enquiries), [Dwelly £69m](https://www.fortune.com/2026/02/25/dwelly-ai-roll-up-uk-lettings-agencies-real-estate-brokerages-93-million-new-venture-captial-funding-to-fuel-expansion), [Rightmove data access](https://scrapfly.io/blog/posts/how-to-scrape-rightmove).

Pain data: [Homeflow response study](https://www.homeflow.co.uk/posts/39-of-home-sellers-wait-for-an-estate-agents-response), [Lightwork 5-minute rule](https://blog.lightwork.co/lead-response-time-in-property-why-the-first-five-minutes-win-the-instruction/), [Property Industry Eye](https://propertyindustryeye.com/estate-agents-slow-to-respond-promptly-to-enquiries-from-potential-clients/), [After-6pm response](https://top10propertyagents.co.uk/blog/why-estate-agent-response-time-drops-after-6pm-and-how-to-fix-it/).

Regulation and reform: [Who regulates estate agents — Commons Library](https://commonslibrary.parliament.uk/who-regulates-estate-agents/), [Estate Agents Act 1979](https://www.legislation.gov.uk/ukpga/1979/38), [Home buying and selling reform roadmap — GOV.UK](https://www.gov.uk/government/consultations/home-buying-and-selling-reform/outcome/home-buying-and-selling-reform-roadmap), [HomeOwners Alliance on the reforms](https://hoa.org.uk/advice/guides-for-homeowners/i-am-buying/home-buying-and-selling-reforms/), [Law Society](https://www.lawsociety.org.uk/topics/property/home-buying-selling-reforms).

US: [Zillow AI Mode](https://www.zillow.com/news/zillow-debuts-ai-mode/), [Zillow in ChatGPT](https://www.zillow.com/news/zillow-becomes-first-real-estate-app-in-chatgpt/), [Realtor.com in ChatGPT](https://www.realestatenews.com/2026/03/30/realtor-com-the-latest-portal-to-launch-search-app-in-chatgpt), [Modern Realty (YC)](https://www.ycombinator.com/launches/LQQ-modern-realty-the-ai-real-estate-agent), [AI agent platforms 2025 — HousingWire](https://www.housingwire.com/articles/ai-real-estate-agent-platforms-2025-realpha-homa-modern-realty-bramble/), [Zown](https://techbeat.ca/founders/rishard-rameez-zown-down-payment-boost-interview/), [GetMyHome pricing](https://www.getmyhome.ai/actions-pricing), [Ridley](https://www.housingwire.com/articles/ridley-ai-colorado-launch-mike-chambers-social-media-home-sellers/), [Real acquires Flyhomes tech](https://www.sec.gov/Archives/edgar/data/1862461/000164117225017310/ex99-1.htm).

Internal: `docs/LEARNINGS.md` (2026-08-29), `docs/prds/keyhole-v1-2026-08.md`, `docs/templates/buying-agent-first-look.md`, `docs/DECISION-STACK.md`.
