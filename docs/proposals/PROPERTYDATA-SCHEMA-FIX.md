# PropertyData: fix the eleven broken endpoints

_Written 2026-09-12 from production logs. Run the prompt at the bottom in a
local Claude Code session (needs `PROPERTYDATA_API_KEY` and internet)._

## Report — what is wrong, in plain terms

**Eleven PropertyData endpoints have never returned a value to the app.**
Every call ends in the same log line on `bellwood-api`:

```
[propertydata] /demand SCHEMA DRIFT — response validated but carries none of the
expected fields. Not cached. Top-level keys: status, postcode, postcode_type,
radius, total_for_sale, average_sales_per_month, turnover_per_month,
months_of_inventory, days_on_market, demand_rating, process_time
```

**Why.** Our code reads every field from a `result` object:

```ts
// what the code expects
{ status, result: { sales_demand_score, days_on_market_average } }
```

The API does not send a `result` object. It sends the fields **at the top
level** or under **`data`**. The two shapes never matched. The drift guard
(added with the durable cache) is doing its job by refusing hollow data.

**Cost.** Each cron run still pays the credits for all eleven calls
(about 25 credits a run) and gets nothing back.

**What is silently missing from the product because of this:**

| Endpoint | Feeds | Read by |
|:--|:--|:--|
| `/sold-prices` | **AVM comps** (distance-weighted) | `packages/valuation/src/distance-comps.ts` |
| `/floor-areas` | AVM floor area when the form has none | `packages/valuation/src/base-valuation.ts` |
| `/demand` | Demand rating on batch rows, lead appraise | `apps/app/lib/batch/signals.ts`, lead-appraise cron |
| `/flood-risk` | Flood flag on batch rows, lead appraise | same |
| `/yields` | Gross yield on batch rows | same |
| `/growth` | Trend adjustment in the appraiser | lead-appraise cron |
| `/agents` | Agent prospecting list | `apps/api/app/cron/agent-prospecting/route.ts` |
| `/freeholds` | Short-lease scouting, tenure on appraisal | `packages/scouting/src/short-lease.ts` |
| `/energy-efficiency` | EPC rating by postcode | lead-appraise cron |
| `/prices-per-sqf` | £/sqft benchmark | lead-appraise cron |
| `/council-tax` | Council tax band | lead-appraise cron |

The top-level keys we already know from the logs (inner shapes unknown):

| Endpoint | Top-level keys the API actually sent |
|:--|:--|
| `/demand` | `total_for_sale, average_sales_per_month, turnover_per_month, months_of_inventory, days_on_market, demand_rating` |
| `/flood-risk` | `flood_risk` |
| `/agents` | `radius, data` |
| `/sold-prices` | `url, max_age, data` (also `bedrooms, type` when filtered) |
| `/yields` | `url, data` |
| `/growth` | `url, data` |
| `/council-tax` | `council, council_rating, year, council_tax, note, properties` |
| `/floor-areas` | `known_floor_areas` |
| `/prices-per-sqf` | `url, data` |
| `/freeholds` | `url, result_count, api_calls_cost, data` |
| `/energy-efficiency` | `energy_efficiency` |

**Why it was not fixed in PR #111.** The build sandbox cannot reach
propertydata.co.uk. What is *inside* `data` cannot be read from the logs.
Writing schemas from memory is exactly how this happened (CLAUDE.md:
never fabricate identifiers). The fix has to start from saved real
responses. The probe script that captures them is in the PR.

**Cost of the fix.** About 30 credits (one call per endpoint) plus the
tests, which run offline against the saved responses forever after.

---

## Prompt — paste this into Claude Code on your machine

