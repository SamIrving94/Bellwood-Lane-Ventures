# PropertyData API — condensed reference

_Condensed from PropertyData's own AI-readable documentation page, generated
2026-09-13 (69 endpoints). The full interactive docs are at
propertydata.co.uk/api/documentation. This copy exists so a session can check
whether an endpoint exists and what it costs **without** guessing. It carries
no response shapes — those still come only from a real captured response
(`scripts/propertydata-probe.mts`; see docs/LEARNINGS.md 2026-09-12)._

## Basics

- **Base URL:** `https://api.propertydata.co.uk`
- **Auth:** `Authorization: Bearer <key>` (what we send), `X-API-Key: <key>`,
  or `?key=` — one request, one key.
- **Method:** GET, except `/george` and `/plan-analysis` (POST JSON).
- **Rate limit:** per ACCOUNT across all keys, 12–72 requests per 30 s by plan.
  429 = X14; wait the `Retry-After` seconds. 503 = X20 (server busy), same.
- **Credits:** charged on a successful response or a 404 (X08, "no data for
  these inputs"). Every other error — invalid input, throttling, 5xx — is free.
- **Response envelope:** `{"status":"success", …, "process_time":"0.45"}`;
  errors `{"status":"error","code":"X07","message":"Invalid input: postcode"}`.

## Error codes

| Code | HTTP | Meaning |
|:--|:--|:--|
| X01 | 400 | Invalid endpoint |
| X02 / X03 | 400 / 422 | Missing / invalid key |
| X04 | 403 | Plan credit limit exceeded |
| X06 / X07 | 400 / 422 | Missing / invalid postcode (X07A location, X07C town) |
| X07D | 400 | More than one location input given |
| X08 | 404 | Insufficient data for this location (**charged**) |
| X09 | 500 | Uncaught exception |
| X13 | 403 | Free-trial credit cap |
| X14 | 429 | Rate limit — honour `Retry-After` |
| X19 | 502 | Third-party source down, retry later |
| X20 | 503 | Server busy — honour `Retry-After` (~60 s) |

## Licensing and caching (the part that binds us)

- **Hold a response as current data for at most 60 days from retrieval**, then
  delete or refresh. No plan, price or separate licence extends this. Our
  client clamps every TTL to 60 days and evicts older durable rows on read.
- **May be kept indefinitely**, provided it is marked as a dated historical
  observation and never used to answer a question about the present: dated
  snapshots per property (our `AvmSnapshot`, a lead's `snapshot` with
  `fetchedAt`), reports already produced, events derived by comparing calls
  ("price reduced"), aggregates and our own scores, provenance, identifiers.
- **May not** republish the data as a dataset, feed or API of our own, or
  build a searchable copy others query instead of subscribing.
- Customer-facing, multi-tenant, paid use is permitted on every plan. No
  attribution required for API use. Listing URLs are PropertyData forwarding
  links and may be shown; listing photographs are third-party.
- Title ownership responses contain personal data — we are the controller.

## Location inputs

Exactly one of `postcode` (full, district or sector), `location` (lat,lng),
`w3w`, `town`. Not every endpoint takes every kind — see the table.

## Endpoints we call

| Endpoint | Credits | Location inputs | Our wrapper |
|:--|:--|:--|:--|
| `/agents` | 1 | postcode, location, w3w, town | `getAgentsByPostcode` |
| `/council-tax` | 1 | postcode | `getCouncilTax` |
| `/demand` | 1 | postcode, location, w3w, town | `getMarketDemand` |
| `/demographics` | 1 | postcode, location, w3w, town | `getDemographics` (unprobed) |
| `/energy-efficiency` | 1 | full postcode | `getEpcByPostcode` |
| `/flood-risk` | 1 | postcode, location, w3w (England; rivers/sea) | `getFloodRisk` |
| `/floor-areas` | 1 | full postcode | `getFloorAreas` |
| `/freeholds` | 1 per 10 results | postcode, location, w3w | `getFreeholdTitles` |
| `/george` | 10 (POST) | — | `askGeorge` |
| `/growth` | 1 | postcode, location, w3w, town | `getGrowth` |
| `/national-hmo-register` | 1 per 10 results | postcode, location, w3w | `getHmoRegister` (unprobed) |
| `/planning-applications` | 1 per 10 results | postcode, location, w3w | `getPlanningApplications` (unprobed) |
| `/prices-per-sqf` | 1 | postcode, location, w3w, town | `getPricesPerSqf` |
| `/sold-prices` | 1 | postcode, location, w3w, town | `getSoldPrices` |
| `/sourced-properties` | 1 per 10 results | postcode, location, w3w | `getSourcedProperties` (unprobed) |
| `/valuation-sale` | 1 | postcode | `getPropertyDataValuation` (unprobed; needs `construction_date`) |
| `/yields` | 1 | postcode, location, w3w, town | `getYields` |
| `/account/credits` | free | — | `getAccountCredits` |

**Not an endpoint:** `/listings`. It was in the code until 2026-10-03 with no
callers; removed.

## Endpoints we do not call yet (worth knowing)

| Endpoint | Credits | What | Why it might matter |
|:--|:--|:--|:--|
| `/title` | 1 | Address, type, ownership and lease info by title number | **Per-address tenure / lease length** — the source `/freeholds` turned out not to be |
| `/uprn-title` | 1 | Title number from a UPRN | Step before `/title` |
| `/uprns` | 1 per 10 | UPRNs in a postcode | Step before `/uprn-title` |
| `/uprn` | 10 | Property information from a UPRN | Expensive; probe before relying on it |
| `/address-match-uprn` | 10 | Address → closest UPRN | Expensive |
| `/sold-prices-per-sqf` | 1 | Sold £/sqft | Stronger AVM benchmark than asking £/sqft |
| `/rents`, `/rents-hmo` | 1 | Live asking rents | Evidence behind the yield figure |
| `/demand-rent` | 1 | Rental demand | — |
| `/growth-psf` | 1 | Growth per sq ft | — |
| `/valuation-rent`, `/valuation-hmo`, `/valuation-historical` | 1 | Other valuations | Historical could feed the backtest |
| `/prices` | 1 | Live local asking prices | — |
| `/tenure-types`, `/property-types` | 1 | ONS stock breakdown by tenure / type | Area-level only |
| `/rebuild-cost`, `/build-cost`, `/development-gdv`, `/development-calculator` | 1 | Cost and development maths | Refurb / development |
| `/stamp-duty-calculator`, `/mortgage-calculator`, `/mortgage-rates`, `/lha-rate` | 1 | Calculators and rates | — |
| `/crime`, `/schools`, `/restaurants`, `/internet-speed`, `/politics`, `/population`, `/household-income`, `/area-type`, `/ptal` | 1 | Area colour | — |
| `/aonb`, `/conservation-area`, `/green-belt`, `/national-park`, `/listed-buildings` | 1 | Planning constraints | — |
| `/buildings` | 70 | Building data for a title | Very expensive |
| `/postcode-key-stats` | 30 | Key stats for every district in a region | Expensive |
| `/titles-by-company` | 1 per 50 | Titles by company ownership | Companies House cross-reference |
| `/land-registry-documents`, `/site-plan-documents`, `/account/documents` | 1 / 1 / free | Document purchase | — |
| `/sourced-property` | 1 | One sourced property's detail | — |
| `/national-data` | 1 | National market indicators | — |
| `/rents-commercial`, `/valuation-commercial-sale`, `/valuation-commercial-rent` | 1 | Commercial | Out of scope |
| `/title-use-class` | 1 | Predicted planning use class | — |
| `/plan-analysis` | 1 (POST) | Floor-plan cost breakdown | — |
