# Prime sourcing — Perplexity deep-research prompt

_Written 2026-08-29. Derived from `docs/PRIME-SCOUT.md`,
`packages/scouting/src/track.ts` and
`docs/architecture/sourcing-channels.md` as of that date. If the prime
thesis or district list changes, update the prompt before running it._

## Why this exists

The prime district list is a **reasoned hypothesis, not a measured
finding** (`track.ts` says so in its own comments), and the sourcing
channels were last deep-researched in Aug 2026 with the fact-check stage
cut short by a spend cap. This prompt asks an outside research engine the
questions the codebase cannot answer about itself:

- **Where** the unmodernised → refurbished spread is actually widest
- **Which** seller situations reliably produce below-market prime sales
- **Which** channels we are not fishing yet
- **What** numbers should define a "best" deal in 2026

The prompt is deliberately **anonymous** — it describes the strategy but
never names the company. Keep it that way.

## How to run it

- Perplexity → model/mode: **Deep Research**
- Paste the whole master prompt below in one go
- Expect a long run (10–30 min). Read the executive summary first
- Then run the follow-ups, one at a time, in the same thread
- Always finish with follow-up **C (adversarial pass)** before trusting
  anything — same fan-out + fact-check pattern as the Aug 2026 research

## The master prompt

```text
You are a senior UK residential property market researcher. I run a
London property trading company. Research how we find the best prime
opportunities. Be specific, quantitative, and cite every claim.

## Our strategy — read this first

- We buy period houses in London (Victorian/Edwardian terraces and
  semis) priced below what their own street sells for, where the
  discount is explained by condition: unmodernised, derelict, or a poor
  EPC.
- We refurbish and sell to owner-occupiers. Entry £700k–£2M. Exit
  typically £1M+.
- We buy with cash, direct from the seller where we can, and can
  complete in as little as two weeks.
- We are NOT: buy-to-let investors, £3M+ super-prime dealers, or
  ground-up developers.
- A cheap house with nothing fixably wrong (bad plot, railway line,
  short lease) is not a deal for us. A cheap house that is simply
  unmodernised is exactly our deal: the discount is the refurb budget
  plus our margin.

## What we already do — do not re-research this

We already systematically scan: portal-derived distress lists
(repossessed, quick-sale, reduced, slow-to-sell, derelict, unmodernised,
back-on-market, chain-free, cash-buyers-only, auction, short-lease,
poor-EPC); probate notices in The Gazette; receivership and
administrator appointments matched to Companies House charges; auction
catalogues from Auction House UK and Allsop; council brownfield
registers for stalled planning consents; HM Land Registry street-level
sold prices. Your job is what we are missing, and how to get to sellers
earlier than this machinery already does.

## Research questions

Answer all six. Number your answers to match.

1. Where is the refurb arbitrage widest?
   Which London postcode districts (zone 2–4) have the widest AND most
   liquid gap between unmodernised and refurbished sold prices for
   period houses? Use £/sqft sold-price evidence wherever possible.
   Our current hunting list: SW4, SW6, SW11, SW12, SW16, SW17, SW18,
   SE3, SE15, SE21, SE22, SE23, SE24, N4, N7, N8, N10, N16, N19, W3,
   W4, W5, W12, W13, NW2, NW5, NW6, NW10, E5, E8, E9, E11, E17.
   - Which of these does the data NOT support, and why?
   - Which districts are missing that the data DOES support?
   - Rank your top 15 districts with the evidence for each.
   - We deliberately exclude super-prime (W8, W11, SW3, SW7, NW3, NW8):
     £3M+ entry, thin buyer pool, listed-building consent risk. Does
     the evidence support that exclusion, or is there a subsegment
     there we are wrong about?

2. Which seller situations actually produce below-market prime sales?
   For £700k+ London houses, which seller circumstances most reliably
   precede a below-market sale, and at what typical discount? Quantify
   where possible: probate/deceased estate, receivership,
   repossession, divorce, emigration/relocation, downsizing after long
   tenure, landlord exit, failed sale/broken chain, unmortgageable
   condition. For each: is it observable in public data BEFORE the
   property is openly marketed, and where?

3. Which sourcing channels are underfished?
   Where does off-market and distressed £700k+ London stock actually
   change hands, and which routes do cash buyers underuse? Evaluate at
   least: auction houses beyond Auction House UK and Allsop (Savills,
   Strettons, Barnard Marcus, Clive Emson, McHugh, First For
   Auctions); LPA receiver panels and how receivers pick buyers;
   probate and private-client solicitors; empty-homes officers at
   London boroughs; deceased-estate clearance firms; retirement and
   care-transition advisers; expired/withdrawn listing data; landlords
   selling because of EPC rules or leasehold reform; bridging-loan
   defaults (we previously found no public data on these — challenge
   that). For each channel: how deals surface, typical lead time
   before open marketing, how a buyer earns access, evidence of real
   volume, and an effort-to-yield rating.

4. What numbers define a best deal in 2026?
   Current benchmarks, 2024–2026 only: full refurbishment cost per
   sqft for London period houses at three levels (cosmetic / full
   refurb / full plus loft and rear extension); typical percentage
   uplift from unmodernised to refurbished; average days-on-market for
   refurbished family houses; total buying and selling transaction
   costs for a company that buys, refurbishes and resells (include the
   current SDLT position for corporate buyers and any developer or
   trader reliefs); indicative cost of 6–12 months of bridging
   finance.

5. What could kill this strategy in the next 24 months?
   Rank by likelihood times impact, with evidence: London family-house
   price direction; refurb cost and labour inflation;
   conservation-area and Article 4 coverage by borough; planning and
   licensing changes; leasehold and commonhold reform side-effects;
   Building Safety Act scope; the mortgage-rate path and its effect on
   our £1M+ owner-occupier exit buyer.

6. Who else runs this play, and how do they source?
   Identify the firms and investor types doing buy-refurbish-sell on
   London period houses at £700k–£2M. How do they find stock? What do
   they pay relative to open-market value? Which sourcing routes are
   crowded, and which do they neglect?

## Rules

- UK and London data only. Use 2024–2026 figures; date every number;
  flag anything older.
- Prefer primary sources: HM Land Registry price paid data, ONS, EPC
  open data, The Gazette, MHCLG, EIG/Essential Information Group
  auction results, LonRes, Rightmove and Zoopla research, Savills,
  Knight Frank, Hamptons, RICS, JLL.
- Separate measured data from opinion and commentary. Label estimates
  as estimates.
- If you cannot find evidence for something, say "not found" — never
  fill a gap with a plausible-sounding guess.
- Cite every factual claim with a link.

## Output format

1. Executive summary — at most 10 bullets, each one decision-ready.
2. Answers 1–6, numbered, with tables where they help.
3. "Act on this next" — the 10 highest-value changes to our sourcing,
   ranked, each with the one evidence line that justifies it.
```