```
Fix the eleven PropertyData endpoints whose Zod schemas read a `result`
object the API does not return. Work from REAL responses only. Never guess a
field name. Read docs/proposals/PROPERTYDATA-SCHEMA-FIX.md and
docs/LEARNINGS.md (entry 2026-09-12 "PropertyData") first.

STEP 1 — capture real responses (about 30 credits, once).
  Confirm PROPERTYDATA_API_KEY is in apps/api/.env.local, then run:
    pnpm tsx scripts/propertydata-probe.mts --postcode "DL2 3JP"
  If an endpoint returns an empty array for that postcode, re-run just that
  endpoint with a denser postcode, e.g.
    pnpm tsx scripts/propertydata-probe.mts --postcode "SW11 1AA" --endpoints agents,sold-prices
  The raw JSON lands in scratch/propertydata-probe/<endpoint>.json (gitignored).
  Show me the printed shape for every endpoint before you change any code.

STEP 2 — for each endpoint, in packages/property-data/src/propertydata.ts:
  - Rewrite the Zod schema to the REAL shape from the saved file. Keep it
    tolerant (.partial(), .optional(), .passthrough()) so a new optional
    field upstream cannot break us, but every field we READ must be one that
    exists in the saved response.
  - Rewrite `hasContent` to name a field the saved response actually carries.
  - Rewrite the reader (the code after fetchPropertyData that maps the
    response into our typed reading, e.g. readGrowth, getYields, getCouncilTax)
    so it reads from the real path.
  - Keep the public return types (GrowthReading, YieldsReading,
    SoldPrices, TenureReading, EpcReading, etc.) unchanged so callers do
    not change. Pence stay integers.
  - Units: check every money field is pounds before ×100. Check floor
    area is m² (EPC register) and £/sqft is sqft. Note anything unclear in
    a comment; do not convert on a hunch (see LEARNINGS 2026-08 on
    /valuation-sale internal_area).
  Endpoints: /demand, /flood-risk, /agents, /sold-prices, /yields, /growth,
  /council-tax, /floor-areas, /prices-per-sqf, /freeholds, /energy-efficiency.

STEP 3 — callers that reach into the raw shape. Fix these to use the typed
  readers instead of `.result`:
  - apps/app/lib/batch/signals.ts (reads floodRes.value?.result and
    demandRes.value?.result)
  - apps/api/app/cron/agent-prospecting/route.ts around line 126 (reads
    .result.agents)
  Then grep for `\.result` and `result?.` across apps/ and packages/ to catch
  any other consumer of these eleven endpoints.

STEP 4 — tests. For every endpoint add a fixture test in
  packages/property-data/src/__tests__/ that feeds the SAVED response
  (copy the JSON into the test, redact street names and phone numbers,
  keep the structure and value types exactly) through the getter and
  asserts the typed reading. Update
  packages/property-data/src/__tests__/failure-model.test.ts, whose
  fixtures use the old `result:` shape. Keep the drift guard: add one test
  proving an old-shape body still reports schema drift and is not cached.

STEP 5 — verify.
  pnpm --filter @repo/property-data test
  pnpm --filter @repo/valuation test
  pnpm --filter api test && pnpm --filter app test
  Then, from packages/property-data, run tsc --noEmit. All green before you
  push.

STEP 6 — live check (a few credits). Run the batch tool path once:
  call apps/app/lib/batch/signals.ts fetchBatchSignals("DL2 3JP") via a
  small tsx one-off, and confirm floodRisk, demandRating and grossYieldPct
  come back non-null. Then trigger one AVM (runAVM) for the same postcode
  and confirm comparableCount > 0 from /sold-prices.

STEP 7 — report back to me in this format, short lines, bullets:
  - Per endpoint: real shape (one line), what changed, fixture test name.
  - Any field whose unit or meaning you could not confirm.
  - Credits spent.
  - Anything still returning empty for the probe postcode.
  Add a dated entry at the top of docs/LEARNINGS.md and a What's New entry
  in apps/app/lib/whats-new.ts ("Flood, demand, yield and sold comps now
  live on batch rows"). Commit on a new branch from master, push, open a
  draft PR.

Rules: never write a schema field you have not seen in a saved response.
If an endpoint returns HTML or 404, say so and leave that endpoint on the
"unavailable" path with a clear log line; do not stub it.
```

## After it is done — what to check yourself

- Upload the pipeline sheet again. **Flood**, **Demand** and **Yield**
  columns should fill in.
- `/admin/llm-usage` is unrelated; the place to look is the api logs:
  the `SCHEMA DRIFT` lines must stop.
- Credits per cron run should drop, because the responses now cache.
