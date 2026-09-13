# Scout and appraisal review — deep-research report (Sep 2026)

_Filed 2026-09-12. Output of the Perplexity Deep Research run driven by
`scout-appraisal-review-prompt-2026-09.md`. Provenance: external research
engine, not our own analysis — **verify any claim against its source before
acting on it** (repo rule: never brief anyone from a doc alone). Refurb-cost,
cash-offer-range and AVM-accuracy figures come from vendor or industry pages
and are benchmarks to test, not facts to encode._

_Cross-check against the code (same day): the SDLT "check" in § 5 is already
satisfied (marginal bands plus a 5% whole-price surcharge give the 5/7/10/15/17
schedule it names). The refurb bands it calls light (£300–£1,300/m²) were
also called light by the Aug 2026 prime research (£200–£350/sqft ≈
£2,150–£3,770/m² for a full refurb). The distance-0 treatment of ungeocoded
comps, the fixed +0.4%/month uplift, the derivative hedonic pillar and the
fixed intervals are all as described._

---

# Scout and Appraisal Review — UK Residential Property, September 2026

## Executive summary

- **Keep two dimensions, but stop adding them into one pseudo-probability.** Motivation and deal economics are both necessary, yet a high score in one must not compensate for failure in the other. Use hard eligibility gates, then rank by expected commercial value per founder minute.
- **Replace the fixed score threshold with capacity-based ranking and controlled exploration.** Select the best leads independently within volume, prime and no-price queues; reserve 10–15% of review capacity for uncertain or randomly selected leads so the system can learn rather than merely confirm its existing weights.
- **Treat no-price leads as an enrichment queue, not failed priced leads.** Probate, receivership and charge events should pass a separate gate based on event recency, property linkage, likely equity, contact route, geography and expected value of obtaining a valuation.
- **The current AVM is not credible enough to set an offer without human comp review.** The fixed positive time adjustment, zero-distance treatment for ungeocoded comps, duplicated “hedonic” pillar and uncalibrated intervals are more consequential than blend-weight fine-tuning.
- **A sub-8% median absolute percentage error is possible only after identity, size, time and condition are improved.** A reasonable pre-test expectation for the current method on ordinary terraced stock is roughly 10–14% MdAPE; this is an estimate, not a measured result. Period, extended and unmodernised London houses will be worse.
- **Do not discount market value by seller category.** Probate or chain break may affect the seller’s reservation price, but not the property’s market value. Compute the maximum economically supportable offer from resale value, works, transaction costs, finance, time and risk; use seller circumstances only to guide negotiation and prioritisation.
- **The London refurbishment budget is materially light.** The current £550–£1,300/m² bands may cover limited work but do not safely represent a full period-house refurbishment. Published 2025–26 London guides vary widely, with basic remodelling around £1,400–£1,750/m² and deeper or higher-spec work materially above that.[^1][^2][^3]
- **Build the backtest before adding more AVM sophistication.** Freeze every appraisal at decision time, match it prospectively to monthly Land Registry completions and report MdAPE, signed bias, PE10/PE20 and interval coverage by track, property type, confidence and price band.
- **The prime thesis is a useful discovery heuristic, not an investment test.** “Below its street with a condition reason” should generate a candidate; the decision should depend on a matched post-refurbishment GDV, verified area, planning/extension potential, full cost-to-exit and downside scenarios.
- **The first 30 days should focus on five corrections:** repair comp geography, replace the time adjustment with official HPI movement, remove the derivative pillar, create a frozen backtest cohort and make one residual deal model the source of the offer.

## 1. Scoring model

### Judgment

The two concepts are directionally right but the additive implementation is not. Acquisition motivation estimates the probability and timing of engagement; ROI estimates the value conditional on acquisition. Adding capped points assumes arbitrary exchange rates—for example, that weak economics can be rescued by strong distress—which is commercially unsafe.

The evidence base supports recent, relevant and property-specific information rather than generic area averages. RICS says comparable evidence should be comprehensive, similar, recent, arm’s-length and verifiable, and that legal interest, condition, area and transaction date are material comparison attributes.[^4][^5] Current UK arrears data also warns against over-weighting mortgage distress nationally: homeowner possessions remain low by historic standards, even though they continue to produce a real flow of cases.[^6][^7]

### Revised architecture

Use three stages:

1. **Eligibility gates:** residential target, geography, price/lot-size envelope, no fatal legal or physical issue, and enough identity data to investigate.
2. **Separate predictions:** acquisition likelihood and economic attractiveness, each retained as its own calibrated score.
3. **Priority:** estimated contribution per scarce unit of founder effort, with a penalty for data and execution uncertainty.

A useful target metric is:

`priority = P(contact) × P(view | contact) × P(acceptable offer | view) × expected cash profit ÷ founder minutes`

This does not require accurate probabilities on day one. Start with monotonic bands, preserve every component, and calibrate them as outcomes accumulate.

### Proposed factor table

The table is a **starting policy for testing**, not a claim that published UK evidence proves exact point values. Where direct causal UK evidence was not found, the signal is explicitly labelled as a prior to validate.

