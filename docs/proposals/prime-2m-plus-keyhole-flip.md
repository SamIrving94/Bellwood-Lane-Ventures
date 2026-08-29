# Proposal: hunting £2M+ with the scout we have, and the Keyhole flip

**For:** Sam / Anthony
**From:** Claude Code session (drafted for founder review)
**Date:** 29 Aug 2026
**Decision needed:** three sign-offs — see the end
**Evidence base:** `docs/research/prime-sourcing-deep-research-2026-08.md` + the current code

---

## Part A — anchoring on £2M+: what the tech already does

**The headline: there is no £2M cap in the code.** `track.ts` says it in
its own comments: *"there is deliberately NO upper bound anywhere in this
file: cornerstone investors back the prime book deal-by-deal."* A £2.4M
unmodernised house already classifies **prime** today. What limits us is
not classification — it is **coverage**: we only scan the districts seeded
as areas.

### Live today, zero code

| Move | How | Effect at £2M+ |
|:---|:---|:---|
| **Scan the super-prime fringe** | `pnpm tsx scripts/seed-london-prime.mts --write --tier2` (the flag already exists), or mark districts ★ Prime in Settings → Scouting | W8, W11, SW3, SW7, NW3, NW8 are already tier 2 in `LONDON_PRIME_DISTRICTS` — the classifier accepts them; they just aren't scanned |
| **Probate at £2M+** | Nothing — already wired | The street-average fallback fires wherever HMLR average ≥ £700k, which is every super-prime street. Every probate notice there classifies prime |
| **Receiverships at £2M+** | Nothing — already wired | Research: distress is concentrated in *prime central London residential*. The Gazette→Companies House pipe + 30-min CH stream cover ALL configured areas — seeding the fringe extends them there automatically |
| **Auctions at £2M+** | Nothing — already wired | A £700k+ guide is prime **anywhere**, no ceiling — £2M+ lots already reach the founder glance |

**Recommendation: trial 2–3 fringe districts, not all six.** Prime seeds
scan every run and sweep ten lists (~40% more credits per seed —
`PRIME-SCOUT.md` §6). Suggest **W11 (Notting Hill)** and **NW3
(Hampstead)** first: the deepest period-house stock directly adjacent to
districts we already work. W8/SW3 carry the most listed-building risk;
SW7 is flat-heavy.

**Honest framing:** the research *supported* our super-prime exclusion
(prime London -7.5–9% in Q2 2026, transactions -11.5% in July). The fringe
play is **optionality, not conviction** — scan and glance, don't chase.
Falling prime prices cut both ways: softer exits, but more motivated
sellers of exactly the £2M–£2.8M unmodernised stock we'd want. The founder
glance decides, deal by deal, as designed.

### Small code (days, not weeks)

