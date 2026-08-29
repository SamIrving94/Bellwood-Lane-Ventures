# The Prime Scout: how it works, how to run it, how to tune it

_Last verified against the code: 2026-08-29._

> **Fast path (Aug 2026):** `/cron/ch-stream` drains the Companies House
> Streaming API every 30 minutes for fresh charges/insolvencies on
> property-SIC companies across ALL configured areas (prime and volume) —
> lender-pressure leads land in minutes instead of the daily poll's ~24h.
> Same scorer, same gate, same prime classification; the daily cron remains
> the backstop. It also feeds the read-only entity graph behind the lead
> page's Connections panel. Needs `CH_STREAM_KEY` (a separate Companies
> House streaming registration) on bellwood-api.

The prime book is a **London refurb-arbitrage play**: buy a period house
below what its own street sells for, refurbish, sell into a deep
owner-occupier market. This document is the single place that records how
the scout finds that stock, what every number means, and which levers exist.

The operating rule is "Steps vs Thoughts" (CLAUDE.md): the scout automates
the finding and the evidence; **a person makes every prime call**. Prime
leads bypass the volume sourcing gate entirely.

---

## 1. The thesis, in one sentence

> A prime opportunity is a property in a district we hunt in, priced
> **below its own street**, carrying the **condition that explains why**.

Both halves are load-bearing:

- A £900k house priced at £900k is prime stock and worthless to us.
- A cheap house with nothing fixably wrong is usually cheap for a reason we
  cannot fix: a bad plot, a railway, a short lease. The discount with no
  condition reason is surfaced as **"check why"**, never scored as an
  opportunity.
- A cheap house that is simply unmodernised is the whole strategy: the
  discount is the refurb budget plus our margin.

## 2. The pipeline, end to end

| Stage | Where | What it does |
|:--|:--|:--|
| **Areas** | Settings → Scouting (`areas-actions.ts`) | Founder adds districts. Any real UK district resolves dynamically (postcodes.io); fakes are rejected at input by name. `track: 'prime'` areas are scanned **every run**, outside the 6-a-day volume rotation — and scan **three extra distress lists** (chain-free, cash-only, poor-EPC: the executor / stuck-owner / needs-work signals) |
| **Capture** | `index.ts` → `isPotentialPrimeCapture` + `selectShortlist` | Prime/block candidates (and any valueless notice or house-shaped below-floor price in a prime district) are **guaranteed shortlist slots outside the volume limit** — the volume scorer can never rank them out before classification. Cornerstone-investor backing means no per-run limit applies to prime (founder direction, Aug 2026) |
| **Classify** | `packages/scouting/src/track.ts` → `classifyTrack` | `prime` when, inside a prime district: own value ≥ £700k, OR no value of its own and the **HMLR street average** ≥ £700k, OR — the discounted-prime path — own value below the floor but ≥ 40% of a £700k+ street average and not flat-shaped. The street fallback is what lets probate reach prime; the discount path is what lets the deepest-margin deals (whose asking price is LOW precisely because they are gold dust) reach it |
| **Assess** | `track.ts` → `assessPrimeOpportunity`, wired via `primeOpportunityForTrack` | Computes the thesis: `discountToArea` vs the street, condition from the PropertyData badge or listing text, `isOpportunity` when both hold. Stamped onto `rawPayload.primeOpportunity` |
| **Gate** | `scorer-config.ts` | Prime and block **bypass** the sourcing threshold. A human decides |
| **Appraise** | `cron/lead-appraise`, `cron/deep-appraisal` | Prime/block leads are fetched separately and **jump both appraisal queues** regardless of verdict — numbers ready the same day they are sourced, never behind the volume backlog |
| **Auctions** | `track.ts` → `classifyAuctionTrack`, `/agents/auctions` | Guides are floors, not values: £700k+ guide = prime **anywhere** (no geographic demotion — the catalogue is already a distress channel), and inside a prime district a non-flat lot guided ≥ 70% of the floor is prime too. Founder-marked districts count |
| **Surface** | `/leads`, `/pipeline`, lead detail | Badge upgrades to **"★ Prime opportunity · N% under street"** when the thesis holds; the detail page shows the evidence verbatim in the verdict card |

## 3. Who can be prime (and who structurally cannot)

- **PropertyData listings** carry a price; classify on their own value.
- **Probate (Gazette), receiverships, Companies House charges** carry NO
  value. They classify on the street average. If HMLR has no real
  comparable for the postcode (or only a synthetic fallback), they stay
  volume, because classifying against fabricated data is worse than not
  classifying.
- An unreadable postcode **never demotes**: a false `volume` silently
  buries a £1M opportunity; a false `prime` costs one founder glance.

## 4. The district list (and who wins when you disagree with it)

**The founder's geography wins.** Any area marked ★ Prime in Settings →
Scouting EXTENDS the built-in list: the cron passes those districts into the
classifier, so marking DA12 prime means DA12 leads can classify prime, with
the same £700k/street-average rules applied there. The built-in list is the
default hypothesis, never a veto.

`LONDON_PRIME_DISTRICTS` in `track.ts` holds 33 tier-1 districts chosen for
**housing stock, not prestige**: zone 2–3 Victorian/Edwardian terrace belts
where the unmodernised-to-refurbished spread is widest (SE22, SW12, N8, W4,
E17…). Six tier-2 super-prime districts (W8, SW3, NW3…) are visible but
deliberately not the focus: £3M+ entry, thin buyer pool, listed/conservation
consent risk.

