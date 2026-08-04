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

## Verification status (do this once in prod)

The dev sandbox's egress is allow-listed, so The Gazette and
planning.data.gov.uk both 403 from here — the receivership feed contract
could not be live-verified before shipping. It follows the SAME documented
contract as the probate feed (verified live from prod 2026-07-30, fixture
checked in). To verify after deploy:

```sh
# 1. Full pipeline with per-source breakdown (receivership appears in
#    sourceHealth with a count or a real error):
curl -X POST https://bellwood-api.vercel.app/cron/scout-debug \
  -H "Authorization: Bearer $CRON_SECRET" | jq '.sourceHealth'

# 2. Raw feed shape (run from any machine with open egress):
curl -sS -H 'Accept: application/json' \
  'https://www.thegazette.co.uk/insolvency/notice/data.json?noticecode=2453&results-page=1&results-page-size=3'
```

If notice titles don't carry "(Company Number NNNNNNNN)", tune
`COMPANY_NUMBER_REGEX` / `BARE_NUMBER_REGEX` in
`packages/scouting/src/receiverships.ts` to the real shape.

## The plan — next channels (in priority order)

1. **Unimplemented planning consents** (next build; spec below). Prime
   refurb/extension upside: a consent lapses 3 years after grant
   (s.91 TCPA 1990), so "granted, unbuilt, expiring within 12 months" =
   an owner who paid for permission they can't use. Data: the official
   [planning.data.gov.uk](https://www.planning.data.gov.uk/docs) API —
   free, no key, 100+ datasets. **Blocked on one probe** (egress-blocked
   from the dev sandbox — run from anywhere else):
   `curl 'https://www.planning.data.gov.uk/entity.json?dataset=planning-application&limit=2'`
   Confirm per-entity fields (decision-date, address/geometry, status) and
   LPA coverage of our patch, then build
   `packages/scouting/src/planning-consents.ts` mirroring the receivership
   source pattern (new leadType `lapsing_consent`, prime/block classifier
   applies automatically).
2. **Savills / Clive Emson auction parsers** — stubs today; blocks skew to
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