1. **Conservation / Article 4 / listed flag on prime leads.** At £2M+
   this is the margin: extension upside can be removed entirely in
   Camden/RBKC/Westminster (research risk #4). We already integrate
   `planning.data.gov.uk` for the brownfield register
   (`planning-consents.ts`) — the same platform serves the
   `conservation-area` and `article-4-direction` datasets; Historic
   England's listed-buildings data is also free. One enrichment step, one
   badge on the lead page.
2. **Value-band badge** on prime leads (£700k–£1.2M / £1.2M–£2M / £2M+)
   so the glance can triage the cornerstone-ticket deals first.
3. **Street-list export for direct approach.** Buying agents literally
   door-knock target streets. We already hold the street-level flags
   (HMLR averages, EPC bands, long-tenure signals). A one-off script that
   prints "the 20 most promising unmodernised-likely streets in
   [district]" turns the scout into a door-knock / direct-mail targeting
   tool — the zero-glamour channel the research says the top end actually
   uses.

### The keystone build (the research's #1 action)

**The matched-pairs model: Land Registry Price Paid + EPC register,
condition-paired by street.** The £/sqft unmodernised-vs-refurbished
ranking we wanted **does not exist anywhere as a published dataset** — it
has to be built, and every input is free. One engine, three uses:

1. **Evidence-rank the district list** — including whether the tier-2
   fringe earns tier 1, and which current tier-1 districts don't earn
   their seat (the validation `track.ts` has asked for since it was
   written).
2. **Sharpen the AVM** (`@repo/valuation`) with real
   condition-adjusted comparables.
3. **Power Keyhole** (Part B) — the condition-adjusted value band IS this
   model's output.

This is the single highest-leverage engineering block on the board.

### £2M+ deal-side cautions (not code, but gating)

- **SDLT structuring first.** Flat 15% corporate SDLT above £500k unless
  property-developer/trader relief applies — on a £2M buy that's £300k vs
  much less. Confirm the relief structure with the accountant **before**
  the first fringe acquisition (research action #3).
- **Bridging at sub-60% LTV** — the 0.55–0.75%/month vs 0.95–1.5% spread
  moves £2M-deal economics materially over a 9-month hold.

---

## Part B — the flip: what we build so the network feeds us

**The insight:** buying agents (Domus Holmes, Black Brick, Property
Vision) report 40–70% of acquisitions off-market, sourced through
**lawyers, surveyors, wealth managers and private bankers**. That network
runs on relationships and golf — none of them appear to have built
software for it. We have the data engine to be the software.

**Keyhole** (PRD filed: `docs/prds/keyhole-v1-2026-08.md`) is the
professional-facing face: free condition-and-value intelligence for
solicitors, surveyors, wealth managers and care advisers; our deal flow
as the quiet byproduct. Skewed to higher-value estates, the pilot invite
list is: private-client teams at firms administering £2M+ estates, and
private-bank fiduciary desks.

### What we already have vs what Keyhole needs

| Piece | Status |
|:---|:---|
| Value engine (base + risk + trend) | ✅ `@repo/valuation` |
| EPC / HMLR / OS Places adapters | ✅ `@repo/property-data` |
| Address-in, held-for-review UX pattern | ✅ `apps/web` instant-offer flow |
| Email delivery + capture | ✅ `@repo/email` (Resend) |
| Professional accounts (later) | ✅ Clerk |
| Condition-adjusted value bands | ⏳ the matched-pairs engine (Part A keystone) |
| One-page PDF generation | ❌ new build — `@repo/document-pipeline` READS PDFs (probate OCR), it doesn't write them. Small, contained |
| DB models (ProfessionalAccount, ReportRequest, Referral) | ❌ new, straightforward |
| Data licensing | ⚠️ external reports must run on **open data** (PPD, EPC) — PropertyData's licence likely doesn't cover third-party display; Rightmove/Zoopla photo use is an open legal question (PRD risk) |

Two founder rules are already reconciled in the PRD header: Keyhole shows
**market bands, never our offer** (the no-figure-on-screen rule governs
offers to sellers, and still does); and the referral panel uses the
signed-off promise wording — "**as little as** two weeks", never
"typically two weeks".

### The Domus Holmes angle — one rule: asymmetry

**Never give buy-side agents our distress feed.** They buy for HNW
clients; armed with our probate/receivership signals they become
competitors for the same stock. What we give instead costs us nothing and
they genuinely need:

1. **Analytics on addresses they already hold.** Condition-to-value,
   refurb-cost bands, conservation/Article-4 flags for a house their
   client is weighing. Sharpens their advice; leaks none of our pipeline.
2. **First look at our refurbished exits.** Buying agents are starving
   for off-market supply for family-house briefs; we want chain-free,
   fee-motivated buyers. Zero conflict — we're not competing at the
   distressed end (their clients don't want the wreck) and we're supply
   at the finished end. **This needs no build at all** — a vetted list
   and an email when a refurb nears completion.
3. **Later, maybe: paid release of refused prime leads.** The founder
   refuses most prime leads by design. The refused-but-evidenced ones
   could be released to a vetted circle for a fee — the volume-track
   "released to investors" model, upmarket. Only once trust exists, and
   only leads we have firmly passed on.

The reciprocity loop: their surplus and mismatched off-market intelligence
flows back to us — the £2.3M Hampstead probate wreck no client brief
wants is exactly our deal.

### Sequencing (per the PRD, tightened)

1. **Now, no code:** start the buying-agent first-look list; founder
   picks 5–8 warm Keyhole pilot targets (solicitors first — probate is
   the only quantified discount: 10–25%).
2. **Next engineering block:** the matched-pairs engine (serves scout +
   AVM + Keyhole).
3. **Then:** thin Keyhole MVP — address → one-page PDF, no login,
   referral panel opt-in. Pilot gate: **1 referred lead + 1 completed
   deal within 12 weeks**, or we stop.
4. **Before any referral fees:** SRA/RICS compliance opinion (PRD open
   question — hard gate).

The research's own caution stands: referral-driven volume is **asserted,
not measured**, in every source. Keyhole is a hypothesis with a cheap
test, not a validated channel. Build the thin version, count the
referrals, then decide.

---

## Decisions needed

1. **Fringe trial:** seed W11 + NW3 as prime areas (Settings or
   `--tier2` seed with a limit)? Credit cost: ~2 extra prime seeds per
   run.
2. **Keystone build:** greenlight the Land Registry + EPC matched-pairs
   model as the next engineering block?
3. **Keyhole Phase 0:** greenlight the thin MVP + 5–8 founder-led
   pilots, and start the buying-agent first-look list now?
