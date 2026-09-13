# Scout + appraisal — Perplexity review prompt

_Written 2026-09-12. Derived from `packages/scouting`, `packages/valuation`,
`packages/property-data`, the `apps/api` crons and the docs listed at the
bottom, as of that date. If the scorer, the AVM blend or the offer config
changes, update this before running it again._

## Why this exists

We want an outside engine to judge the **approach**, not the code. This
document describes how the scout finds leads and how the appraiser turns a
lead into an offer, in enough detail that a critic can see every assumption.
It also lists the weaknesses we already know about, so the critique spends
its effort on what we cannot see ourselves.

The prompt is deliberately **anonymous**. It describes the machine but never
names the company. Keep it that way.

## How to run it

- Perplexity → **Deep Research**.
- Paste the whole master prompt below in one go.
- Read the executive summary first. Then run the follow-ups one at a time in
  the same thread.
- Always finish with follow-up **C (adversarial pass)** before trusting
  anything. Same pattern as the Aug 2026 prime research.
- File the report as `docs/research/scout-appraisal-review-<yyyy>-<mm>.md`
  and add it to the README index.

## The master prompt

```text
You are a senior reviewer with deep experience in UK residential
property sourcing, automated valuation models (AVMs), and data
pipelines. I run a small UK company that buys distressed and
motivated-seller homes direct from the vendor, with cash, and
completes fast. One founder runs the whole operation with software
doing the repeatable steps.

Your job: judge our SCOUT (how we find leads) and our APPRAISAL
(how we value and price them). Tell us what is wrong, what is
missing, what is over-engineered, and what to change first. Be
specific, quantitative, and cite every external claim.

## Strategy in brief

- Two tracks. "Volume": ordinary distressed stock anywhere we
  choose to hunt. "Prime": London period houses worth £700k+
  priced below their own street, where the discount is explained
  by condition (unmodernised, derelict, poor EPC). Prime is a
  refurbish-and-resell play with an owner-occupier exit at £1M+.
- Operating rule: automate the steps (scraping, enrichment,
  scoring, valuation, drafting) and protect the thoughts (the
  vendor call, the negotiation, the final offer). Software hands
  the founder a decision, never a blank page.
- Vendor-facing messages are never auto-sent. A person reviews.
- We never show a price to a seller before viewing. A written
  offer follows within two working days of viewing and is held
  for a week.
- We are NOT buy-to-let investors, £3M+ super-prime dealers, or
  ground-up developers.

## PART A — How we scout

### A1. The one-line version

One pipeline fans out to about ten discovery sources, dedupes on
a normalised address, ranks the pool with a free provisional
score, shortlists a bounded batch, pays for enrichment on that
batch, scores each lead on two pillars, classifies it onto a
track (volume / prime / block), gates volume leads on a
normalised score of 50 or more, screens the survivors against
founder-written dealbreakers, and writes them to the database
with founder review cards. A separate 30-minute job drains the
Companies House streaming API through the same scorer.

### A2. Sources

| Source | How | What it yields | Cost | State |
|:--|:--|:--|:--|:--|
| Portal-derived distress lists (a paid UK property-data API, "sourced properties" endpoint) | One call per seed postcode per list type. Volume seeds sweep 7 lists: repossessed, quick-sale, reduced, slow-to-sell, derelict, unmodernised, back-on-market. Prime seeds sweep 10 (adds no-chain, cash-buyers-only, poor-EPC) | Listing, asking price, original price, discount %, number of reductions, days on market, beds, type, floor area, photo, "sold subject to contract" flag | ~1–3 credits per call, cached 24h, hard limit 4 calls per 10 seconds | Live. Supplies almost every production lead |
| The Gazette probate notices (free public JSON) | List pages then one detail fetch per notice. Address parsed from prose near a UK postcode | Deceased's address, executor, solicitor if present. No estate value | Free, paced | Live since a rewrite in late July 2026. 1–3 week lag after grant. Overseas notices dropped |
| Companies House charges and insolvency (REST) | Search property-SIC companies (68100, 68209, 68320) in this run's districts; fetch charges delivered in the last 48h and insolvency filings | Lead per charge with an address mined from the charge particulars, else the registered office | Free, ≤41 requests per run | Live. Registered office is often not the property |
| Companies House streaming API | Charges and insolvency streams drained every 30 minutes, filtered to property SIC codes and all configured areas | Same lead shape, minutes after filing | Free | Live. Also feeds a read-only entity graph |
| Receiverships (Gazette insolvency feed + Companies House charges) | Receiver / administrator / liquidator appointments, company number regexed from the notice, postcodes mined from charge particulars | One lead per postcode found | Free | Live. Nationwide, not district-filtered. Addresses noisy |
| Brownfield land registers (planning.data.gov.uk) | Weekly walk of ~37,500 rows. Keep sites with permission, 18+ months old, still on the register, ≤40 dwellings | "Lapsing consent" leads, in-patch first, capped 40 per run | Free | Live, Wednesdays only |
| Short leases (paid API, tenure by postcode) | Per seed postcode; keep leaseholds under 85 years | Lease years, band (critical <60, unmortgageable <70, marriage value <80, watch <85), urgency 0–1 | ~3 credits, cached 30 days | Live by default |
| HMCTS probate | Placeholder | Nothing | — | Dark. No public API exists. Commercial probate feeds (£400–800 a month) deferred |
| Planning applications, HMO register, dissolved property companies | Paid API loops | — | — | Coded but permanently skipped in production (too slow) |
| Auction catalogues (three houses + Allsop) | Separate weekly scan; lots flow into the same track classifier | Guide prices as floors | Free scrape | Live, Mondays |

Contact enrichment (owner name, phone, email) is a three-tier
cascade: a probate-data provider, then a batch property-data
provider, then "manual". Neither paid provider's contract has
been verified against a live account, so in practice every lead
lands on tier 3 with no contact, and the run reports itself as
degraded.

Free enrichment at scoring time, per lead: HM Land Registry
price-paid for the postcode (last 10 sales, plain mean as the
"area average"; synthetic fallback exists but every consumer
checks for it and ignores it), HM Land Registry house price index
(currently returns "unavailable"), and the property's own EPC
certificate (official register, free token).

Paid enrichment per unique postcode on the shortlist: flood
risk, dominant EPC band, tenure, and demographics (percent over
65 — fetched but never scored).

### A3. Lead types and tracks

Each lead gets a motivation class. From the portal lists:
repossessed → repossession; quick-sale, auction, cash-only →
distressed sale; back-on-market, no-chain → chain break; derelict
→ empty property; short-lease → lease expiry; reduced,
slow-to-sell, unmodernised, poor-EPC → "unknown" (deliberate, so
those signals are scored once via other factors). Gazette →
probate. Companies House charge → mortgage default. Insolvency →
distressed sale. Receiver → receivership. Brownfield → lapsing
consent. Divorce, downsizing and relocation exist in the score
table but no source emits them.

Track classification:
- Block: a text pattern on the address and summary ("block of N
  flats", "portfolio of", "freehold building", "HMO", "N
  dwellings"…). Checked first.
- Prime: only inside a prime district (or when the postcode is
  unreadable, which never demotes). Own value ≥ £700k; OR no own
  value and the Land Registry street average ≥ £700k (real data
  only); OR own value under the floor but ≥ 40% of a £700k+
  street average and not flat-shaped (the "discounted prime"
  path). No ceiling. £1.5M+ gets a "cornerstone" badge only.
- Auction lots: a £700k+ guide is prime anywhere; inside a prime
  district a non-flat guide ≥ 70% of the floor is prime.
- Prime opportunity test: discount to street = 1 − value ÷ street
  average; needs ≥ 10% AND condition evidence (unmodernised /
  derelict / poor-EPC badge, refurb language, or own EPC F/G). A
  discount with no evidence is surfaced as "check why", never as
  an opportunity.

Dropped on the way in: plots, land, garages, development sites,
anything already sold subject to contract. Commercial premises
are kept but badged and penalised.

### A4. Geography

- The founder keeps a list of areas in settings. Each has a seed
  postcode, district, radius and a track (volume or prime). Any
  real UK district resolves dynamically via postcodes.io; nothing
  is ever fabricated (an earlier bug guessed a fake postcode and
  the paid API rejected it days later).
- Rotation: 6 volume areas per run, oldest-probed first. Prime
  areas are scanned every run, outside the cap.
- Built-in prime list: 33 zone 2–4 London districts chosen for
  Victorian/Edwardian terrace stock (SW11, SW12, SW17, SW18, SW4,
  SW16, SW6, SE22, SE21, SE24, SE23, SE15, SE3, N8, N10, N16, N4,
  N19, N7, W4, W5, W3, W12, W13, NW6, NW10, NW5, NW2, E5, E8, E9,
  E17, E11) plus 6 super-prime districts (W8, W11, SW3, SW7, NW3,
  NW8) that are visible but not the focus. Founder-marked areas
  extend the list. The list is a reasoned hypothesis. A script
  exists to rank districts by measured £/sqft gap between EPC F/G
  and A–C sales, but it has not yet changed the list.

### A5. Scoring (0–100, two stages)

Every point is a named factor stored on the lead so the founder
can see why.

Caps: acquisition 45, ROI 40, market trend 10, risk −10 to +10.

Pillar 1 — acquisition (cap 45):
- Lead type: probate 20, letters of administration 20,
  receivership 19, repossession 18, distressed sale 18, mortgage
  default 16, divorce 14, lease expiry 14, empty property 12,
  lapsing consent 12, chain break 11, downsizing 9, relocation 8,
  unknown 4.
- Days on market: 180+ → 12, 90+ → 8, 60+ → 4.
- Condition badge: derelict 10, unmodernised 10, poor-EPC 6,
  reduced 5, quick-sale 5, slow-to-sell 4.
- Price velocity (discount % × drops ÷ days on market): up to 6.
- Distress bonus 5 for repossessed / cash-only / no-chain /
  back-on-market.
- Solicitor identified 4. Letters of administration 3.
- Commercial penalty −12.
- Short lease: 10 + up to 8 by urgency.
- "Ripe for modernisation" (own EPC evidence, added Sep 2026):
  EPC F/G 6, E 3, certificate 10+ years old 3, dated heating
  language 4, no sale for 25+ years 5 (15+ → 3), badge or refurb
  text 6/4. Capped at 8. Positive evidence only; unknown scores
  nothing either way.

Pillar 2 — ROI (cap 40):
- Before appraisal, an "equity proxy" needs an asking price: ratio
  = asking ÷ street average. Under 40% → 2 ("probably not
  comparable stock"). Under 95% with condition evidence → 15 / 12
  / 10 by depth. Under 95% with no evidence → 3 and "check why".
  95–105% → 9. Above the street → 6 or 8. No comparable → 4.
  (Rewritten Sep 2026: the old version rewarded being ABOVE the
  street.) Note the asking price used is the pre-reduction
  original.
- After appraisal (see Part B), the proxy is replaced by
  below-market bands (asking vs AVM: 20%+ → 25, 15–20 → 20, 10–15
  → 14, 5–10 → 8, 0–5 → 3) plus cash-ROI bands (25%+ → 15, 20–25
  → 12, 15–20 → 8, 10–15 → 4), multiplied by AVM confidence (high
  ×1, medium ×0.6, low ×0.3), zeroed with no comps or for blocks
  and 5+ bed houses off-prime.

Modifiers: market trend from the house price index (rising 10,
stable 6, declining 3, unknown 5); flood high −6 / medium −3 /
low +1; postcode-dominant EPC F/G −4, E −2, A–C +2; lease under
60 years −6, under 80 −3, over 125 +1; freehold +2; 3+ planning
refusals nearby −2.

Verdict: STRONG ≥ 70, VIABLE ≥ 50, THIN ≥ 30, else PASS.
INSUFFICIENT DATA with no address or postcode.

Sourcing gate (volume track only; prime and block bypass it):
sourcing score = total ÷ achievable points × 100, where
achievable = 45 + ROI ceiling (0 with no price, 4 with a price
but no comparable, 15 with one) + 10. Threshold 50. Calibrated so
"lead-type credit only plus unknown market" sits at about 49.

All weights live in a versioned config the founder can edit in
the app. Calibration suggestions are derived from the founder's
1–5 star ratings on leads: a factor that keeps appearing on
leads rated ≤ 2.5 is "over-weighted", ≥ 4 "under-weighted", and
a one-click nudge (±25%, min 1) saves a new config version.
Nothing auto-applies.

### A6. Shortlist, cost and time budget

- Candidate pool capped at 500 after dedupe.
- Provisional ranking is free. Shortlist = top 30 volume (ties
  at the cutoff kept, up to +15) plus guaranteed slots for any
  prime/block candidate, any valueless notice in a prime
  district, and any non-flat valued ≥ £525k in a prime district.
  The guaranteed door was tightened in late Aug 2026 after it let
  232 captures through in a day.
- Then GDPR sanitise (about 35 blocked keys stripped), contact
  enrichment, paid per-postcode enrichment, free per-lead
  lookups, scoring, track, opportunity test.
- Hard deadline 620 seconds inside an 800-second function. Phases
  cut by the deadline are recorded by name.
- After persistence, the top 8 leads by score get a fuller paid
  property snapshot (8 endpoints, ~22 credits per new postcode,
  reused for 7 days), then the appraisal job is kicked.
- Prime seeds cost roughly 40% more credits than volume seeds.
  Ten prime areas ≈ 900 credits a month on a daily run.

### A7. Dedupe

- Within a run: key = house number | canonical street | postcode
  (abbreviations expanded, stop words removed). First source wins
  in a fixed order.
- Across runs: a database unique constraint on the raw (address,
  postcode) string pair, with duplicates skipped on insert.
  Spelling variants across sources can still create two rows.
- Probate leads are matched to Land Registry sales by a weighted
  address score (postcode 0.40, house number 0.35, street token
  overlap 0.25; confident ≥ 0.85).

### A8. Orchestration

- The scout has NO schedule. The founder clicks "Run scout now"
  (decision Aug 2026, to control paid-API spend). Streaming
  Companies House runs every 30 minutes. Lead appraisal runs
  daily 07:50, deep appraisal 08:30, auction scan and agent
  prospecting on Mondays.
- Dealbreaker screen: rules are mined by an LLM from the
  founder's free-text feedback over the last 180 days (max 20
  rules). A cheap LLM screens STRONG and VIABLE leads in batches
  of 20 at temperature 0; hits are stored as "passed" with the
  rule and reason.
- Statuses: new → shortlisted / watching / passed → converted.
- Founder cards: one "review leads" card per run (high priority
  if 5+ leads score 70+ or any STRONG), one "prime leads" card per
  day when any non-volume lead lands, and a "draft outreach"
  card for the marketer when any lead scores 70+ (drafts are
  held, never sent).
- Source health: each source reports ok / error / skipped / not
  configured. A card is raised if any core source faults or all
  are dark, and auto-closed when clean. A "dry streak" card fires
  after N runs that qualified 5+ leads but persisted 0.
- An LLM rationale (≤ 50 words, STRONG leads only) exists in code
  but the production job does not switch it on. The founder sees
  a deterministic rationale string instead.

### A9. Feedback loops that exist

- Star ratings and overrides (score, verdict, status) on each
  lead, with the scorer's factors captured for context.
- LLM-mined "insights" from feedback notes: 26 fixed themes,
  likes and dislikes with quotes, and dealbreakers.
- Calibration suggestions → config versions (above).
- Tests: a synthetic-population backtest asserts the sourcing
  gate passes 50–95% and stays within ±25% of the old raw gate.
- There is NO backtest of lead score against deal outcome. A
  converted-deal link exists on each lead but nothing joins it
  back to the score factors.

### A10. Weaknesses we already know about (do not just repeat these)

- Contact enrichment is effectively dead; every lead is
  contactless.
- Valueless sources (Gazette probate, receivership, Companies
  House charges and stream) score 44–53 on the sourcing scale and
  pass or fail on postcode-level modifiers. Stream leads never
  carry a solicitor field, so a volume-track stream lead tops out
  at 44 and cannot pass the 50 gate; only prime/block stream leads
  can land.
- "Street average" is the plain mean of the last 10 Land Registry
  sales in the postcode, any type, any age. Both the equity proxy
  and prime classification rest on it.
- The equity proxy uses the pre-reduction asking price.
- The risk EPC factor uses the postcode's dominant band, not the
  property's own.
- The house price index feed is unavailable, so market trend is
  always "unknown" (5) and time adjustments are not HPI-driven.
- Planning, HMO and dissolved-company sources never run in
  production. HMCTS is permanently dark. One paid API supplies
  almost all volume.
- Cross-run dedupe is an exact string match.
- The prime district list is unmeasured. The super-prime tier has
  no behavioural effect.
- No outcome-based backtest of the scorer. Calibration is stars
  versus score, and only some factors are tunable from
  suggestions.
- The LLM rationale is switched off in production.

## PART B — How we appraise (the AVM and the offer)

### B1. The one-line version

One function values every property. It blends up to four
"pillars" into a market value, scores risk, projects a trend,
and turns the value into an offer. A separate deal model
checks whether the deal clears a cash ROI target.

### B2. Inputs

- Required: postcode, property type (detached / semi / terraced /
  flat), seller type (probate / chain break / short lease /
  repossession / relocation / standard).
- Optional: address, floor area, bedrooms, five environmental
  inputs (radon, coal, knotweed, flood, noise), construction type,
  remaining lease years, rental yield.
- Reality check: no production caller supplies the environmental
  inputs, construction type, lease years or yield. They all
  default to zero risk. So in practice the risk module only ever
  applies EPC band and build era.
- Type mapping is lossy: bungalow → detached; unknown → terraced
  (flagged).

### B3. Data sources pulled per valuation (in parallel)

| Source | What | Cost | Cache |
|:--|:--|:--|:--|
| HM Land Registry Price Paid (linked-data API) | 20 most recent sales in the exact postcode | Free | none |
| HM Land Registry UK HPI | Regional annual + monthly change | Free | none. Was 404-ing mid-2026 → "unavailable" (0%) |
| EPC register (official API) | Rating, floor area, construction age band | Free | none |
| PropertyData /sold-prices | Sold comps in a radius with addresses, geocoded via postcodes.io | ~2 credits | 7 days |
| PropertyData /valuation-sale | Third-party AVM as a cross-check | ~3 credits | 7 days. Floor-area unit (m² vs sqft) unconfirmed |
| PropertyData /floor-areas | EPC floor area for the subject and up to 5 comp postcodes | ~2 credits each | 90 days |
| PropertyData /prices-per-sqf | Area £/sqft benchmark (asking-price based) | ~2 credits | 30 days |

- PropertyData allows 4 calls per 10 seconds per key. A global
  limiter and a Postgres cache tier enforce this.
- Worst-case cold cost of one valuation: about 19 credits.
- OS Places (UPRN) exists but the AVM does not use it.
- Flood-risk adapter exists but the AVM does not use it.

### B4. Pillar 1 — comparable sales value (CSA)

Three tiers, best available wins:

**Tier 1 — distance-weighted PropertyData comps**
- Subject geocoded. Comps pulled with max age 12 months, same
  property type, same bedrooms if known, up to 100 points.
- Two rings: within 0.25 miles ("near") and 0.25–0.5 miles
  ("far"). Beyond 0.5 miles discarded.
- Comps that cannot be geocoded are kept and placed at distance
  0 (near ring). If more than half were approximated, confidence
  is capped at medium.
- Time adjustment: price × (1 + 0.004 × months ago). A flat
  +0.4% per month, not HPI-derived.
- CSA = near median × 0.6 + far median × 0.4. If one ring is
  empty, 100% the other.
- Confidence: 3+ near comps → high; 3+ total → medium; else low.
- No outlier removal on this path.

**Tier 2 — HMLR exact-postcode comps**
- Same type only. Max age 36 months. Max 12 comps, newest first.
- Same +0.4%/month adjustment. Outliers beyond 2σ removed.
- CSA = median. No addresses or distances on this path.

**Tier 3 — fallback**
- Postcode average price (or £250,000) × type multiplier
  (detached 1.35, semi 1.0, terraced 0.85, flat 0.72).
- Zero comps, confidence forced low, flagged synthetic.

### B5. Pillar 2 — "hedonic" value

- Despite the name, it is the CSA nudged by bedrooms (only when
  bedrooms are known and no floor area exists: 1 bed −20%,
  2 bed −5%, 3 bed 0, 4 bed +12%, 5 bed +22%), then × (1 + HPI
  annual change × 0.15).
- In most cases it is the CSA plus a small HPI nudge. It is not
  an independent signal.

### B6. Pillar 3 — external AVM cross-check

- PropertyData's own valuation, if the call succeeds.
- Weighted 15–20% of the blend when present.

### B7. Pillar 4 — size (£/sqft), added Sep 2026

- Each sold comp is matched to its EPC floor-area row by strict
  house number + street match (12 never pairs with 12A, 112 or
  Flat 12).
- Sanity bounds: floor area 20–700 m², rate £50–£3,000 per sqft.
- £/sqft per comp; medians per ring blended 60/40.
- Needs at least 2 matched comps, otherwise falls back to the
  area £/sqft benchmark, and only if the subject's own floor
  area is verified.
- Size estimate = rate × subject sqft.

### B8. Blending the pillars

Weights depend on which pillars exist. Examples (CSA / hedonic /
external / size):
- Distance comps + external AVM + matched-comp £/sqft:
  0.45 / 0.15 / 0.15 / 0.25
- Distance comps, no external, matched-comp £/sqft:
  0.50 / 0.20 / 0 / 0.30
- Distance comps, no external, no size: 0.70 / 0.30 / 0 / 0
- HMLR-only, no external, no size: 0.50 / 0.50 / 0 / 0

Because the hedonic pillar is derived from the CSA, the effective
CSA weight is 85–100% when there is no size or external signal.

### B9. Confidence and interval

- Take the more conservative of (a) the comps-path confidence and
  (b) a ceiling by comp count: 4+ → high, 2–3 → medium, 0–1 → low
  (founder rule: about four sales within half a mile).
- Interval half-widths are fixed constants: high ±3%, medium ±5%,
  low ±8%. They are labelled "80% CI" but are not estimated from
  data.

### B10. Trend projection

- Blended annual rate = 0.7 × HPI annual + 0.3 × annualised
  monthly, clamped to −8% … +15%.
- 12/24/36-month forecasts by compounding. Informational only.
  It does not change the offer. With HPI unavailable it is flat.

### B11. Risk scoring

- Five environmental factors scored 0–10 each with a discount
  fraction (e.g. flood zone 3b = 6%, knotweed on plot = 7.5%,
  active coal = 3%). Sum capped at 12%.
- Building: EPC A/B +1%, E −0.5%, F/G −2%; construction type
  discount up to 5% (mundic); build era pre-1919 −1%, 2001+ +0.5%.
- Composite 0–100 risk score stored on the result.
- Pre-RICS-survey flags for flood 3a/3b, knotweed within 20m,
  coal medium/high, non-standard construction, EPC F/G.
- Positive adjustments are never applied to the offer. Only
  negative lines become discounts.
- As per B2, only EPC and build era are ever non-default today.

### B12. The offer formula

Default config (founder-editable, versioned):
- Seller-type margin: probate 20%, chain break 20%, short lease
  15%, repossession 25%, relocation 20%, standard 22%.
- Investment-grade adjustment: A+ −3%, A 0, B 0, C +3%, D +5%.
  With yield unknown (always, in production) the grade is B.
- Minimum effective margin 10%. Floor 60% of AVM. Ceiling 88% of
  AVM. Total discount cap 40%. Offer valid 14 days.

Steps:
1. Effective margin = max(10%, seller margin + grade adjustment).
2. Base offer = AVM × (1 − effective margin).
3. Discount lines, each a fraction of AVM: the environmental
   factors, construction, EPC penalty (E/F/G), age penalty
   (pre-1945), and a lease curve (85y+ 0; 70–84y 3%; 60–69y 7%;
   50–59y 12%; 40–49y 20%; under 40y 30%).
4. Total discount capped at 40%.
5. Raw final = base offer − AVM × total discount.
6. Clamp to 60%–88% of AVM. If the raw figure fell below the 60%
   floor, the deal is flagged for CEO escalation.
7. Offer range = final × (1 ∓ confidence interval).

Worked defaults with no risk lines: standard seller → 78% of AVM;
probate → 80%; repossession → 75%; short lease at 65 years →
85% − 7% = 78%.

### B13. The deal model (ROI check, runs alongside)

- Gross development value = AVM × (1 + uplift), default uplift 0.
- As-is value = AVM × (1 − condition discount): turnkey 0, dated
  6%, tired 12%, unmodernised 18%, derelict 28%. Default "tired".
- Refurb = £ per m² by condition (fair £300, tired £550,
  distressed £850, derelict £1,300) × floor area (default 75 m² if
  unknown, flagged) + defect lines (no kitchen £8k, no bathroom
  £6k, roof £12k, damp £6k, structural £20k, fire £25k, etc.).
- Costs: SDLT 2025/26 bands + 5% additional-property surcharge;
  purchase legals £950–£3,000 + VAT; modern-auction fee £10,000
  where relevant; refurb contingency 0%; sale agent 1.5% of GDV;
  sale legals £1,500; finance 80% LTV at 10% a year rolled up,
  1% arrangement, 12 months.
- Cash ROI = profit ÷ (offer + all costs). Target 20%. Verdict
  pass / marginal (within 1 point) / fail. Financed ROI is
  reported as upside.
- A binary search finds the maximum offer that still clears the
  target ROI.
- Calibrated against three off-market golden deals only. The
  fixture itself warns these are not representative of on-market
  stock.

### B14. Deep appraisal (LLM report, daily 08:30)

- Candidates: scout leads created in the last 24 hours with a
  STRONG verdict or on the prime/block track (prime first), then
  auction lots within 14 days. Max 10 per run. Deduplicated.
- The LLM (Claude Sonnet, temperature 0.3) writes a structured
  report: 5–8 selected comps with a cleanest match and exclusions,
  after-repair value with 50% and 80% intervals, six
  environmental risks reasoned from postcode knowledge (not
  looked up), an auction bid-cap discount stack, a verdict (bid /
  walk / bid with caveats / investigate), a checklist and
  escalations.
- It receives HMLR price-paid (30 rows), HPI, EPC and the external
  AVM (hard-coded to "terraced" for every property). It does NOT
  receive the distance-weighted comps, the size pillar or the
  deterministic AVM. It re-derives value independently.
- Cost about £0.06 per appraisal. Silently skipped without an
  API key.
- A second, cheaper LLM call writes a surveyor-voice comp
  rationale paragraph for offer PDFs.

### B15. Orchestration (UTC)

- 07:15 pipeline-appraise: up to 10 deals in status new_lead /
  contacted / valuation with no valuation yet. Writes the
  valuation, market value, offer and margin to the deal. Verdict:
  THIN if escalated, STRONG if high confidence, else VIABLE.
  Creates a founder action: "ceo_escalation" (critical) if the
  raw offer fell under 60% of AVM, else "approve_offer" (medium).
  Deal status is not advanced by the cron. The founder moves it.
- 07:50 lead-appraise: up to 8 scout leads. Prime/block first
  (any verdict), then volume leads with STRONG or VIABLE. Pulls a
  property snapshot (8 PropertyData endpoints, ~22 credits per
  new postcode, reused 7 days), runs the AVM, runs a photo
  condition screen (vision LLM, up to 10 photos; skipped without
  an API key), estimates refurb, then re-scores the lead
  ("stage 2"): the ROI pillar (cap 40) is replaced by below-market
  bands (20%+ → 25 pts, 15–20% → 20, 10–15% → 14, 5–10% → 8) plus
  ROI bands (25%+ → 15, 20–25% → 12, 15–20% → 8, 10–15% → 4),
  damped by AVM confidence (high ×1, medium ×0.6, low ×0.3) and
  zeroed with no comps.
- 08:30 deep-appraisal as above.
- Manual: "Generate offer" on a deal, "Appraise" on a lead, an
  admin backfill that re-values every deal, and a spreadsheet
  batch appraiser.

### B16. What the founder sees

- Lead page: value, range, offer and % below market, confidence,
  comp count, floor area with EPC-verified label, £/sqft versus
  nearby sold £/sqft, assumed-type warning, review flag, HMO
  caveat, and an editable deal-model panel.
- Deal page: latest valuation and a feedback panel.
- Appraisals queue for deep-appraisal reports.
- Settings pages for the deal-model levers and a versioned offer
  policy.
- Action centre cards for approve-offer and CEO escalation.

### B17. The public "instant offer" path

- A seller (or an agent on their behalf) submits a form. A quote
  is generated with the same AVM plus preflight checks (EPC,
  tenure, market temperature). Market temperature adjusts ±2–4%,
  low EPC −1%, clamped ±5%.
- Short lease with no stated term assumes 65 years.
- The public path uses the DEFAULT offer config, not the
  founder-tuned versioned config.
- The offer is locked for 7 days (matches the public promise).
- No figure is shown on screen to the seller. A person reviews
  and sends the offer by email. The agent confirmation email does
  state the indicative figure.

### B18. Backtest and calibration status

- A scorer exists: MAPE, median APE, MAE, signed bias, interval
  coverage, by confidence segment.
- It pairs the AVM estimate with our own eventual resale price.
  That is only known when we complete and resell. There is no
  pairing against later Land Registry sold prices for properties
  we did not buy.
- No backtest results are recorded anywhere. The strategy doc
  targets median error ≤ 8% over 20 deals (brackets never
  filled). A code header claims ≤ 3.1%. Neither has been measured.

### B19. Weaknesses we already know about (do not just repeat these)

- Fixed +0.4%/month time adjustment regardless of the real market
  direction. In a flat or falling market it inflates every comp.
- Ungeocodable comps land in the near ring at distance 0.
- The hedonic pillar is the CSA relabelled, so the
  hedonic-vs-CSA spread used as a confidence signal is
  uninformative.
- Environmental risk inputs are never populated in production.
- Deep appraisal sends "terraced" to the external AVM for every
  property, and re-derives value without seeing the main AVM.
- The instant-offer path ignores the founder's versioned offer
  config.
- The golden deals are all off-market.
- No accuracy measurement exists. Confidence intervals are fixed
  constants.
- HPI feed unreliable; external floor-area unit unconfirmed;
  vision screen off in production without an API key.
## PART C — What we want from you

Answer all eight. Number your answers to match.

1. Is the two-pillar scoring model (acquisition motivation +
   ROI) the right shape for a direct-to-vendor cash buyer? Which
   factors and weights are unsupported by evidence? What is
   missing that the literature or practitioners rely on (for
   example tenure length, owner age, equity position, listing
   history, executor location)? Propose a revised factor table
   with weights and the evidence for each.

2. Sources. Given what we scan, rank the sources we are NOT
   using by expected lead yield per £ and per hour, for both
   tracks, in the UK in 2026. Include: commercial probate feeds
   (name them with prices), Land Registry bulk data joins,
   council tax empty-homes data, EPC register mining at scale,
   auction aggregators, and any licensed portal data. Say which
   of our live sources are not worth their cost.

3. The sourcing gate. Is a normalised score with a fixed
   threshold of 50 a sound way to decide which leads reach a
   human? What would a calibrated alternative look like given we
   have star ratings but few closed deals? How should valueless
   sources (probate notices, receiverships) be gated when there
   is no price to compare?

4. The AVM. Critique the blend: distance-weighted median comps
   (0.25 mi 60% / 0.5 mi 40%, 12 months, +0.4%/month), a
   derivative "hedonic" pillar, an external AVM, and a £/sqft
   size pillar with the weight table shown. Compare against how
   UK AVM providers (Hometrack, Rightmove AVM, PropertyData,
   Land Registry-based academic models) and RICS guidance handle
   time adjustment, comp selection, outliers, size, condition
   and confidence. What median absolute error should we expect
   from this design on UK terraced houses, and what would get it
   to under 8%?

5. The offer formula. We take 15–25% off market value by seller
   type, subtract risk lines, clamp to 60–88% of AVM, and
   separately require 20% cash ROI on a bottom-up deal model.
   Are these margins consistent with what UK cash buyers,
   auction buyers and refurb traders actually pay in 2024–2026?
   Cite achieved discounts by seller situation where data
   exists. Are the refurb £/m² bands, SDLT treatment, finance
   assumptions and 0% contingency realistic for London period
   houses?

6. Confidence and calibration. Our intervals are fixed constants
   (±3 / 5 / 8%) and we have no measured accuracy. Design the
   cheapest credible backtest we can run now using free Land
   Registry sold prices for properties we scouted but did not
   buy, and say what sample size and time window makes the
   result meaningful.

7. Prime thesis. Is "below its own street, with a condition
   reason" a sound and complete test for a refurb-arbitrage
   opportunity in zone 2–4 London? What are the false positives
   and false negatives it will produce? Is the £700k floor, the
   10% minimum discount and the 40% "not comparable" cut-off
   defensible?

8. Iteration plan. Given a single founder with limited
   engineering time, list the ten highest-value changes across
   scout and appraisal, ranked by expected impact ÷ effort, each
   with the one evidence line that justifies it and a way to
   measure whether it worked within 30 days.

## Rules

- UK data only. Use 2024–2026 figures. Date every number and
  flag anything older.
- Prefer primary sources: HM Land Registry, ONS, EPC open data,
  The Gazette, MHCLG, RICS, EIG auction results, Hometrack,
  Rightmove and Zoopla research, academic AVM papers.
- Separate measured data from opinion. Label estimates as
  estimates.
- If you cannot find evidence, say "not found". Never fill a gap
  with a plausible guess.
- Cite every factual claim with a link.
- Do not spend words re-describing our system back to us. Judge
  it.

## Output format

1. Executive summary — at most 10 bullets, each decision-ready.
2. Answers 1–8, numbered, with tables where they help.
3. "Change this first" — the 10 ranked changes from question 8.
4. "Stop doing this" — anything we do that costs more than it
   returns.
```

