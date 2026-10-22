# Proposal: two comp-filter fixes on the Land Registry fallback

_Status: **proposed, not built.** Needs a founder yes to lift the AVM freeze
for this one change._
_Measured: 2026-10-22, read-only against production._

## The ask

The AVM method is frozen until the backtest reads (CLAUDE.md). The one
exception so far was the EPC-by-UPRN floor area (18 Oct), allowed because
it was **measured first**. This note asks for a second exception, on the
same terms.

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