## Follow-up prompts (same thread)

**A — district drill-down.** Run once per district you care about:

```text
Take [DISTRICT]. For the last 24 months: sold prices for unmodernised
vs refurbished period houses (addresses, dates and prices where
findable), the current £/sqft spread, stock turnover, conservation-area
coverage, and the three streets with the highest share of long-tenure
owners. Same citation rules as before.
```

**B — channel drill-down.** Run once per promising channel from Q3:

```text
Take [CHANNEL] from your answer to question 3. Give me: the 10 most
active named firms or people in London, how a credible cash buyer gets
on their radar, what they need from a buyer, typical deal cadence, and
any public data feed or list that exposes their stock early. Same
citation rules.
```

**C — adversarial pass.** Always run this last:

```text
Now attack your own report. Which of your claims rest on a single
source, on marketing content, or on pre-2024 data? Re-verify the 10
claims my strategy would lean on hardest, and correct anything that
does not hold.
```

## What to do with the results

| Finding | Where it lands |
|:---|:---|
| District list changes (Q1) | Trial first via Settings → Scouting (founder-marked ★ Prime areas — no code change); validate with `scripts/avm-backtest.mts`; only then edit `LONDON_PRIME_DISTRICTS` in `packages/scouting/src/track.ts` |
| New distress signals (Q2) | New lead types / list types — trace the whole path (classifier, resolver, probe, cron) per the CLAUDE.md rule |
| New channels (Q3) | Add to the plan in `docs/architecture/sourcing-channels.md`; relationship channels are founder actions, not code |
| Refurb + exit benchmarks (Q4) | AVM assumptions in `@repo/valuation`; deal-margin sanity checks |
| New condition phrasing from listings | `REFURB_TEXT` in `track.ts` (anchored, grouped, tested) |
| The report itself | Save in this folder as `prime-sourcing-deep-research-<yyyy>-<mm>.md` and add it to the README index |

Mind the credit maths before widening coverage off the back of Q1 —
`docs/PRIME-SCOUT.md` § 6.