| Factor | Weight | Applied to | Evidence status and rationale |
|---|---:|---|---|
| Verified forced-sale or administration event | 15 | Acquisition | Repossession, appointed receiver or active insolvency is stronger than descriptive listing language, but the national pool is limited; Q1 2026 recorded 1,250 homeowner and 810 BTL possessions.[^7] |
| Probate grant and administration stage | 10 | Acquisition | Probate creates a sale-capable estate but does not imply a wish to sell. 2025 applications were numerous and grants commonly took about five weeks, so event recency and stage matter more than a flat “probate = 20” rule.[^8][^9] |
| Listing friction and price history | 12 | Acquisition | Long marketing time, repeated reductions, fall-through and cash-only status are observable revealed signals. Do not double-count the source label, discount and days-on-market. |
| Contactable decision-maker | 8 | Acquisition | A named executor, receiver, owner or instructed solicitor materially changes actionability. Direct effect-size evidence was not found; validate through contact and appointment conversion. |
| Property-event linkage confidence | 10 | Acquisition | A charge at a registered office is not a property lead. Reward UPRN/address-level linkage and penalise inferred postcodes. |
| Timing/urgency | 5 | Acquisition | Use event age, auction date, lease milestone and explicit completion requirement. Direct effect-size evidence was not found. |
| Discount to matched as-is value | 18 | Economics | Use the current asking price—not the original asking price—against a confidence-adjusted as-is valuation. A 10% apparent discount is not decisive when AVM uncertainty can be similar. |
| Value-add spread | 12 | Economics | Post-refurb GDV less as-is value, works and all costs; condition alone is not value creation. |
| Exit liquidity | 8 | Economics | Measure recent matched transaction count, typical marketing time and buyer pool. RICS prioritises several recent, similar transactions rather than one aggregate.[^4][^10] |
| Legal/tenure/financeability | 8 | Economics | Remaining lease, title, construction and mortgageability affect both price and exit. RICS expressly includes legal interest and lease terms in comparable analysis.[^5] |
| Data confidence | 7 | Both | Identity, verified floor area, comp quality, condition evidence and model coverage; never let uncertainty add points. |
| Execution complexity | -10 to 0 | Priority | Planning, occupied possession, structural uncertainty, title defects and specialist construction consume founder time and widen downside. |

### Factors to remove or demote

- **Generic seller-type points:** probate, relocation and chain break are not exchangeable motivation units. Use observable event stage and behaviour.
- **Postcode-dominant EPC:** it describes neighbours, not the subject; it should not alter subject risk or value.
- **Unknown market trend = five points:** missing data should be neutral and should reduce confidence, not improve rank.
- **Solicitor identified as four points:** actionability belongs in contactability, not intrinsic motivation.
- **Plain days-on-market plus “slow-to-sell” plus reductions:** these are correlated manifestations of the same listing history.
- **Unmeasured age/equity assumptions:** long ownership can be an enrichment target, but do not infer equity without title and charge evidence.

## 2. Source strategy

### Ranked additions

The ranking below is an **operating estimate** for a solo founder. “Yield” means plausible reviewed opportunities rather than raw records; actual economics must be measured through a source-level funnel.

| Rank | Source | Volume track | Prime track | Expected £/hour value | Recommendation |
|---:|---|---|---|---|---|
| 1 | Licensed portal feed with listing history, reductions and fall-throughs | Very high | Very high | Highest | Consolidate on a contractually licensed feed and preserve complete listing history. Rightmove’s own valuation service demonstrates the value of listing, demand and historic marketing data alongside sold prices.[^11][^12] |
| 2 | HMLR Price Paid + EPC + UPRN/property graph | High as enrichment; medium as discovery | Very high | Very high | Build once. HMLR supplies monthly bulk files back to 1995, while EPC bulk data and an API are available for product development.[^13][^14][^15] |
| 3 | National auction aggregator with results and unsold/post-auction status | High | High | High | Replace three-house scraping with one broad feed. EIG reports virtually all UK auctions and a large historical lot database; 2026 monthly volumes are material.[^16][^17][^18] |
| 4 | Commercial probate/grant feed | Medium | Medium-high | Medium-high if contact route exists | Run a paid pilot, not a long contract. Published UK options found include 9amLeads from £25/week and FormationData from £39.99/month plus VAT; neither published page proves motivated-property conversion.[^19][^20] |
| 5 | Land Registry title/charge and long-ownership enrichment | Medium | High | Medium-high | Use only on shortlisted addresses. Price Paid is free; ownership and charge information may require licensed/title products. No verified bulk title price suitable for this report was found. |
| 6 | EPC mining at scale | Medium | High | Medium | Mine stale certificates, F/G, age, area and building form, then join to listing and HMLR events. EPC is a condition/identity signal, not a motivation event.[^15][^21] |
| 7 | Council empty-homes partnerships/FOI | Medium where addresses are released | Low-medium | Variable | Target councils with active empty-home teams. National statistics show 303,185 English dwellings empty over six months in 2025, but published national/local-authority aggregates do not themselves provide contactable addresses.[^22] |
| 8 | Receiver/LPA and secured-charge intelligence with property-level linkage | Medium | Medium | Medium | Keep only when the charged asset is resolved to a subject address; otherwise it is company intelligence, not a lead. |
| 9 | Planning/HMO/dissolved-company events | Low-medium | Medium | Low-medium | Useful as enrichment or tightly defined campaigns; not worth permanent “coded but skipped” complexity. |
| 10 | Broad demographic mining, including owner age proxies | Low | Low | Low | Avoid unless lawful, accurate and directly linked to a tested campaign. Aggregate age is not owner age. |