## Follow-up prompts (same thread)

**A — factor drill-down.** Run once per scoring factor you doubt:

```text
Take the [FACTOR] factor worth [N] points. What evidence exists
that this signal predicts a motivated seller or a below-market
sale in the UK? Give the studies, datasets or practitioner data,
the effect size where known, and the weight you would assign
relative to probate at 20. Same citation rules as before.
```

**B — AVM component drill-down.** Run once per pillar or step:

```text
Take [COMPONENT] of the AVM (for example the +0.4% per month time
adjustment, the 0.25/0.5 mile rings, the 60/40 blend, the fixed
confidence intervals). Show how the best UK AVMs and the
academic literature handle this step, the measured accuracy
impact of doing it their way versus ours, and the smallest
change that captures most of the gain.
```

**C — adversarial pass.** Always run this last:

```text
Now attack your own report. Which of your claims rest on a single
source, on vendor marketing, or on pre-2024 data? Re-verify the
10 claims we would lean on hardest if we changed the scorer or
the offer formula, and correct anything that does not hold.
```

## Where the results land

| Finding | Where it lands |
|:---|:---|
| Scoring weights (Q1, Q3) | Trial via `/leads/scorer-config` (a new EvalConfig version, no code change). Only edit `packages/scouting/src/scorer-config.ts` defaults after a measured run |
| New sources (Q2) | `docs/architecture/sourcing-channels.md` first. Trace the whole path (classifier, resolver, probe, cron) per the CLAUDE.md rule |
| AVM changes (Q4, Q6) | `packages/valuation/src/base-valuation.ts`, `distance-comps.ts`, `sqft-comps.ts`. Ship with golden tests. Run `scripts/avm-backtest.mts` before and after |
| Offer and deal-model numbers (Q5) | `/deals/offer-config` and `/settings/valuation` for the founder-editable parts; `offer-config.ts`, `deal-model.ts` for defaults |
| Prime thesis (Q7) | `packages/scouting/src/track.ts` constants (`PRIME_MIN_VALUE_PENCE`, `MIN_MEANINGFUL_DISCOUNT`, `PRIME_DISCOUNT_MIN_RATIO`), `docs/PRIME-SCOUT.md` § 7 |
| Iteration plan (Q8) | `docs/DECISION-STACK.md` roadmap; a What's New entry when each ships |
| The report itself | `docs/research/scout-appraisal-review-<yyyy>-<mm>.md` plus a README index row |

## Sources this prompt was derived from

- `packages/scouting/src/*` — `index.ts`, `scorer.ts`, `scorer-config.ts`,
  `track.ts`, `lead-type.ts`, `modernisation.ts`, `dealbreakers.ts`,
  `calibration-suggestions.ts`, `source-health.ts`, the source modules
- `packages/valuation/src/*` — `index.ts`, `base-valuation.ts`,
  `distance-comps.ts`, `sqft-comps.ts`, `risk-scoring.ts`,
  `offer-calculation.ts`, `offer-config.ts`, `deal-model.ts`, `refurb.ts`,
  `deep-appraisal.ts`, `backtest.ts`
- `packages/property-data/src/*`, `packages/instant-offer/src/index.ts`
- `apps/api/app/cron/{scouting,ch-stream,lead-appraise,pipeline-appraise,deep-appraisal}/route.ts`, `apps/api/vercel.json`
- `docs/PRIME-SCOUT.md`, `docs/SOURCING-PLAYBOOK.md`,
  `docs/scouting-roadmap.md`, `docs/architecture/sourcing-channels.md`,
  `docs/DECISION-STACK.md`, `docs/LEARNINGS.md`,
  `docs/research/prime-sourcing-deep-research-2026-08.md`
