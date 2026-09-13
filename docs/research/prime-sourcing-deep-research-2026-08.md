# Prime sourcing — deep-research report (Aug 2026)

_Filed 2026-08-29. Output of the Perplexity Deep Research run driven by
`prime-sourcing-deep-research-prompt-2026-08.md`. Provenance: external
research engine, not our own analysis — **verify any claim against its
source before acting on it** (repo rule: never brief anyone from a doc
alone)._

_Known defect: the citation export is imperfect — footnote numbers in the
body do not reliably match the numbered reference list at the bottom.
Treat the links as a bibliography, not a lookup table._

**The three findings that matter most:**

1. **The £/sqft unmodernised-vs-refurbished ranking we asked for does not
   exist as a published dataset** for zone 2–4. It must be built in-house
   from free primary data (Land Registry Price Paid + EPC register +
   portal photo archives). This is the report's #1 recommended action.
2. **Probate is the only seller situation with a quantified discount**
   (10–25% below market; 85–90% of asking commonly accepted). Every other
   circumstance — receivership, divorce, relocation, landlord exit — has
   no reliable public discount figure. The report says "not found" rather
   than guessing, as instructed.
3. **The super-prime exclusion is supported by the evidence** (prime
   London -7.5–9% in Q2 2026, steepest since 2009; transactions -11.5%
   in July 2026) — with the nuance that the £2M–£2.8M unmodernised
   fringe adjacent to our patch is softer and more negotiable than two
   years ago.

---

## Executive Summary

- Bank Rate held at 3.75% since December 2025 (30 July 2026 vote, 6-3); average 5-year fix ~4.5–4.8% as of August 2026 — an owner-occupier exit market that is stable but not cheap, and mortgage costs are the single biggest swing factor for your £1M+ exit buyer.
- Corporate/company buyers pay a flat 15% SDLT on residential purchases above £500k under Schedule 4A FA2003 unless a property-development-trade relief applies — get this structured correctly or a £1.2M house costs £180k in SDLT alone.
- Full-refurbishment build costs for London period houses in 2026 sit at roughly £200–£350/sqft mid-level and £350–£550/sqft full/structural, with loft+rear extension work pushing to £185–£355/sqft on its own; treat anything below £150/sqft as cosmetic only.
- Bridging finance in August 2026 prices from ~0.55%/month (sub-60% LTV, clean exit) up to 1.5%/month for complex cases — roughly 6.6%–18% annualised — so a 9-month hold at typical 0.75–0.95%/month materially erodes thin margins.
- National auction volumes hit record highs in 2025 (41,628 lots offered, 28,975 sold, £5.9bn raised, +7.1% YoY) with London auction supply up 25.9% and funds raised up to £400.2m in Q4 2025 alone — this channel is getting more competitive, not less.
- Prime London (mostly outside your buy-box) fell 7.5%–9% annually in Q2 2026, the sharpest drop since 2009 — a demand-side warning that softening exit prices could compress your £1M+ owner-occupier segment too, even though it's not "prime" in the postcode sense.
- Probate/estate sales typically transact at 10–25% below open-market value, with 85–90% of asking commonly accepted by executors seeking speed over maximum price — this remains your highest-yield, most legally clean distress category.
- EPC minimum-standard reform (proposed band C by 1 October 2030) is still not law as of August 2026 and requires primary legislation not yet laid — landlord EPC-driven disposals are a real but not yet urgent forced-seller trigger; don't over-weight it in your 2026 sourcing model.
- Article 4 and conservation-area coverage is extremely uneven by borough: Kensington & Chelsea, Westminster and Camden are near 100% Article 4 coverage with 74–77% conservation-area coverage, while Southwark, Lambeth, Haringey and Ealing have low-to-moderate coverage despite large raw direction counts — this materially changes refurb/extension risk across your hunting list.
- No public dataset was found tracking bridging-loan defaults or forced sales resulting from them; this gap is real, not a research failure — see Q3 for the closest available proxies.

## 1. Where is the refurb arbitrage widest?

