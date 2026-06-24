# Sourcing Playbook

How Bellwood Lane finds the off-market, motivated-seller deals the founder
(and Anthony) source by hand — turned into a repeatable, compliant pipeline.

> Researched June 2026 from UK property-sourcing, auction, and data sources.
> Numbers marked _(directional)_ come from vendor/marketing pages and should be
> re-confirmed against the primary source before being quoted externally.

## The core idea

Off-market discounts are not luck — they are a **list**. Every deal traces to a
distress signal joined to an owner, then worked with targeted, compliant
outreach. The funnel:

```
signal → identify owner → score → outreach (held for review) → appraise → offer
```

The motivation behind almost every motivated seller is one of the **three Ds —
Debt, Divorce, Death** — plus relocation, short lease, and empty/derelict stock.
Our job is to detect these *before* the property hits the open market.

## Signals & data sources

| Signal | Best source | Status in repo |
|:--|:--|:--|
| **Probate / death** | The Gazette API + GOV.UK probate search | ✅ `scouting/gazette.ts`, `probate-data.ts` |
| **Long-held equity** | HMLR Price Paid (free, SPARQL) | ✅ `property-data/hmlr.ts` |
| **Tired stock / retrofit pressure** | EPC open data (band F/G) | ✅ `property-data/epc.ts` ⚠️ old EPC URL retired May 2026 — confirm endpoint |
| **Corporate / landlord distress** | Companies House + HMLR corporate titles | ✅ `property-data/companies-house.ts` |
| **Short lease** (<80y = marriage value) | HMLR Registered Leases / PropertyData `/freeholds` | ✅ **NEW** — `property-data/registered-leases.ts` + `scouting/short-lease.ts` |
| **Repossession / LPA receiver** | Auction catalogues ("by order of mortgagee") | 🟡 scrapers exist; no receiver-flag parsing |
| **Auction lots (all houses)** | EIG aggregator (~£525/yr _(directional)_, ~70% of UK lots) | 🟡 3 scrapers; no EIG / iamsold modern-auction feed |
| **Empty / derelict** | Council Tax empties (FOI) + Empty Homes Officers | ❌ gap; addresses often FOI-withheld |
| **Price-reduced + days-on-market** | Rightmove / Zoopla | ⚠️ legally sensitive — scraping breaks portal ToS + UK GDPR |

## Outreach (direct-to-vendor)

- **Letters are the workhorse.** ~1% response untargeted; **8–15% well
  targeted** _(directional)_. The win is **list quality**, not volume.
- **Multi-touch:** it typically takes **4–5 mailings** before a homeowner
  responds — single-shot campaigns under-perform.
- **Tone that converts:** empathetic and personal, a recently-sold local
  comparable for proof, and a soft CTA (free valuation / quick chat).
- **Professional referrals** (solicitors, probate executors, LPA receivers) hear
  first; finder's fees are legal **if disclosed**.
- **Inbound PPC** ("sell my house fast") is the highest-intent channel — the
  seller self-identifies.

## Compliance — non-negotiable rails

1. **Redress scheme** — sourcers count as estate agents (Estate Agents Act
   1979); must join TPO or PRS. Criminal offence to skip.
2. **HMRC anti-money-laundering** registration + **ICO** data-protection
   registration; CDD (ID checks) on buyers.
3. **Outreach law** — screen all calls against **TPS/CTPS**; skip-tracing needs
   a documented **legitimate-interest** basis under UK GDPR. PECR penalties are
   rising toward GDPR levels (DUAA 2025, enforcement Feb 2026).

> This is *why* vendor emails are **always held for founder review**
> (`OutreachHold`) — it is a compliance rail, not just a safety one.

## What's built now: the short-lease scout

The first research recommendation, shipped:

- **`@repo/property-data/registered-leases`** — pure marriage-value maths:
  `computeRemainingLeaseYears`, `classifyLeaseDistress` (critical / unmortgageable
  / marriage-value / watch bands at the 60/70/80-year lines), `findShortLeases`.
- **`@repo/scouting/short-lease`** — `fetchShortLeaseLeads(seeds)` scans
  PropertyData `/freeholds` per postcode, keeps leasehold properties under the
  ~85-year ceiling, and emits them as `lease_expiry` leads.
- **Pipeline wiring** — opt-in via `scanShortLeases: true` (off by default so
  existing credit usage/timing is unchanged). A marriage-value lease earns a
  motivation bonus that scales with lease urgency, so a contactless lead still
  surfaces above the THIN floor rather than being filtered out.

### How to turn it on

`runScoutingPipeline({ scanShortLeases: true, shortLeaseSeeds: [{ postcode: 'NW1 1AA' }] })`
— or omit `shortLeaseSeeds` to reuse the existing `scanSeeds` postcodes. Wire
the flag into the scouting cron's settings once the founder confirms target
areas.

## Roadmap (priority order)

1. ✅ **Short-lease scout** (this change).
2. **EIG feed** into `@repo/auctions` — one integrated lot source incl.
   repossessions, replacing the 3 brittle per-house scrapers. Model the iamsold
   modern-auction reservation fee (~4.5–5%) — already handled in the valuation
   deal-model.
3. **Receiver/mortgagee flag** parsing on auction lot text ("by order of…").
4. **Multi-touch DTV letter sequencing** (4–5 touches) in the outreach pipeline.
5. **Hold off on portal scraping** — pursue a licensed feed or partner data
   instead of Rightmove/Zoopla scraping (ToS + GDPR exposure).

## Open question for the founder

The Flat 5 Milton Court note said **"probate → no SDLT."** Probate does not by
itself exempt the *buyer* from SDLT, so the deal-model charges it normally
(an `sdltExempt` flag exists for genuine exemptions). Please confirm whether
that's a real rule you use or was deal-specific.