**The list is a reasoned hypothesis, not a measured finding.** Validate
against real comparables (`scripts/avm-backtest.mts`) before scaling spend,
and prune what does not earn its place.

## 5. Operations: scripts and their order

All need a `.env` with `DATABASE_URL` (and PropertyData key for live runs).

```sh
# 1. Where does the prime track stand? Read-only. Run BEFORE changing anything.
pnpm tsx scripts/prime-audit.mts

# 2. Seed London prime areas. Dry-run by default. Start small.
pnpm tsx scripts/seed-london-prime.mts --limit=10
pnpm tsx scripts/seed-london-prime.mts --write --limit=10

# 2b. The super-prime FRINGE trial (founder decision, 29 Aug 2026): scan
#     W11 + NW3 only — explicitly named districts seed regardless of tier.
#     Optionality, not conviction: the Aug 2026 deep research SUPPORTED the
#     super-prime exclusion; this scans the two most house-shaped fringe
#     districts so the founder glance decides deal-by-deal. ~2 extra prime
#     seeds per run (~40% more credits each than a volume seed).
pnpm tsx scripts/seed-london-prime.mts --write --districts=W11,NW3

# 3. After the next cron run, re-audit to measure the difference.
pnpm tsx scripts/prime-audit.mts

# 4. Rank districts by MEASURED refurb arbitrage (LR sold prices × EPC
#    condition, matched by address). Read-only, free APIs; needs
#    EPC_API_TOKEN in .env. This is the evidence the district list has
#    been waiting for — see §4's "hypothesis, not a finding" warning.
pnpm tsx --env-file=.env scripts/arbitrage-rank.mts --districts=SE22,W11,NW3
```

## 6. Credit maths (why you start with --limit=10)

Prime areas are scanned **every run and are not capped** (the volume pool is
sliced to `MAX_SEEDS_PER_RUN = 6`). A volume seed sweeps seven list types;
a prime seed sweeps **ten** (adds chain-free, cash-only, poor-EPC), so
budget roughly ~40% more credits per prime seed than the table below —
each call is cached 24h, so repeat probes inside a day are free.

| Prime areas | Extra credits per run | Per month (daily run) |
|--:|--:|--:|
| 10 | ~30 | ~900 |
| 20 | ~60 | ~1,800 |
| 33 (all tier 1) | ~99 | ~3,000 |

Check the plan's monthly allowance before widening. If prime coverage needs
to grow past the budget, the honest options are a prime-area cap in the cron
or a slower prime rotation, never silence.

## 7. Tuning levers, in the order to reach for them

1. **Which districts.** `LONDON_PRIME_DISTRICTS` (add/remove/re-tier), then
   re-seed. Zero risk, pure coverage.
2. **`MIN_MEANINGFUL_DISCOUNT`** (`track.ts`, 0.10). Below this a discount
   is noise. Raise it if the founder glance fills with 11% "opportunities"
   that are really pricing wobble.
3. **`PRIME_MIN_VALUE_PENCE`** (£700k). The ticket floor. Calibrated for
   the London exit; do not lower it to make prime "fire more". That is
   what `isOpportunity` is for. There is deliberately **no ceiling**
   anywhere: cornerstone investors back prime deal-by-deal, so a bigger
   number is never a reason to drop a lead.
4. **`PRIME_DISCOUNT_MIN_RATIO`** (0.40) and **`AUCTION_GUIDE_HEADROOM`**
   (0.70), both in `track.ts`. The first separates a discounted house from
   a flat on the same street; the second reflects how far under hammer
   auction guides sit. Widen with evidence, not hope.
5. **Condition language.** `REFURB_TEXT` in `track.ts`. Extend when real
   listings use phrasing it misses; every alternative is anchored, grouped,
   and tested.

## 8. What "good" looks like

- `prime-audit.mts` shows prime > 0 and London districts in the geography
  table.
- Prime leads in `/leads` carry evidence, not just a badge: *"Asking 27%
  below the area average · Condition signal: unmodernised properties"*.
- The founder can refuse most of them quickly. Scarcity plus evidence is
  the design, volume is not.

## 9. History (why the code reads defensively)

- **Aug 2026:** prime "wasn't doing a great job". Root causes: the
  classifier keyed solely off `estateValuePence` (null for every probate
  notice), and the £700k floor was written for London while the scout only
  scanned the North. Fixed in #80.
- **The SW3 incident:** adding a London district fabricated the seed
  postcode "SW3 1AA" and PropertyData 422'd, surfaced days later as a
  truncated row error. Fixed in #82: dynamic resolution, honest failures,
  and the two process rules now in CLAUDE.md.
- **The dead-code gap:** `assessPrimeOpportunity` was built and tested in
  #80 but never called by the pipeline; the scout knew what was prime but
  not whether there was money in it. Wired in the commit that added this
  document.
- **The capture gap (22 Aug 2026):** the shortlist ranked candidates with
  the volume scorer BEFORE track classification ran, so on a busy day a
  prime lead could be ranked out by volume terraces and never classified at
  all; the deepest-discount deals classified volume because their (low)
  asking price sat under the £700k floor; auction guides were read as
  values; and prime leads queued behind STRONG volume leads for both
  appraisal crons — deep appraisal never saw them at all. All four fixed in
  the prime-gold-dust-capture change: capture door at the shortlist,
  discounted-prime path, guide headroom, prime-first appraisal queues.
