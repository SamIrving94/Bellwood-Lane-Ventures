# Proposals: two AVM comp fixes, measured first

_Status: **proposed, not built.** Each needs its own founder yes to lift the
AVM freeze._
_Measured: 2026-10-22, read-only against production._

The AVM method is frozen until the backtest reads (CLAUDE.md). The one
exception so far was the EPC-by-UPRN floor area (18 Oct), allowed because
it was **measured first**. This note asks for two more, on the same terms.
They are **independent**: say yes to either, both or neither.

| | Proposal | Path | Fixes |
|:--|:--|:--|:--|
| **A** | Open-market, same-type comps only | Land Registry postcode fallback | Bad evidence |
| **B** | Near ring earns its 60% weight | PropertyData radius comps (the main path) | Thin evidence |

---

# Proposal A: two comp filters on the Land Registry fallback

## The ask

**Fix two filters in the Land Registry postcode fallback, so it only uses
real, same-type, open-market sales as comps.**

## The two bugs

Both live in the **postcode fallback**: the path the AVM takes when
PropertyData radius comps are empty.

1. **Non-market sales are used as comps.**
   Land Registry tags each sale A (standard, open market) or B
   ("Additional": repossessions, bulk and portfolio sales, sales to
   companies, right-to-buy). `fetchPricePaidLive` in
   `packages/property-data/src/hmlr.ts` never reads that tag, so B sales
   go straight into `filterComps`.
2. **Unknown types count as terraced.**
   `normaliseType` in `packages/valuation/src/base-valuation.ts` falls back
   to `'terraced'` for any type it doesn't know. Land Registry's "other"
   type (annexes, garages, odd buildings) lands there.

**Our own code already says these rules are right.** The newer sector
fallback (`packages/property-data/src/hmlr-sector.ts`) asks only for
**same-type, category A** sales. The postcode fallback is the odd one out.

## How it was measured

- **Cohort:** every appraisal on the postcode fallback that has its comps
  stored. That's **103**: 32 frozen snapshots plus 71 scout-lead AVMs (Jul to
  Oct 2026).
- Every stored comp was matched back to its Land Registry sale by price and
  date. **All 358 matched.**
- `filterComps` was replayed as of each appraisal date. It reproduced the
  stored comp set **exactly for 91 of 103**.
- It was then replayed with B and "other" sales removed. The **comp median**
  (the CSA) was compared before and after.
- The CSA, plus a size/bedroom figure built on it, make up about 80–100% of
  the estimate on this path. So **the estimate moves by about 80–100% of the
  CSA move**.

## What it found

| | Appraisals |
|:--|:--|
| Used at least one bad comp | **32 of 103** (31%) |
| …a category B sale | 32 |
| …an "other"-type sale | 2 |
| Every comp was bad | **5** (4 homes) |

In the 32 affected appraisals, a median of a third of the comps were bad.

**For the 27 that keep clean comps:**

- **Median CSA move: +2.7%.**
- **21 move up, 2 down.** Non-market sales are cheap, so they drag the
  AVM down.
- **11 move by more than 5%; 6 by more than 10%.** The biggest:

| Area | Type | CSA move |
|:--|:--|:--|
| B24 (Erdington) | flat | **+53%** |
| M3 (Manchester city centre) | flat | **+29%** |
| SW3 | flat | **+21%** |
| S2 (Sheffield) | flat | **+16%** |
| SW6 | flat | **+14%** |
| M1 (Manchester) | flat | **+12%** |

These are mostly **flat blocks**, where bulk and investor sales are common.

**For the 5 with only bad comps**, the fix would send the AVM to sector
comps or to **no valuation**. Today those numbers rest entirely on
non-market sales. Worst case: a TN5 home was valued at **£347k** off an
annex and a company sale, while its neighbours sold for £635k–£1.5m.

One "other" comp was a **£310 sale**. The median shrugged it off this time.

## The fix (when approved)

1. Read `transactionCategory` in `fetchPricePaidLive` and carry it on each
   `PpdTransaction` (`category: 'A' | 'B'`).
2. In `filterComps`, keep **category A only**.
3. In `normaliseType`, map the lowercased labels explicitly
   (`flat-maisonette`, `terraced`, `semi-detached`, `detached`) and return
   **null** for anything else. `filterComps` drops nulls.
4. Tests: one B sale and one "other" sale in a fixture postcode; both must
   be dropped.
5. Log it under "Method changes the backtest must split on" in
   `docs/AVM-BACKTEST.md`. The backtest splits on engine version.

The distance path, the sector path, the offer maths and the weights are all
untouched.

## The case against

- **The overall move is small.** A median of +2.7% is inside the AVM's own
  range. The case rests on the tail (6 moves over 10%, 5 with nothing left),
  not the middle.
- **More "no valuation" results.** Five appraisals would lose every comp.
  That's correct under the "never value without a sale" rule, but more
  leads will show no figure.
- **It muddies the backtest.** Every method change splits the cohort, and
  the first reading is still months away.
- **The fallback is used less now.** Since 11 Oct most appraisals use
  PropertyData radius comps. The 21 Sep batch hit the fallback because
  PropertyData returned nothing for that whole batch (cause not checked).

## Not covered

- **The PropertyData radius path** was not checked for non-market sales.
  It's the main path now, so it is the bigger question.
