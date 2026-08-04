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

## Channels researched, not yet built (in priority order)

1. **Savills / Clive Emson auctions** — parsers are stubs (`sources/savills.ts`,
   `clive-emson.ts`). Blocks skew to regional houses.
2. **Unimplemented planning consents** — prime refurb/extension upside;
   planning data already partially flows via the planning source.
3. **Expired/withdrawn listings** — vendor fatigue channel; PropertyData may
   already carry the signal.
4. **Probate solicitor partnerships** — relationship channel, not code;
   pairs with the marketer-monthly solicitor outreach cron.
