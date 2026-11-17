# The AVM backtest: how we know if the valuation engine is any good

_Last verified against the code: 2026-10-21._

The Sep 2026 review (`docs/research/scout-appraisal-review-2026-09.md`)
said the AVM should not change again until it is measured. This is the
measurement. It answers one question, monthly, with real sales: **when
the engine said £X, what did the house actually sell for?**

## The loop

1. **Freeze.** Every `runAVM` call site saves an `AvmSnapshot` the moment
   the number is produced: the input, the full result, the point estimate,
   the range, the offer, the confidence label, the comps path, the engine's
   git sha and the offer-config version. The appraisal fields are never
   edited afterwards. Call sites: `pipeline-appraise` and `lead-appraise`
   crons, the deal "Generate offer" and lead "Appraise" actions, the admin
   backfill and batch appraiser, and the public quote route (through the
   `onAvm` hook on `generateInstantOffer`, so the AVM payload never rides on
   the public response).
2. **Match.** `/cron/avm-backtest` runs on the 28th of each month at 06:00
   UTC, after HM Land Registry publishes the previous month's Price Paid
   Data. For every pending snapshot it pulls that postcode's sales (free
   API, one call per postcode, 250 postcodes per run, 300 ms apart) and
   looks for the **first sale after the appraisal date** at the **same
   house**. Matching reuses the scout's address normaliser: a confident
   score (≥ 0.85) is required, so 12 never pairs with 12A or Flat 12.
3. **Exclude.** Properties we bought (a deal that exchanged or completed
   at that address) are marked `excluded`. Our purchase price is a
   discounted deal, not market value. The resale-based test for those
   deals stays in `scripts/avm-backtest.mts`.
4. **Expire.** A snapshot still unsold 18 months after the appraisal is
   marked `expired`. A sale later than that is a different test.
5. **Report.** The whole matched cohort is rolled up and stored as an
   `AgentEvent` (`avm_backtest`), one deduped founder card is refreshed
   for the month, and the dashboard page reads the latest event.

## What the numbers mean

| Metric | Meaning | Read it as |
|:--|:--|:--|
| Median error (MdAPE) | Half the estimates were closer than this | The headline. Target under 8% |
| Mean error (MAPE) | Average miss, dragged by wild ones | Compare with the median; a big gap means a fat tail |
| Median bias | Where the typical estimate sits vs the sale | Positive leans high. Negative leans low |
| Within 10% / 20% | Share of estimates that close | Industry PE10 / PE20 |
| Range caught the sale | Share of sales inside the low–high range | The range is labelled "80%". If this reads 50%, the label is wrong |

Segments: confidence label, comps path (radius comps / postcode comps /
no comps), source (scout lead / deal / quote / batch / backfill), sale
price band, property type, engine version, floor-area source.

The floor-area segment (`byFloorAreaSource` in the stored rollup) reads
`resultJson.floorAreaSource` off each frozen snapshot:

| Label | Meaning |
|:--|:--|
| `epc_uprn` | Sized from the home's own EPC certificate, by UPRN (from 18 Oct 2026) |
| `propertydata` | Sized by an address match. Before 18 Oct 2026 a leading-house-number match; after, a strict same-home match |
| `caller` | Someone typed the size in |
| `none` | The engine ran with no verified size (`null`) |
| `unknown` | Field missing or not one of the above. Kept apart from `none` on purpose |

Rollups stored before 21 Oct 2026 have no `byFloorAreaSource`; the
dashboard table appears from the next monthly run.

## Sample-size honesty

- Under **30** matched sales: no verdict. The card says "too few".
- Under **200**: directional only.
- A **segment** needs about **100** sales before it means anything
  (`MIN_SAMPLE_FOR_SEGMENT`). The dashboard greys out any segment row
  under 100 and marks it "too few".
- The first matches land a few months after the first snapshots. A sale
  takes months to complete and register.

## Where to look

- Dashboard: **AVM accuracy** in the sidebar (`/appraisals/backtest`).
- Founder card: one per month, `avm-backtest:<yyyy-mm>`.
- Manual run: `POST https://bellwood-api.vercel.app/cron/avm-backtest`
  with `Authorization: Bearer $CRON_SECRET`.
- Watchdog: heartbeat `avm-backtest`, alert after 35 days of silence.

## Method changes the backtest must split on

- **18 Oct 2026: floor area from the home's own EPC certificate (by UPRN).**
  Snapshots from then on carry `floorAreaSource: 'epc_uprn'` when that path
  sized the home (else `propertydata` with the strict address match, or
  `caller`). Compare cohorts by engine version (before vs after this commit)
  and by the floor-area segment. Read `epc_uprn` against `propertydata`
  only once each has about 100 matched sales; until then the table is a
  count, not a verdict. `propertydata` mixes the old loose match and the
  new strict one, so pair it with the engine version. Why it was allowed during the freeze: see
  CLAUDE.md, "One override, on measured evidence".
- **25 Oct 2026: size-led blend.** On the radius path, with the subject's
  size known and 4+ comps sized, the £/sqft estimate carries 70%, and
  comps are sized from the EPC register. Those snapshots carry
  `+sqft_led(n)` in `avmSources` and `sqftEvidence.sizeLed: true`; split
  on that and on engine version. Measured before shipping on the hold-out
  (`scripts/avm-holdout.mts`): 209 real sales, median error 15.6% →
  12.3%. The backtest is still the real verdict.

## Before the backtest reads: the hold-out

`scripts/avm-holdout.mts` values real recent sales as of just before each
sold (comps from the 12 months before, never the sale itself or later
ones), using free Land Registry, postcodes.io and EPC register data, and
reports median error per method variant. It models the radius method; it
does not call production (no PropertyData comps, no bedroom filter, no
external AVM). Use it to compare a proposed change against today before
it ships; the backtest then confirms on our own appraisals.

## Rules

- **Every new `runAVM` call site must call `saveAvmSnapshot`.** An
  appraisal that is not frozen cannot be judged.
- **Never edit the frozen fields.** Only the outcome columns are appended.
- **Never loosen the match to fuzzy.** A wrong house's price against our
  estimate poisons the one metric this exists to protect.
- **Judge an engine version against its own rows.** The engine-version
  segment is how a change is measured: ship it, wait, compare.

## Key files

| What | Where |
|:--|:--|
| Model | `packages/database/prisma/schema.prisma` → `AvmSnapshot` |
| Freeze helper | `packages/valuation/src/backtest-snapshot.ts` |
| Scorer (MdAPE, bias, PE10/20, coverage) | `packages/valuation/src/backtest.ts` |
| Matcher + report roll-up | `apps/api/app/cron/_lib/avm-backtest.ts` |
| Cron | `apps/api/app/cron/avm-backtest/route.ts`, schedule in `apps/api/vercel.json` |
| Dashboard | `apps/app/app/(authenticated)/appraisals/backtest/page.tsx` |
| Tests | `packages/valuation/src/__tests__/backtest*.test.ts`, `apps/api/__tests__/avm-backtest.test.ts` |
