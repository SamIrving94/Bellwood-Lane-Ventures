# The AVM backtest: how we know if the valuation engine is any good

_Last verified against the code: 2026-09-12._

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
price band, property type, engine version.

## Sample-size honesty

- Under **30** matched sales: no verdict. The card says "too few".
- Under **200**: directional only.
- A **segment** needs about **100** sales before it means anything.
- The first matches land a few months after the first snapshots. A sale
  takes months to complete and register.

## Where to look

- Dashboard: **AVM accuracy** in the sidebar (`/appraisals/backtest`).
- Founder card: one per month, `avm-backtest:<yyyy-mm>`.
- Manual run: `POST https://bellwood-api.vercel.app/cron/avm-backtest`
  with `Authorization: Bearer $CRON_SECRET`.
- Watchdog: heartbeat `avm-backtest`, alert after 35 days of silence.

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