### Paid-source decisions

The present portal-derived feed is worth retaining only if it produces incremental appointments or deals after duplication with auctions and ordinary portal browsing. Instrument `raw leads → qualified → contacted → response → viewing → offer → accepted → completion → realised profit` and calculate source cost per stage.

A commercial probate pilot should be capped at one or two districts for 30 days. Probate records indicate estate administration, not sale intent; even a supplier’s own description cautions that a probate record does not mean a property is for sale.[^19] No credible 2024–26 public evidence was found for UK probate-property conversion rates or achieved discounts, so any promised lead yield should be treated as vendor marketing.

Council empty-home data is attractive in theory but difficult operationally because the useful unit is an address with a lawful route to an owner, whereas official publications are aggregates. EPC and HMLR joins are the stronger engineering investment: a public linked price-per-square-metre dataset already demonstrates that more than 22 million transactions can be joined to EPC attributes, including UPRNs in recent data.[^21]

### Sources to reduce

- Pause repeated paid postcode calls that produce a plain ten-sale mean; bulk HMLR data is free and updated monthly.[^13][^23]
- Stop carrying dark source adapters in the operational health denominator.
- Deprioritise brownfield and HMO flows for the stated house-buying strategy unless a distinct development thesis is approved.
- Keep Companies House streaming as low-cost intelligence, but do not push unlinked registered offices through the residential lead scorer.

## 3. Sourcing gate

### Judgment

A fixed threshold of 50 is not sound because the scale is not calibrated to a probability, value or capacity constraint. It also produces discontinuity: a one-point config change can move a lead from invisible to reviewed, while the threshold means different things for priced, unpriced and prime leads.

Use **top-K ranking by queue**, subject to minimum safety gates:

| Queue | Rank by | Daily/weekly capacity | Exploration |
|---|---|---:|---:|
| Volume priced | Expected profit × acquisition propensity × confidence ÷ effort | Founder-defined | 10% |
| Prime priced | Risk-adjusted residual profit and exit liquidity | Founder-defined | 10% |
| No-price/event | Expected value of information from the next enrichment step | Separate small budget | 15–20% |
| Block/development | Distinct investment policy | Normally zero | None unless strategy enabled |

With star ratings but few deals, fit an ordinal model or even a monotonic points table to predict `reviewed positively`, while recognising that stars reflect taste rather than realised value. Use pairwise ranking—“which of these two deserved the call?”—because it is easier to label consistently. Add negative operational outcomes such as wrong property, no contact route, no response and duplicate; these provide faster learning than waiting for completions.

### No-price leads

A no-price lead should pass if the **expected value of obtaining price/ownership data exceeds its enrichment cost**. Score event authenticity, address/UPRN match, location, likely property type/value from HMLR/EPC, contact route and event freshness; then buy or compute only the next missing fact.

Do not require an unpriced stream lead to hit a scale designed around ROI points. The present design structurally suppresses such leads and therefore cannot learn whether they work. Probate throughput is large enough to require selective enrichment—more than 60,000 applications were recorded in each of several 2025 quarters—but that is a universe size, not evidence of property-sale intent.[^8][^9][^24]

## 4. AVM review

### Component decisions

| Component | Judgment | Smallest useful change |
|---|---|---|
| 0.25/0.5-mile rings | Reasonable retrieval bounds for dense urban stock, but crude as fixed weights | Rank each comp by continuous similarity in distance, floor area, type, age, tenure and date; let evidence quality determine weight. |
| 60/40 near/far median | Unsupported | Replace with weighted median or robust regression. Do not allocate 40% to a weak far ring merely because it exists. |
| 12-month window | Sensible first preference, not a hard rule | Expand adaptively to 18–36 months when evidence is sparse, with official local time adjustment and lower confidence. |
| Fixed +0.4% monthly | Remove immediately | Apply actual local/property-type HPI movement from each comp date to valuation date. The HMLR HPI is available through downloadable files, linked data and an API.[^25][^26] |
| Ungeocoded comp at zero distance | Critical defect | Exclude from distance model or use postcode-centroid distance with an explicit approximation penalty. |
| HMLR exact-postcode fallback | Too narrow and attribute-poor | Search outward adaptively and join EPC floor area/building attributes. |
| “Hedonic” CSA derivative | Remove | Either build an independent repeat-sales/hedonic model or set weight to zero. Correlated inputs do not diversify error. |
| External AVM | Useful challenger, not truth | Retain as a diagnostic and learn its conditional weight from out-of-time performance. |
| Size pillar | Correct direction | Resolve subject and comps to UPRN, verify m² units, and estimate a robust local £/m² function rather than strict text-address joins. |
| Fixed ±3/5/8 “80% CI” | Mislabelled | Report “policy range” until empirical coverage is measured; then map confidence features to observed residual quantiles or FSD. |

