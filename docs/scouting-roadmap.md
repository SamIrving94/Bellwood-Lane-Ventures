# Scouting Roadmap — Real Lead Sources for Bellwood Ventures

**Last updated:** 8 May 2026
**Owner:** Engineer agent (drives sourcing) · CEO (approves spend)

---

## Where we are

The daily scouting cron (`apps/api/app/cron/scouting/`) now pulls from three sources in parallel:

| Source | Status | Cost | Coverage |
|---|---|---|---|
| `HMCTS Probate API` | **Placeholder — returns `[]`** | — | — |
| `The Gazette` | ✅ Live, free | £0 | UK probate notices over £5k estate (legal requirement) |
| `PropertyData /sourced-properties` | ✅ Live, paid | ~3 credits/postcode/day | Distressed listings (probate, repos, BMV) |

Synthetic-fallback data has been disabled in production (commit `0093e6e`, 8 May 2026). The DB was purged of 100 fabricated rows on the same day.

---

## The HMCTS placeholder — context

`packages/scouting/src/probate-data.ts` was scaffolded against `https://api.probate.service.gov.uk/search/grants` — **this endpoint does not exist publicly**. HM Courts & Tribunals Service runs the [probate search service](https://probatesearch.service.gov.uk/) at £1.50/search through a web UI; there is no public bulk/JSON API.

The original developer left a TODO. Until/unless HMCTS releases an API, this source returns an empty array. **Do not re-enable a synthetic fallback** — it pollutes the DB and the founder dashboard.

---

## Source 1 — The Gazette (live, free)

**Module:** `packages/scouting/src/gazette.ts`
**Function:** `fetchGazetteProbateNotices(sinceDays, limit, service)`

The Gazette is the UK government's official journal of public notices. Probate notices over £5k estate are **legally required** to be published there under the Trustee Act 1925, s.27. Notices include the deceased's last address (often the property!), date of death, and solicitor handling the estate.

- **Endpoint:** `https://www.thegazette.co.uk/all-notices/notice/data.json`
- **Auth:** none — public API
- **Coverage:** ~70% of UK estates with property assets
- **Cost:** £0
- **Cadence:** Daily — Gazette publishes new notices every working day

### Defensive parsing

The API's exact response shape isn't fully documented and varies by notice type. The client tries multiple field paths (entry/items/notices, deceased.address vs notice text, etc) and falls back to a regex address extractor for free-text notices. **First production runs will produce some parse failures** — Engineer should grep Vercel logs for `[scouting/gazette]` lines and tune `parseNotice()` based on real responses.

### Limitations

- Notices don't always include a property address (sometimes just "the deceased's estate")
- ~1-3 week lag between grant of probate and Gazette publication
- Coverage is voluntary in some cases (smaller estates skip publishing)

### Quality bar

Expected real flow: 5–15 notices per day with usable property addresses. Many will be lower-value or out-of-area; expect ~20–30% to score ≥ 70 once enriched.

---

## Source 2 — PropertyData `/sourced-properties` (live, paid)

**Module:** `packages/property-data/src/propertydata.ts`
**Function:** `getSourcedProperties(postcode)`

PropertyData curates distressed property listings from across UK property portals. The `/sourced-properties` endpoint returns:

- Probate sales currently listed
- Repossession listings
- Below-market-value distressed listings

The wrapper is postcode-scoped — the cron hits it once per target postcode (defaults to `AGENT_PROSPECTING_POSTCODES` env var, same patch as the Marketer's Monday prospecting cron).

- **Endpoint:** `https://api.propertydata.co.uk/sourced-properties`
- **Auth:** `PROPERTYDATA_API_KEY`
- **Cost:** ~3 credits per postcode per call
- **TTL:** 24 hours per postcode
- **At 16 postcodes daily:** ~48 credits/day = ~1,440 credits/month (within the 5k plan)

### Quality bar

Higher-quality leads than The Gazette — these are already-listed properties, so the vendor is actively trying to sell. Expected flow: 2–10 new distressed listings per postcode per week. Across 16 postcodes that's 30–150/week.

---

## Source 3 — HMCTS (deferred)

**Status:** placeholder, returns `[]`
**Module:** `packages/scouting/src/probate-data.ts`

Until/unless HMCTS releases a public API, leave this stubbed. If you ever need to enable it:

1. Find a real provider (commercial only — Probate Data Online, Smartr, EstateSearch)
2. Update `fetchProbateGrantsLive()` to call the provider's API
3. Set the env var (e.g. rename `HMCTS_PROBATE_API_KEY` to `PROBATE_DATA_ONLINE_API_KEY`)
4. Update `source` field in the returned ProbateLead

Commercial probate APIs run £400–£800/month. **Don't pay until Phase 1 deal volume justifies it.** The Gazette + PropertyData together should produce 50+ qualified leads/week — sufficient for Phase 1.

---

## Source 4 — The strategic answer (always-on)

The most reliable lead source is **agents pushing fall-throughs via `/save-the-sale`**. That's running independently of this cron and produces Founder Actions immediately on submission.

The daily scout exists to keep the funnel topped up between agent-driven submissions. **Don't optimise the scout at the expense of agent prospecting.**

---

## What "good" looks like 90 days from now

| Metric | Target | How |
|---|---|---|
| Real leads / week (cron) | 50+ | Gazette + PropertyData firing reliably |
| Score ≥ 70 / week (cron) | 10–20 | After enrichment + scoring |
| Founder Actions / week from cron | 1–2 (`review_leads`) | Auto-created when ≥ 1 lead scores ≥ 70 |
| Cron run reliability | 100% | Vercel cron + alert on failure |
| Synthetic leads in DB | 0 | Permanently |
| Credit usage / month (PropertyData) | < 2,000 | 5k plan headroom |

---

## Operational checklist for Engineer agent

1. **Watch Vercel logs daily** for `[scouting/...]` warnings — first week is parse-tuning territory for The Gazette
2. **Confirm `PROPERTYDATA_API_KEY` is set on `bellwood-api`** (it is — confirmed 7 May 2026)
3. **Confirm `AGENT_PROSPECTING_POSTCODES` is set** to the target patch — drives both the prospecting cron AND the sourced-properties source
4. **If credit usage exceeds 80% of 5k**, raise a `medium` FounderAction
5. **Quarterly review**: is the cron producing real leads? If under 5 score-≥-70 leads/week, escalate to CEO with a recommendation (commercial API, expand postcodes, etc.)