Council-level and postcode-level £/sqft comparisons between unmodernised and refurbished period-house sales are not centrally published by any single free source; LonRes, Land Registry Price Paid Data and EPC data allow this to be built but require bespoke matching (street-level pairs of similar houses sold in different condition states), which was outside the scope of the web sources retrieved here. What is available: LonRes only covers Prime Central/Inner Prime catchments (roughly zones 1–2, mostly your excluded super-prime postcodes), where average 2025 achieved £/sqft ranged from £2,445 (Mayfair & St James's) down through Knightsbridge & Belgravia £1,835, Marylebone £1,633, South Kensington £1,535, and Chelsea £1,447. None of your zone 2–4 target postcodes (SW4, SW11, N16, E8 etc.) appear in LonRes's PCL/Inner Prime coverage, meaning **no primary sold-£/sqft renovation-premium dataset was found for your actual target districts** — this is a genuine gap, not an oversight.

**What this means for your list**: your hunting list cannot currently be evidence-ranked using the exact £/sqft-uplift methodology you asked for, because the only regularly-published prime £/sqft series (LonRes) doesn't cover zones 2–4 at street level, and HM Land Registry Price Paid Data (the correct primary source) requires you to run your own condition-matched pair analysis on the raw CSV/API rather than relying on a published report. Land Registry's Price Paid Data is free, monthly, geocoded to individual addresses since 1995, and is the correct tool to build this yourself — cross-referencing against EPC register bands (as a condition proxy) and Rightmove/Zoopla sold-price-with-photos archives (to visually confirm unmodernised vs refurbished state) is the only defensible way to produce the ranking you want. Not found: any third-party report that has already done this work for SW4/SW11/N16/E8-type zone 2–4 postcodes.

**Recommendation on methodology, not a substitute ranking**: commission a Land Registry Price Paid Data pull (freely available, monthly refresh) filtered to your 34 postcode districts, join to EPC register bands (unmodernised proxy = EPC F/G or pre-2000 assessment/expired certificate) and to Rightmove/Zoopla sold-price photo archives for condition confirmation, then compute median £/sqft by condition band per postcode district over a 24-month rolling window. This is buildable in-house from public data; no paid dataset is required.

**On excluding super-prime (W8, W11, SW3, SW7, NW3, NW8)**: the evidence supports your exclusion. Prime London values fell 7.5%–9.0% annually in Q2 2026, the steepest fall since 2009, transactions in prime London fell 11.5% in July 2026, and these markets sit almost entirely above your £2M entry ceiling with per-sqft build costs for listed/heritage refurbishment reaching £550–£900+/sqft against a shrinking, price-falling buyer pool — a worse risk-adjusted setup than your current zone 2–4 targets, not a missed subsegment.

## 2. Which seller situations produce below-market prime sales?

| Seller situation | Typical discount to open-market value | Observable pre-marketing? | Where |
|---|---|---|---|
| Probate/deceased estate | 10–25% below market; 85–90% of asking commonly accepted | Yes — Grants of Probate/Letters of Administration published in The Gazette and via the Probate Search service | The Gazette, HMCTS probate search |
| Repossession/mortgagee-in-possession | Not found (no current quantified UK-wide % for 2024–2026) | Partially — Land Registry charge/repossession data lags; specific discount data not found | — |
| Receivership (LPA receiver) | Not found (no quantified % found in current sources) | Yes in principle — Companies House charges register shows appointment of receivers/administrators, which your existing machinery already matches | Companies House |
| Divorce/forced sale | Not found | No reliable public pre-marketing signal found | — |
| Emigration/relocation | Not found | No | — |
| Downsizing after long tenure | Not found | No | — |
| Landlord exit (EPC/leasehold reform driven) | Not found as a quantified discount; driver is real but current EPC-C rule is still proposal-stage, not law, as of August 2026 | Partially — EPC register shows current ratings publicly, band F/G lettable-status flags a future forced-improvement or forced-sale candidate | EPC open data register |
| Unmortgageable condition (structural, no kitchen/bathroom, cash-only) | Not found as an aggregate %, but structurally this is definitionally your buy-box (cash removes the constraint) | Observable via portal "cash buyers only" flags — which you already scan | Portals |

Probate is the only seller-circumstance category with a robust, current, quantified discount figure in the sources retrieved (10–25% below market, 85–90% of asking). For repossession, receivership, divorce, relocation, downsizing and landlord-exit categories, no reliable, dated, UK-wide 2024–2026 discount percentage was found in primary or reputable secondary sources — this should be stated plainly rather than estimated. The Gazette publishes probate grants and is a genuine pre-marketing signal window (probate typically takes weeks to a few months to complete before a property is marketed, giving a lead-time advantage), consistent with your stated existing use of Gazette probate notices.

## 3. Which sourcing channels are underfished?

| Channel | How deals surface | Lead time before open marketing | Access route | Volume evidence | Effort-to-yield |
|---|---|---|---|---|---|
| Auction houses beyond Auction House UK/Allsop (Savills, Strettons, Barnard Marcus, Clive Emson, McHugh, First For Auctions) | Public catalogues, same as your existing tools | Weeks (catalogue publication to sale date) | Register and bid; relationship with individual auctioneers for pre-auction "best and final" offers | National 2025: 41,628 lots offered, 28,975 sold, £5.9bn raised (+7.1% YoY); London lots offered +25.9% in Q4 2025, funds raised £400.2m | Medium — high volume but now highly competitive; London auction supply growth outpacing most regions |
| LPA receiver panels | Receivers instructed by lenders on defaulted commercial-mortgaged residential stock; panel-based, relationship-driven, not open-listed until receiver decides to market | Receivers often seek quick, confidential disposal before full marketing | Building relationships with receivership firms and their approved-buyer panels (not itemised in sources found) | Not found — no public volume data on receiver-panel-sourced residential deals | Not found — cannot rate without volume evidence |
| Probate/private-client solicitors | Solicitors administering estates sometimes seek a quick cash sale directly, bypassing the open market entirely, especially for beneficiaries who live abroad or want fast closure | Before Grant of Probate is even used to market — solicitors can pre-negotiate sale to complete on grant | Direct relationship-building with private-client/probate solicitors and referral fee arrangements | Confirmed as a real route via Gazette-linked probate data your machinery already exploits; no separate solicitor-direct volume figure found | Medium-high — relationship-dependent but low competition once established |
| Empty-homes officers at London boroughs | Council empty-homes teams identify long-term-vacant properties and sometimes broker or encourage sale to bring stock back into use | Long lead time (months to years of vacancy before council intervention) | Direct borough contact / FOI requests for empty-homes registers | Not found — no current London-specific volume/count data retrieved | Not found — plausible but unquantified |
| Deceased-estate clearance firms | House-clearance companies are frequently the first non-family party inside a probate property and often know the estate is about to sell before any agent is instructed | Very early — pre-marketing | Direct relationships/referral fees with clearance firms | Not found — no volume data | Potentially high yield, low competition, but unquantified — worth a pilot given near-zero cost of establishing relationships |
| Retirement/care-transition advisers | Advisers helping elderly clients into care sometimes need a fast house sale to fund care fees | Early, pre-marketing | Direct relationships with care-transition/downsizing advisers, financial advisers specialising in later-life planning | Not found | Not found — unquantified but logically early-signal |
| Expired/withdrawn listing data | Properties that failed to sell and came off-market are a known reduced-competition re-approach opportunity | Immediate once listing expires | Portal scraping of "withdrawn" status (already technically within your "reduced/slow-to-sell" scanning per your brief) | Not separately quantified in sources found | Already partially covered by your existing machinery per your brief |
| Landlord exits (EPC/leasehold reform) | Landlords facing future EPC-C costs or leasehold/commonhold reform uncertainty may sell rather than upgrade | Medium — depends on landlord's own timeline; EPC-C rule still not law as of August 2026, dampening urgency now | EPC public register (band F/G, or D/E facing upgrade cost) filtered to landlord-registered addresses (not always identifiable), or direct approach via portfolio landlord associations | Government estimates ~£6,100–£8,000 typical upgrade cost per property once rules are law; current urgency is limited because legislation is not yet passed | Medium now, likely rising toward 2028–2030 as legislation firms up |
| Bridging-loan defaults | Your team previously found no public data on this — confirmed here: no public dataset, register or reporting mechanism tracking bridging-loan defaults or resulting forced sales was found in any source retrieved | Not found | Not found — likely only accessible via relationships with bridging lenders/receivers, not public data | Not found | Not found — genuinely opaque; the earlier "no data" finding is correct, not a research gap on your part |

The clearest evidenced conclusion: auction supply (all six additional auction houses named) is a large, growing, but increasingly crowded channel, given the 25.9% London supply growth in Q4 2025. The genuinely underfished channels — deceased-estate clearance firms, probate/private-client solicitors for direct pre-market approaches, retirement/care-transition advisers — appear well-supported logically and partially by the probate discount data, but no volume or conversion-rate data exists publicly for any of them; this should be flagged as a real evidence gap, not filled with estimates.

## 4. What numbers define a best deal in 2026?

| Metric | Figure | Date |
|---|---|---|
| Cosmetic refurb | £120–£200/sqft (London-adjusted) | 2026 |
| Full refurb (re-servicing, kitchens/bathrooms, no extension) | £200–£350/sqft standard; £223–£279/sqft per one detailed London breakdown | 2026 |
| Full refurb + loft + rear extension | £185–£355/sqft for extension work alone; combined project often £300–£550/sqft blended | 2025–2026 |
| High-end/listed period refurbishment | £550–£900+/sqft | 2026 |
| Corporate SDLT on £700k–£2M purchase (no relief) | Flat 15% (e.g., £1M purchase = £150,000; £2M = £300,000) | Schedule 4A FA2003, verified July 2026 |
| Corporate SDLT with property-development-trade relief | Standard banded SDLT + 5% additional-dwellings surcharge (much lower); 3-year clawback if development doesn't proceed | 2026 |
| Bridging finance, sub-60% LTV, clean exit | 0.55%–0.75%/month (≈6.6%–9.0% annualised) | August 2026 |
| Bridging finance, 60–70% LTV mainstream | 0.75%–0.95%/month (≈9.0%–11.4% annualised) | August 2026 |
| 6-month bridge on £1M drawn, ~0.75%/month, 2% arrangement fee | ≈£45,000 interest + £20,000 fee ≈ £65,000 (estimate, calculated from published rate bands, not a quoted figure) | Estimate |
| Days on market, London, refurbished family houses | Not found segmented by refurbished-vs-not; London overall average 71 days (September 2025) | Rightmove HPI, September 2025 |
| Probate/distress-sale discount to market | 10–25% below market value | 2026 |
| Bank of England base rate | 3.75% (held 30 July 2026, 6-3 vote) | 30 July 2026 |
| Average 5-year fixed mortgage rate | ~4.5–4.8% | August 2026 |

Not found: a single authoritative, dated 2024–2026 figure for "typical percentage uplift from unmodernised to refurbished" sale price specific to London period houses — this requires the bespoke Land Registry/EPC matching described in Q1, since no report in the sources retrieved publishes this uplift percentage directly. Total buying-and-selling transaction cost stack for a company (SDLT + legal + agency + refurb finance + selling agency fee + CGT/corporation tax on profit) was not found bundled into a single published "total cost" figure; each component above is sourced individually and should be modelled bespoke per deal.

## 5. What could kill this strategy in the next 24 months?

Ranked by likelihood × impact, based on available evidence:

1. **Mortgage-rate path staying elevated, compressing your £1M+ exit buyer pool.** Base rate held at 3.75% since December 2025, with a 6-3 MPC vote in July 2026 showing rising internal pressure toward a hike rather than a cut, and average 5-year fixes around 4.5–4.8%. Forecasts are split — some see cuts resuming in 2027, others see a hike to 4.0–4.25% first — meaning genuine two-way uncertainty over your exit buyers' affordability for the next 12–18 months. High likelihood, high impact.
2. **Prime London price falls spilling into your segment via buyer sentiment.** Prime London recorded its steepest annual fall since 2009 in Q2 2026 (down 7.5%, PCL down 9.0%) and transactions fell 11.5% in July 2026 — while technically outside your postcode range, this signals broad softening in London family-house sentiment that could compress your exit margins if it spreads to zone 2–4. Medium-high likelihood, medium-high impact.
3. **Refurb cost and labour inflation.** 2026 benchmark ranges already span wide bands (£120–£550+/sqft depending on scope), and multiple sources note costs move with contractor demand and specification — a genuine margin risk if construction inflation resumes, though no acute 2024–2026 spike was found in the sources retrieved. Medium likelihood, high impact given thin per-deal margins.
4. **Article 4/conservation-area expansion restricting refurb/extension scope.** Coverage is already very high in several of your target-adjacent boroughs (Camden 100% Article 4, Southwark 371 directions though lower % coverage, Waltham Forest 807 directions) — expansion of these controls, particularly around permitted-development removal for extensions, directly threatens the loft/rear-extension upside tier of your refurb margin. Medium likelihood, medium-high impact, borough-specific.
5. **EPC/leasehold reform side-effects on saleability and cost.** The proposed EPC-C-by-2030 standard is not yet law and requires primary legislation not yet laid as of August 2026 — near-term risk is low, but if legislated, it could both increase the supply of distressed landlord-exit stock (an opportunity) and increase your own refurb-to-let-standard costs if any exit route shifts. Low-medium likelihood in the 24-month window, low-medium impact.
6. **Building Safety Act scope.** Not found — no evidence was retrieved indicating the Building Safety Act's scope extends materially to single, standard-height Victorian/Edwardian houses (its core scope is higher-risk buildings, generally 18m+/7+ storeys); treat this as a low risk for your asset class absent contrary evidence, but flagged as "not found" rather than fully cleared.
7. **Auction market crowding raising acquisition prices.** Record 2025 auction volumes and rising London-specific activity suggest more competition for auction-sourced stock, which could compress the discount available through that specific channel even as overall stock grows. Medium likelihood, low-medium impact given auctions are one channel among several.

## 6. Who else runs this play, and how do they source?

Evidence on specific named competitor firms operating the "buy unmodernised London period house 700k–2M, refurbish, sell to owner-occupier" model at scale was not found in the sources retrieved — this space is largely populated by small private trading companies, family offices and sole-operator developers who do not publish sourcing methodology or acquisition-to-market-value ratios. What is evidenced: the broader "quick house sale"/cash-buyer sector is large enough to be indexed by aggregator sites (e.g., probate-focused property listing platforms explicitly designed to match buyers to probate stock), indicating organised competition specifically for probate deal flow already exists at a national level. Auction-house competition is quantifiably intensifying (record 2025 volumes, London supply +25.9% in Q4), which is consistent with more cash buyers — including firms like yours — using auctions as a primary channel, thereby crowding it. Not found: named comparable-scale competitors, their typical purchase price relative to open-market value, or which specific sourcing routes they neglect. This should be treated as a genuine information gap requiring primary research (e.g., Companies House SIC-code screening for "buying and selling of own real estate" firms registered in London with relevant filing histories, or direct industry-network intelligence) rather than filled with unverified claims.

## Act on this next

1. Build your own Land Registry Price Paid Data + EPC-register matched-pairs model for all 34 target postcodes — the £/sqft uplift ranking you asked for does not exist as a published report and must be constructed in-house from free primary data.
2. Treat probate/private-client solicitors and deceased-estate clearance firms as priority relationship-building targets — probate is the only seller-circumstance with a robust, dated discount figure (10–25%, 85–90% of asking accepted), and clearance firms are plausibly the earliest-possible signal, though unquantified.
3. Confirm SDLT structuring (property-development-trade relief under Schedule 4A) with a specialist tax adviser before your next acquisition — the difference between 15% flat and standard-banded-plus-surcharge SDLT is worth up to ~£100k+ per £1M deal.
4. Lock bridging facilities at sub-60% LTV where possible — the rate differential between 0.55–0.75%/month and 0.95–1.5%/month is large enough to meaningfully move deal economics over a 6–12 month hold.
5. Map Article 4/conservation-area coverage borough-by-borough before underwriting any deal with planned loft/rear-extension upside — Camden, Kensington & Chelsea, Westminster, Barnet, Enfield and Waltham Forest carry near-total or very high coverage that could remove your extension margin entirely.
6. Pilot direct outreach to retirement/care-transition advisers and empty-homes officers at 2–3 boroughs — both are logically early-signal channels for future distressed stock but currently have zero public volume data, meaning low competition if genuine.
7. Stress-test your exit-buyer affordability model against both the "base rate holds/rises to 4.25%" and "cuts resume in 2027" scenarios — current forecasts genuinely diverge, and your £1M+ exit price point is sensitive to 5-year fixed rates currently at 4.5–4.8%.
8. Do not increase weighting toward EPC/landlord-exit sourcing yet — the EPC-C 2030 standard remains unlegislated as of August 2026, so urgency-driven landlord disposals are not yet at scale.
9. Accept and document that bridging-loan-default sourcing has no public data trail — pursue it only via direct lender/receiver relationships, not data mining, and don't allocate scanning resource to a channel with no observable signal.
10. Commission a targeted Companies House SIC-code screen (real-estate buying/selling firms, London-registered, filing patterns consistent with buy-refurb-sell) to identify actual competitors, since none were identifiable from public web sources — this is a data-gathering task distinct from general web research.

---

## Sources

The run's exported reference list (link rot and mis-numbering possible —
re-verify before quoting): HM Land Registry Price Paid Data
(gov.uk / landregistry.data.gov.uk), London refurbishment cost guides
(LM Property Sourcing, Tenen, Allwell, Kapeti, Renoquote, B-VDS,
Nu Projects, Knight Frank landlord refurb guide), bridging-rate
comparisons (FD Commercial, Doulton, Capitalise, HomeOwners Alliance,
Finder, Clifton PF, KIS, ABC Finance, Spark), stampdutyrate.com
(companies/SPVs), propaideals.co.uk (probate listings), Rightmove HPI,
UK HPI.