RICS says market transactions close to the valuation date normally provide the best evidence, and the evidence should be ranked and adjusted for legal interest, condition, area and reliability.[^5] Rightmove’s current model combines an updated prior-sale model with similar nearby properties, using size, bedrooms, type, features, location, listing history and market activity; it widens the range or withholds a valuation when evidence is inadequate.[^11][^12] Hometrack reports that 80% of its valuations fall within 10% of surveyor-recommended value, but this is vendor-reported and uses surveyor value rather than final sale price.[^27]

### Expected accuracy

For the current design, **10–14% MdAPE on ordinary terraced houses is a planning estimate**, with a wider and asymmetric tail for unmodernised London period houses. The estimate is anchored by a 2026 open AVM reporting 8.1% MdAPE on 129,499 standard sales, an Oxford study in which many Greater London district results remained under 15% average absolute error, and commercial-provider claims that are better but not independently comparable.[^28][^29][^30]

The design should not claim under 8% until a representative out-of-time test demonstrates it. To have a credible chance of reaching that target:

- Resolve every subject and comp to UPRN.
- Use local, type-aware time movement rather than a fixed positive rate.
- Make floor area, tenure, age/form and prior-sale history first-class features.
- Use robust outlier handling on every comp path.
- Add listing history and condition evidence, while preventing post-valuation leakage.
- Train or calibrate weights out of time, by segment.
- Abstain on unusual, sparse or mismatched cases rather than force a synthetic figure.

## 5. Offer formula

### Market evidence

The available evidence does **not** justify a precise seller-type margin table. A Land Registry-based 2024 analysis reported cash buyers paying 9.3% less than mortgaged buyers, but this is not a causal measure of a speed/certainty discount because cash buyers purchase a different mix of property.[^31][^32] A separate 2024 listing analysis put London “cash buyer only” asking prices 8% below the regional average, again confounded by property condition and mortgageability.[^33][^34]

House-buying companies publish wider ranges around 73–85% of market value, but these are interested-party claims rather than audited achieved-sale datasets.[^35][^36] Auction averages are also compositionally different from private sales; guide prices are not expected sale prices, and around half of house and flat auction sales have completed within 10% of guide over recent years.[^37][^38]

Therefore:

- A 15–25% acquisition discount is **commercially plausible for selected distressed/problem stock**, but not evidenced as a universal discount caused by probate, repossession or relocation.
- Probate at 20% and standard at 22% implies standard sellers are cheaper than probate sellers, which is neither intuitive nor evidence-based.
- Seller situation should influence negotiation probability and service proposition; it should not mechanically reduce valuation.

### Recommended formula

Use one residual maximum-offer model:

`max offer = conservative GDV − works − purchase costs − finance − selling costs − tax allowance − risk reserve − required profit`

Run at least downside/base/upside scenarios. The public/vendor offer can be the lower of the residual maximum, a confidence-adjusted percentage of as-is value and any policy exposure cap. Do not subtract seller margin and risk again after the residual model already prices those costs; that double counts uncertainty.

### Cost corrections

| Assumption | Judgment | Change |
|---|---|---|
| SDLT | Check implementation against current bands | From 1 April 2025, additional-dwelling rates are 5%, 7%, 10%, 15% and 17% by band.[^39][^40] |
| £300/m² fair | Cosmetic only | Rename to scope, not condition, and add region/specification. |
| £550/m² tired | Too low for a comprehensive London period-house refurbishment | Use only for tightly scoped cosmetic work with quotes. |
| £850/m² distressed | Likely low for full London works | Published 2025 London guides commonly exceed this for full renovation.[^1][^3] |
| £1,300/m² derelict | Not a safe ceiling | Treat as an initial minimum scenario; back-to-brick and premium London guides can be materially higher.[^2][^41] |
| 0% contingency | Unacceptable | Use an explicit risk reserve that increases before survey and with design/title uncertainty; release it only when fixed quotes and investigations close risks. |
| 10% annual finance, 1% fee, 12 months | Scenario, not truth | Model rate, utilisation, arrangement/exit/legal/valuation fees and monthly draw timing; test 9/12/15-month exits. No sufficiently authoritative 2024–26 public benchmark for the full facility stack was found. |
| 1.5% sales fee | Plausible scenario | Include VAT and test local agent quotes. |
| 75m² default | Dangerous in prime | Do not issue an investable prime appraisal until floor area is verified. |

For prime London, current cost evidence is too dispersed to justify a single band. Keep a library of real contractor tenders and final accounts by scope—cosmetic, services, structural, envelope, extension and finish—and update unit rates monthly.

## 6. Confidence and calibration

### Cheapest credible backtest

