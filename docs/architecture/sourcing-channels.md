# Sourcing channels — prime & block deal flow

**Status:** first two new channels shipped 2026-08-04 · **Research:** deep-research run, Aug 2026 · **Code:** `packages/auctions/src/sources/allsop.ts`, `packages/scouting/src/receiverships.ts`

## Why new channels

The two-track model (see the Strategy proposal) needs stock the existing
channels under-serve: £700k+ prime refurb candidates and blocks/portfolios.
Deep research (fan-out search + adversarial fact-check) converged on two
channels with hard evidence. Verification note: the fact-check stage was cut
short by an API spend cap — claims are labelled below.

## Channel 1 — Receiverships (SHIPPED: `receiverships.ts`)

Lender-appointed receivers/administrators MUST sell the secured property —
no refurb, no waiting for a better market.

**Verified claims:**
- Appointments are **~2x 2023 and ~3x 2022 levels** and accelerating.
  ([UK Property Forums / NARA data](https://ukpropertyforums.com/rising-receivership-appointments-signal-further-distress-in-the-property-market/))
- **65% of appointments are residential** — this is a housing channel.

**Sourced, not yet independently verified:**
- 865 receiver/liquidator/administrator lots sold at UK auction in 12 months
  (£277m, up ~45% YoY). ([Estates Gazette / EIG](https://www.estatesgazette.co.uk/news/auctions-and-insolvencies-for-what-we-are-about-to-receive/))
- Distress is concentrated in **prime central London residential and
  part-built schemes** (per a licensed insolvency practitioner, same source).
- Receivers prioritise a quick sale → structurally favours a chain-free cash
  buyer. ([Farrer & Co](https://www.farrer.co.uk/news-and-insights/buying-a-house-from-receivers/))
- Land Registry / court backlogs create a **lag between appointment and
  sale** — the window where a direct approach beats the auction catalogue.

**How the pipe works:** Gazette corporate-insolvency notices (appointment of
receivers 2453 / administrators 2452) → company number → Companies House
charge particulars → UK property addresses → `ScoutLead` with
`leadType: receivership` (scores 19/20 on acquisition — just below probate).
Runs inside the daily scouting cron; health-reported like every source.

**Legal caveat (per Farrer):** the receiver's appointment must be validated
before purchase — an invalid appointment can void the sale. Flag for the
conveyancing checklist on receivership deals.

**Buying process quirks** ([Farrer & Co](https://www.farrer.co.uk/news-and-insights/buying-a-house-from-receivers/)):
sold as seen with limited title guarantee; the receiver answers no enquiries
(our viewing report + searches carry the diligence load); occupiers/tenants
are the buyer's problem; speed and certainty win the deal.

**Tax levers on this stock** (NOT advice — confirm per deal with the
accountant; conditions are strict):
- **6+ dwellings in one transaction** → non-residential SDLT rates (max 5%)
  instead of residential + company surcharge. Big on blocks.
  ([source](https://www.property-tax-advice.co.uk/knowledge-centre/six-or-more-dwellings-and-sdlt-when-residential-property-is-taxed-at-commercial-rates/))
- **Company buying a dwelling >£500k** defaults to the punitive **15% flat
  SDLT** — but **property developer/trader relief** disapplies it when the
  purchase is exclusively for redevelopment + resale in a property trade
  (our prime track). ([Keystone](https://keystonelaw.com/keynotes/sdlt-and-ated-what-reliefs-are-available/))
- **5% VAT (not 20%)** on renovating a dwelling **empty 2+ years** —
  receivership/probate stock often qualifies. Evidence: council Empty
  Property Officer letter, obtained BEFORE works start (HMRC Notice 708).
- **MDR was abolished June 2024** — never rely on it.
- SPV share purchases (0.5% stamp duty, no SDLT) occasionally available on
  portfolio sales — inherit liabilities, forensic diligence required.

## Channel 2 — Allsop auctions (SHIPPED: `sources/allsop.ts`)

**Verified claims:**
- A single Allsop residential catalogue = **344 lots** (largest of the year) —
  all previously invisible to us (we only scanned Auction House UK).
  ([Allsop](https://www.allsop.co.uk/insights/allsop-releases-344-lot-catalogue-for-june-residential-auction/))
- Catalogues carry **whole London blocks**: a freehold block of 18 flats in
  Finsbury Park guided £1.6m+ (<£90k/unit).

**Sourced, not yet independently verified:** a Greenwich mixed-use building
with 10 flats (£1.65m+) and a Chiswick Grade II conversion candidate
(£1.5m+) in the same sale; sales run fully online with catalogues published
digitally in advance.

**How the pipe works:** new source in `@repo/auctions` (JSON-LD first, CSS
fallback, same honest-empty contract as Auction House UK). Lots flow through
the existing Monday auction-scan → vision screen → track classification →
prime/block FounderAction. First production run may need selector tuning —
watch `[auctions/allsop]` log lines.

**Coverage caveat (from the research):** vendor-type filters miss
mortgagee-in-possession lots — we scan whole catalogues, so this doesn't
bite us, but never "optimise" to vendor-tag filtering.

## Channel 3 — Back-on-market listings (SHIPPED 2026-08-04)

A sale that fell through is a vendor who already chose to sell, now stuck.
PropertyData's `back-on-market` sourcing list was already mapped to
`chain_break` in `lead-type.ts` but sat outside the default list slice —
now included (7th list, one extra API call per seed per run). Zero new code.

## Verification status

**Gazette insolvency feed: VERIFIED live 2026-08-05** (founder browser
probe; the dev sandbox's egress is blocked by The Gazette). The response is
checked in as
`packages/scouting/src/__tests__/fixtures/gazette-insolvency-live-2026-08-05.json`
and locked by `receiverships.test.ts`. Hard-won contract facts:

- **Never send a `noticecode` filter on this feed** — a wrong code value
  500s the search backend (bare `{"status":"500"}`). Real corporate codes
  seen live: 2442 Meetings of Creditors, 2443 Appointment of Liquidators.
  The scanner filters client-side on `category['@term']` instead.
- Entry `title` = company name; the **company number is in `content`** in
  two shapes ("(Company Number 11416317 )" / "Company Number: 09184913").
- PowerShell's Invoke-RestMethod gets 500s from this API even on valid
  URLs — verify with a browser or real curl, never PowerShell.

Companies House side: same key + auth convention as the working charges
source; end-to-end confirmation after deploy:

```sh
curl -X POST https://bellwood-api.vercel.app/cron/scout-debug \
  -H "Authorization: Bearer $CRON_SECRET" | jq '.sourceHealth'
```

## Channel 4 — Stalled consents via the brownfield register (SHIPPED 2026-08-05)

Every council must publish a brownfield land register. Live entries carry
`site-address` (with postcode), `point`, `planning-permission-status`,
`planning-permission-date` and net-dwelling counts — **verified by founder
browser probe 2026-08-05** (fixture:
`__tests__/fixtures/planning-brownfield-live-2026-08-05.json`, locked by
`planning-consents.test.ts`). A site that is `permissioned`, 18+ months past
grant, and still on the register (no `end-date`) is a stalled scheme — an
owner who paid for a consent they haven't built. Consents lapse 3 years
after grant (s.91 TCPA 1990), so the pressure is dated.

`packages/scouting/src/planning-consents.ts` walks the ~37.5k-row dataset
**weekly (Wednesdays)** via `links.next` pagination (free API, no key), and
self-reports `skipped` on other days so health never reads dark. New
leadType `lapsing_consent` (12 pts); the summary carries the dwelling count
so multi-unit sites classify as **block** automatically. The
`planning-application` dataset also proved rich for participating boroughs
(Camden publishes address + decision per application) — a per-borough
application-level scan is a possible sharpening later.

## The plan — next channels (in priority order)

1. **Savills / Clive Emson auction parsers** — stubs today; blocks skew to
   regional houses (Clive Emson = southern England, our patch).
3. **Ground-rent / freehold block portfolios** — the draft Commonhold and
   Leasehold Reform Bill (Jan 2026) caps ground rents at £250 →
   peppercorn, expected in force ~2028. Institutional freeholders become
   motivated sellers of exactly our block stock over the next 1–2 years.
   No data feed — a relationship channel (approach ground-rent funds
   directly). Founder action, not code.
4. **Probate solicitor partnerships** — relationship channel; pairs with
   the marketer-monthly solicitor outreach cron.

Researched and consciously dropped: bridging-defaults (no public data;
enforcement funnels into receiverships/auctions which we now cover),
divorce/matrimonial and HNW networks (not automatable), Land Registry
corporate-owner mining (heavy lift, unproven yield).