- **The backtest's own outcome sale** (`pickOutcomeSale`) doesn't filter
  category B either. A repossession sold after our appraisal would count as
  the "true" price. That's a separate fix, but it affects how the AVM is
  judged.
- **Property type from partner sheets** is taken on trust (14 Monarch Court:
  the sheet said terraced; the EPC says maisonette). Not part of this
  change.

---

# Proposal B: the near ring earns its weight

## The ask

**Give the 0.25-mile ring its full 60% weight only when it has 4 or more
sales. Below that, scale it down by count.**

This is the main path now. Proposal A does not touch it.

## The problem

`getDistanceWeightedValuation` in `packages/valuation/src/distance-comps.ts`
splits comps into two rings and blends their medians:

- **Near** (within 0.25 miles): **60%**
- **Far** (0.25 to 0.5 miles): **40%**

The weights are fixed. **One or two sales in the near ring still decide 60%
of the comp figure**, however many sales the far ring has.

**Worked case: Flat 1, 24 Clarendon Rise (SE13), 75 m².**

- Near ring: **2 sales**, median about **£320k**. One is a 49 m² lower flat.
- Far ring: **15 sales**, median about **£450k**.
- Blend: 60% × £320k + 40% × £450k ≈ **£372k**.
- The median of all 17 sales is about **£425k**. A hand valuation (own 2023
  sale, block sales, local £/m²) came out at **£420–450k**.
- All 17 comps are clean, standard flat sales. Proposal A does nothing here.

## How it was measured

- **Cohort:** every radius-path appraisal with its comps stored. That's 41
  appraisals, or **25 after removing exact repeats** (about 23 homes; two
  homes appear twice under different address text).
- The blend was rebuilt from the stored comps (distance and time-adjusted
  price are stored per comp). Ring counts matched the engine's own label
  for **5 of 7** labelled rows. The other 2 were one sale off at the
  0.25-mile edge (distances are stored rounded), and neither is in the
  result below.
- **The tested rule:** near weight = 60% × min(sales, 4) ÷ 4.

| Sales within 0.25 miles | Near weight |
|:--|:--|
| 1 | 15% |
| 2 | 30% |
| 3 | 45% |
| 4 or more | 60% (unchanged) |

- The comp figure plus the bedroom adjustment built on it make up about
  60–100% of the estimate on this path. So **the estimate moves by about
  60–100% of the comp-figure move**.

## What it found

| Sales within 0.25 miles | Appraisals |
|:--|:--|
| 1 | 1 |
| 2 | 6 |
| 3 | 5 |
| 4 or more | 12 |

**12 of 25 appraisals (10 homes)** let 3 or fewer sales carry 60% of the
comp figure.

For those 12:

| | Result |
|:--|:--|
| Typical size of move | **6%** |
| Direction | **7 up, 5 down** |
| Moves over 5% | 6 |
| Moves over 10% | 4 |

The biggest moves:

| Area | Near / far sales | Comp figure moves |
|:--|:--|:--|
| SW3 | 2 / 4 | **+16.7%** |
| W12 | 2 / 5 | **−11.6%** |
| SE13 (Clarendon Rise) | 2 / 15 | **+10.5%** |
| W12 | 3 / 5 | −9.2% |
| SW3 | 3 / 8 | −8.3% |

For Clarendon Rise the comp figure goes from about **£372k to £411k**, and
the estimate to about **£435k**, in line with the hand valuation.

## The fix (when approved)

1. In `distance-comps.ts`, set the near weight to
   `NEAR_WEIGHT × min(nearCount, 4) / 4` and the far weight to the rest,
   when both rings have sales. Keep the one-ring cases as they are.
2. Return the weights actually used (`weighting` already exists).
3. Tests: 2 near + 15 far gets 30/70; 4 near + 15 far stays 60/40; near
   only stays 100%.
4. Log it under "Method changes the backtest must split on" in
   `docs/AVM-BACKTEST.md`.

The confidence ceiling, comp selection, offer maths and triangulation
weights are untouched.

## The case against

- **It isn't proven more accurate.** None of these homes has sold since its
  appraisal. Only Clarendon Rise has an independent check, and that is one
  hand valuation, not a sale. **This proposal rests on reasoning, not on
  measured accuracy.**
- **It cuts noise, not bias.** Moves go both ways, so it won't shift
  values up or down overall. If the AVM leans low, this won't fix it.
- **Nearest sales can be the best evidence.** In a mixed area (W12, SW3),
  two sales on the same street may beat fifteen a quarter-mile away.
  Scaling them down trades that for stability.
- **4 is a judgement call.** It matches the confidence rule of about 4
  sales within half a mile, but no other cut-off was tested.
- **The sample is small and skews prime London.** 25 appraisals, mostly
  SW3, W12 and SW6.
- **It splits the backtest cohort again**, on top of proposal A and the
  UPRN change.

## Not covered

- **Size-adjusting comps.** Clarendon Rise had a floor area for only 2 of
  its 17 comps. A smaller comp still counts at its full price. That is a
  separate, bigger change.
- **The comp window.** Radius comps only go back 12 months, so a home's own
  sale and its block's sales from 2023 are never seen.
- **Comps with no location.** A comp whose postcode can't be geocoded is
  placed at 0 miles, so it lands in the near ring. Only 1 was seen in this
  cohort.