1. **Freeze prospective records now.** For every scouted property store appraisal timestamp, input snapshot, software/config version, point estimate, range, confidence, selected comps and exclusion reasons.
2. **Prevent leakage.** Re-run historical cases only with data that was available on the original date; temporal splitting is the appropriate real-world design.[^42][^43]
3. **Match monthly to HMLR.** Download the monthly Price Paid file, normalise address and UPRN where available, and append completed sale price/date. HMLR updates Price Paid monthly and supplies current-month and historic bulk files.[^13][^23]
4. **Apply a transaction lag.** Keep the cohort open for at least 12 months and preferably 18 months because listings may sell late and registration itself lags.
5. **Separate samples.** Report all scouted properties that sold, then a cleaner arm’s-length subset. Do not exclude errors merely because the model disliked the property.
6. **Report the right metrics.** Hit rate, median signed error, MdAPE, mean absolute error, PE10, PE20 and interval coverage; segment by track, type, geography, price band, confidence and comp path. These are consistent with European AVM testing requirements.[^44]
7. **Calibrate intervals empirically.** For an intended 80% range, approximately 80% of subsequent sale prices should fall inside; use held-out residual quantiles by confidence segment rather than fixed constants. FSD and coverage must themselves be validated out of sample.[^45][^46]
8. **Publish abstention performance.** Show accuracy and coverage at each acceptance threshold so “better accuracy” cannot be obtained simply by refusing difficult properties.

### Sample and window

Start reading overall metrics at **200–300 matched sales**, but do not trust segmented conclusions below roughly 100 observations per cell. A few hundred cases is the minimum practical aggregate test; thousands are preferable for stable segmentation.[^47] If the scout does not generate enough sold matches within 12–18 months, add a shadow cohort sampled from fresh listings or recently exchanged transactions, still ensuring valuation precedes knowledge of the sale price.

The first useful 30-day output is not final accuracy. It is a complete frozen cohort, match-rate baseline, data-leakage test and a retrospective dry run whose limitations are clearly labelled.

## 7. Prime thesis

### Judgment

“Below its own street, with a condition reason” is a sound **candidate-generation rule** because it controls for micro-location and demands an explainable source of value. It is not a complete refurb-arbitrage test because streets contain flats and houses, freeholds and leaseholds, extended and unextended properties, superior and inferior aspects, different school catchments and different conservation/planning constraints.

London prices were down 2.5% annually in June 2026, while terraced prices were broadly flat at -0.3%; borough-level performance varied widely.[^48][^49] A static threshold therefore risks mistaking market decline or mix change for property-specific discount.

### Failure modes

| False positives | False negatives |
|---|---|
| Street mean inflated by larger, extended, freehold or superior-condition sales | Genuine value opportunity on an adjacent comparable street rather than the same street |
| Subject is a flat, short lease, main-road house or compromised plot | Rare period house with too few same-street transactions |
| Apparent discount reflects structural, title, planning, occupancy or neighbour risk | Asking price is not yet discounted, but seller will accept a residual-value offer |
| Refurb premium is assumed from “unmodernised” without evidence of achieved post-works prices | Property below £700k with a credible >£1m post-refurb GDV |
| GDV uses completed turnkey homes with extensions the subject cannot reproduce | Property initially below the 40% ratio because street average is distorted |
| Downward market movement and sale delay erase the nominal spread | Off-market probate/receiver lead has no asking price and is excluded |

### Threshold decisions

- **£700k floor:** not defensible as a universal investment rule. Use minimum expected cash profit, profit on cost, downside cover, capital-at-risk and absorption instead. Keep £700k only as a portfolio-capacity filter.
- **10% minimum discount:** too close to plausible AVM error to prove arbitrage. Require the conservative residual margin to remain positive after valuation error, works contingency, selling time and downside GDV.
- **40% comparability cutoff:** useful as a data-quality alarm, not an automatic rejection. Below 40% usually signals wrong property class or a severe defect; route to identity/tenure review.

The prime decision should compare the subject with 5–8 genuinely reproducible post-refurb exits and as-is comps, with verified area and extension status. RICS guidance supports several recent, similar, verifiable transactions and explicit adjustment for condition, legal interest and area.[^4][^5]

## 8. Iteration plan

The plan is ordered by expected impact divided by founder/engineering effort. Measures are designed to show directional evidence within 30 days, not to claim completed-deal causality.

| Rank | Change | Impact | Effort | Evidence line | 30-day measure |
|---:|---|---|---|---|---|
| 1 | Exclude ungeocoded comps from near ring; record geocode quality | Very high | Low | Zero distance turns missing data into maximum relevance, contrary to verifiable, reliable comp selection.[^4] | Share of valuations changed >5%; manual relevance rating on 50 cases |
| 2 | Replace +0.4%/month with HMLR local/type HPI adjustment | Very high | Low-medium | Official HPI is available via download, linked data and API; London direction was negative annually in mid-2026.[^48][^26] | Bias shift on frozen retrospective cohort; comp adjustment distribution |
| 3 | Remove the derivative hedonic pillar and reallocate no weight until independent | High | Low | It repeats CSA information and cannot diversify error. | AVM change and manual comp-review preference on 50 cases |
| 4 | Start immutable prospective backtest logging and monthly HMLR matching | Very high | Medium | AVM confidence must be validated against later benchmark prices, including bias and dispersion.[^44][^43] | 100% appraisal snapshot completeness; match-rate dashboard live |
| 5 | Make residual max-offer the single offer engine | Very high | Medium | Seller-type discounts lack causal UK evidence; current layers risk double counting. | Differences between old/new max offers; founder acceptance of rationale |
| 6 | Introduce UPRN-first subject/comp identity and verified floor area | Very high | Medium-high | EPC/HMLR-linked data at national scale already demonstrates UPRN and floor-area joins.[^21][^15] | UPRN resolution rate; verified-area rate; strict-match failures removed |
| 7 | Split sourcing into priced, prime and no-price queues with top-K capacity | High | Medium | One threshold has different information content across queues. | Review yield, contact attempts and positive ratings per founder hour by queue |
| 8 | Rebuild London works scenarios and add explicit contingency | High | Low | Published London refurbishment guides sit materially above several current bands.[^1][^2][^3] | Variance against three live contractor budget quotes; offers changed |
| 9 | Pilot one auction aggregator and one probate feed with full funnel attribution | Medium-high | Low | EIG coverage and auction volumes are material; probate-feed conversion evidence is absent.[^16][^19] | Cost per unique qualified lead, response, viewing and offer |
| 10 | Fix deep appraisal inputs or turn it off | Medium | Low | A report that hard-codes terraced and cannot see the deterministic AVM creates false authority. | Contradiction rate versus deterministic appraisal; founder usefulness score |

## Change this first

1. **Repair comp location semantics:** missing geocode must mean “unknown/excluded,” never “zero metres away.”
2. **Use actual market movement:** wire the official HPI feed and delete the always-positive monthly uplift.
3. **Remove fake diversification:** drop the derivative hedonic pillar.
4. **Freeze every decision:** create an immutable appraisal and scorer outcome table before changing more weights.
5. **Unify the offer:** residual economics first; seller situation only informs negotiation.
6. **Make identity first-class:** UPRN, property form, tenure and verified floor area before prime appraisal.
7. **Separate queues:** priced volume, prime and event/no-price leads must have different gates and capacities.
8. **Reset refurbishment economics:** scope-based London cost bands, VAT treatment and explicit risk reserve.
9. **Buy evidence, not more adapters:** run short, attributed source pilots and cancel any that cannot beat the incumbent cost per founder-worthy lead.
10. **Fix or disable the LLM appraisal:** no hard-coded type, no guessed environmental risks and no report that ignores the primary valuation.

## Stop doing this

- **Stop using the plain mean of ten postcode sales** for classification, ROI or street opportunity detection. It is highly exposed to property-mix and outliers.
- **Stop applying a positive fixed time adjustment** in every market state.
- **Stop treating geocode failure as perfect proximity.**
- **Stop paying weight to a pillar derived from another pillar.**
- **Stop labelling fixed policy bands as an 80% confidence interval** until measured coverage supports the label.
- **Stop allowing missing environmental and tenure inputs to mean zero risk.** Missing should lower confidence and trigger investigation.
- **Stop changing price by seller category.** Change outreach and negotiation expectations instead.
- **Stop scoring postcode EPC as subject-property risk.**
- **Stop appraising prime properties with default 75m² floor area or unverified external-AVM units.**
- **Stop running or maintaining sources that are permanently skipped, strategically out of scope or unmeasured.**
- **Stop creating authoritative-sounding LLM reports from guessed risks and the wrong property type.**
- **Stop tuning weights from stars alone.** Ratings are useful for ranking relevance, not proof of acquisition probability or profit.

## Adversarial verification

The strongest recommendations above rely mainly on official HMLR/MHCLG data, RICS standards and transparent AVM-testing standards. Claims about cash-company offer ranges, refurbishment costs and provider accuracy come from vendors or industry publications and should be treated as benchmarks to test, not facts to encode directly.[^36][^1][^27]

No robust 2024–26 UK public evidence was found for seller-situation discounts by probate, relocation, chain break or receiver sale after controlling for property characteristics. No public evidence was found that validates the proposed existing scoring weights or the exact 0.25/0.5-mile 60/40 comp blend. Accordingly, exact replacement weights in this report are hypotheses for versioned experimentation, while the recommendations to remove data leakage, false proximity, duplicate pillars and uncalibrated intervals are methodological corrections.

The “10–14% current MdAPE” is explicitly an estimate derived from external benchmarks, not a backtest result. It should not appear in customer material, investment approvals or product claims. The decisive evidence will be the prospective, time-frozen, representative Land Registry backtest described above.

---

## References

1. [London Renovation Costs 2025: 2-Bed Flat Refurbishment £45k ...](https://renoquote.uk/resources/london-renovation-costs-2025) - 2-bed flat refurbishment cost London 2025: £45,000–£150,000. Flat renovation costs: £1,500–£3,000/m²...

2. [Renovation Cost Per Square Metre 2025](https://www.hampsteadrenovations.co.uk/renovation-cost-per-square-metre/) - London house-refurbishment bands from £650 to £3,250 per square metre depending on scope.

3. [How Much Does It Cost To Remodel A House In 2025 ...](https://buildpartner.com/how-much-does-it-cost-to-remodel-a-house-in-2025-a-uk-guide/) - What does it cost to remodel a house in the UK in 2025? Here are the average remodelling costs per s...

4. [Comparable evidence in real estate valuation - RICS](https://www.rics.org/content/dam/ricsglobal/documents/standards/comparable_evidence_in_real_estate_valuation.pdf)

5. [[PDF] Comparable evidence in real estate valuation | RICS](https://www.rics.org/content/dam/ricsglobal/documents/standards/Comparable%2520evidence%2520in%2520real%2520estate%2520valuation.pdf)

6. [Arrears and possessions - UK Finance](https://www.ukfinance.org.uk/data-and-research/data/arrears-and-possessions)

7. [UK Finance: Mortgage arrears and possessions - Q1 2026 | Insights](https://www.ukfinance.org.uk/news-and-insight/press-release/uk-finance-mortgage-arrears-and-possessions-q1-2026) - Read the latest news and insights from UK Finance: UK Finance: Mortgage arrears and possessions - Q1...

8. [Family Court Statistics Quarterly: April to June 2025](https://www.gov.uk/government/statistics/family-court-statistics-quarterly-april-to-june-2025/family-court-statistics-quarterly-april-to-june-2025)

9. [Family Court Statistics Quarterly: January to March 2025](https://www.gov.uk/government/statistics/family-court-statistics-quarterly-january-to-march-2025/family-court-statistics-quarterly-january-to-march-2025)

10. [APC: valuation approaches and methods | Journals - MODUS | RICS](https://ww3.rics.org/uk/en/journals/property-journal/apc-5-valuation-methods.html) - What steps do candidates need to take to achieve the Valuation competency in their APC? An assessor ...

11. [How do online valuations work? | Rightmove Guides](https://www.rightmove.co.uk/guides/how-do-online-valuations-work/) - Everything you need to know about online property valuations and when you might need a different typ...

12. [How much is your house worth? Instant Online Valuation. - Rightmove](https://www.rightmove.co.uk/house-value.html) - Our Rightmove estimate is calculated by industry-trusted machine learning models. These use a mixtur...

13. [Price Paid Data](https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads) - Download the Price Paid Data (PPD) in text or CSV format and access our linked data.

14. [How to access HM Land Registry Price Paid Data - GOV.UK](https://www.gov.uk/guidance/about-the-price-paid-data) - Information about Price Paid Data and how you can get it.

15. [Get energy performance of buildings data](https://get-energy-performance-data.communities.gov.uk/)

16. [March 2026 Newsletter - EIG Auction](https://www.eigpropertyauctions.co.uk/news/newsletter/2026/march) - Property Auction newsletter for March 2026

17. [January 2026 Newsletter](https://www.eigpropertyauctions.co.uk/news/newsletter/2026/january) - Property Auction newsletter for January 2026

18. [Property auctions, auctioneers and property search](https://www.eigpropertyauctions.co.uk/) - EIG provide details on virtually every property going to auction in the UK, UK property auctions* ov...

19. [Property Deal Sourcing Software - Find Investors and Off-Market Property](https://www.formationdata.co.uk/property-deal-sourcing) - FormationData is a UK property deal sourcing platform. Find cash-backed property investors and portf...

20. [9amLeads | UK Business Leads Delivered Daily at 9am](https://9amleads.com/) - Exclusive UK business leads delivered daily at 9am. Moving, probate, new business, planning & tender...

21. [House Price Per Square Metre in England and Wales, 1995-2024](https://reshare.ukdataservice.ac.uk/857911/) - This repository is the fourth updated version of the attribute-linked residential property price dat...

22. [Empty homes statistics from across the UK: 2026](https://analysisfunction.civilservice.gov.uk/policy-store/empty-homes-statistics-from-across-the-uk-2026/)

23. [Price paid data: July 2026 - GOV.UK](https://www.gov.uk/government/statistical-data-sets/price-paid-data-july-2026) - The current month's Price Paid Data includes new monthly transactions, earlier updates and SPPD/APPD...

24. [Family Court Statistics Quarterly: July to September 2025 - GOV.UK](https://www.gov.uk/government/statistics/family-court-statistics-quarterly-july-to-september-2025/family-court-statistics-quarterly-july-to-september-2025)

25. [UK House Price Index](https://landregistry.data.gov.uk/app/ukhpi/)

26. [UK House Price Index: About - Land Registry](https://landregistry.data.gov.uk/app/ukhpi/doc/ukhpi)

27. [Automated Valuation Model - Hometrack](https://www.hometrack.com/mortgage-solutions/automated-valuation-model/) - Hometrack’s Automated Valuation Model (AVM) is the UK’s industry-leading valuation model for mortgag...

28. [Technical Summary — Gadsden Valuations](https://gadsdenvaluations.com/technical-summary) - Technical summary of the Gadsden Valuations automated valuation model. Methodology, accuracy metrics...

29. [[PDF] The future of automated real estate valuations (AVMs)](https://www.sbs.ox.ac.uk/sites/default/files/2022-03/FoRE%20AVM%202022.pdf)

30. [AVM Accuracy Metrics Explained — PE10, MdAPE, Bias, FSD](https://gadsdenvaluations.com/knowledge/accuracy-metrics) - A comprehensive guide to the metrics used to measure automated valuation model accuracy: PE10, MdAPE...

31. [Cash buyer discounts rise but market share drops - research](https://www.estateagenttoday.co.uk/breaking-news/2025/01/cash-buyer-discounts-rise-but-market-share-drops-research/) - Cash buyers are securing average discounts of more than 9% compared with the prices paid by buyers n...

32. [Buying a house? Pay in cash for a £28k discount](https://www.cityam.com/why-is-it-so-much-cheaper-to-buy-houses-in-cash/) - Cash buyers now pay £28,000 less on average for a home than those relying on a mortgage, according t...

33. [Cash is still King - investors enjoy huge reductions from anxious sellers - Property Investor Today](https://www.propertyinvestortoday.co.uk/breaking-news/2024/11/cash-is-still-king-investors-enjoy-huge-reductions-from-anxious-sellers/) - What's the difference between sale prices for cash and mortgaged buyers?

34. [Cash buyers can get huge discounts in UK property market](https://www.buyassociationgroup.com/en-gb/news/cash-buyers-pros-and-cons/) - Sellers are often willing to drop the price for cash buyers, but there are a number of things to con...

35. [How Much Below Market Value Do House Buying ...](https://www.propertysolvers.co.uk/articles/how-much-below-market-value-do-house-buying-companies-offer/) - Discover why genuine cash buyers typically pay 70–75% of market value (with no fees), what factors s...

36. [Types of Companies that Buy...](https://housebuyers4u.co.uk/house-buying-companies/) - How are they able to buy in Cash? How do they compare to estate agents? Find out now.

37. [Property Auction Insights Q2 2026](https://www.eigpropertyauctions.co.uk/news/pad/2026/q2) - The heatmap shows average auction yields by region for 2025-26, however current yields only tell par...

38. [Auction buyers more selective as fewer properties sell above guide ...](https://theintermediary.co.uk/2026/06/auction-buyers-more-selective-as-fewer-properties-sell-above-guide-price-eig/) - Buyers are more selective, with fewer properties selling well above guide price and more sales finis...

39. [Higher rates of Stamp Duty Land Tax - GOV.UK](https://www.gov.uk/guidance/stamp-duty-land-tax-buying-an-additional-residential-property) - Check if you have to pay the higher rates of Stamp Duty Land Tax (SDLT) when you buy a residential p...

40. [Finance Act 2025](https://www.legislation.gov.uk/ukpga/2025/8/section/51)

41. [Refurbishment Costs per Square Metre: 2026 UK & London Guide](https://allwellpropertyservices.co.uk/blog/refurbishment-costs-per-square-metre) - House refurbishment costs per sqm in 2026. Light refurb £800-£1,200/sqm, full refurb £1,200-£1,800/s...

42. [Methodology - Gadsden Valuations](https://gadsdenvaluations.com/methodology) - How Gadsden Valuations builds, validates, and monitors its automated valuation model. Walk-forward b...

43. [[PDF] European Standards for Statistical Valuation Methods for ...](https://www.europeanavmalliance.org/files/eaa/Downloads/EAA_Standards_3rd_Edition.pdf)

44. [Key Requirements - European AVM Alliance](https://www.europeanavmalliance.org/en/eaa-avm-label-accreditation/key-requirements.html) - The AVM must provide an estimated value for an individual property and a predictive measure of the e...

45. [Full article: An Exposition of AVM Performance Metrics](https://www.tandfonline.com/doi/full/10.1080/15214842.2020.1757352) - an AVM valuation for a single target property has its own sampling distribution. AVM value's expecte...

46. [[PDF] Automated Valuation Model Back Testing | PropTrack](https://www.proptrack.com.au/wp-content/uploads/2023/12/Whitepaper_BacktestingFramework-1.pdf) - AVM service providers provide AVM's for the sample properties for the requested valuation dates usin...

47. [How to Backtest an AVM — Automated Valuation Model Testing Guide](https://gadsdenvaluations.com/knowledge/how-to-backtest) - Backtesting is the process of comparing an AVM's valuation estimates against actual transaction pric...

48. [UK House Price Index for June 2026](https://www.gov.uk/government/news/uk-house-price-index-for-june-2026) - The UK HPI shows house price changes for England, Scotland, Wales and Northern Ireland.

49. [UK House Price Index England: May 2026](https://www.gov.uk/government/statistics/uk-house-price-index-for-may-2026/uk-house-price-index-england-may-2026)

