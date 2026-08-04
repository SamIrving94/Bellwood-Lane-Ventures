/**
 * Strategy proposals — repo-shipped decision docs that need a founder
 * verdict. They render on /strategy under the live decision stack, so both
 * founders see them at the next login without anyone pasting a doc around.
 *
 * Lifecycle: ship with status 'for_review' → discuss → the decision gets
 * merged into the live decision stack (edited in-app) → flip the proposal to
 * 'decided' (kept for the paper trail) or delete it.
 *
 * Copy rules: same as whats-new — short sentences, bold keywords, clear
 * headings. One founder is dyslexic; walls of text don't get read.
 */

export type StrategyProposal = {
  /** Stable slug. */
  id: string;
  /** ISO date the proposal was raised. */
  date: string;
  title: string;
  /** Who needs to review it. */
  reviewer: string;
  status: 'for_review' | 'decided';
  markdown: string;
};

export const STRATEGY_PROPOSALS: StrategyProposal[] = [
  {
    id: '2026-08-two-track-model',
    date: '2026-08-04',
    title: 'Two revenue streams: Volume sourcing + Prime principal',
    reviewer: 'Ant',
    status: 'for_review',
    markdown: `
## The decision we need

Formally split the business into **two tracks** — and agree the buy-box for each.

## The two streams

**Track 1 — Volume (sourcing revenue).** What we do today. High volume,
smaller tickets. We source, appraise and release to investors for a
**sourcing fee**. Software does the work; the fee is the margin.

**Track 2 — Prime (principal revenue).** High-value stock we buy for
**our own book** with the new capital: ~£700k+ purchase, under market,
architect + fitter refurb, **~£1.2M exits**. Plus **blocks of flats /
portfolios** as they appear. Fewer deals, much bigger absolute profit per deal.

Same engine feeds both. The scout now stamps every lead with a **track**:
\`volume\`, \`prime\` (£700k+), or \`block\` (multi-unit language).

## What the platform now does (shipped)

- The scout **no longer buries prime stock** — it was scoring a £1.2M house
  *below* a £150k terrace because the maths rewarded cheap streets. Prime and
  block leads now **bypass the volume gate** and always reach you.
- **Blocks are detected** — "block of 6 flats", "freehold building",
  "portfolio" — in listings *and* auction catalogues. They used to be dropped
  as "development sites" or mis-badged as commercial.
- Prime/block finds raise their own **high-priority daily card** — they never
  drown in the volume review pile.
- Leads, pipeline and deals now carry a **★ Prime / ▦ Block badge** and a
  filter.

## What Ant needs to decide

1. **The prime buy-box** — which London postcodes, what price band, what
   minimum absolute profit per deal (the model's 20% cash-ROI hurdle is the
   wrong yardstick for prime; suggest a £150k+ gross-profit floor instead)?
2. **Architect partnership terms** — fixed fee, profit share, or both?
   Their refurb-uplift view should feed our GDV number per deal.
3. **Blocks appetite** — hold-and-let, break-up-and-sell, or case-by-case?
4. **Capital allocation** — how much of the new capital is reserved for
   prime vs kept liquid for volume bridging?

## Honest caveats (deferred platform work)

- The **AVM is not prime-ready**: sparse comparables make it under-value
  prime stock, and it cannot value a block at all (needs sum-of-parts).
  Prime/block appraisals are flagged accordingly — **treat the AVM number as
  a floor and underwrite manually** with the architect until we build the
  prime valuation model.
- Auction coverage is Auction House UK only today; blocks skew to regional
  houses (Clive Emson etc.) — worth adding next.

*Technical detail: \`packages/scouting/src/track.ts\` and the PR notes.*
`.trim(),
  },
  {
    id: '2026-08-farringdon-conveyancing',
    date: '2026-08-03',
    title: 'Conveyancing: anchor on Farringdon (Orbital)',
    reviewer: 'Ant',
    status: 'for_review',
    markdown: `
## The decision we need

Pick our **panel conveyancer** for purchases — the firm we instruct on every deal.

**Proposal: go Farringdon-first**, with an Orbital-powered firm as backup.

## What is Farringdon?

- The **law firm Orbital built** — Orbital is the AI platform that already automates title review, searches analysis and enquiries for UK conveyancers (~200k transactions supported in 2025).
- **CLC-regulated**, Central London, launched April 2026. Taking instructions since **May 2026**.
- Run by Orbital co-founder **Ed Boulle** + a COO and head of legal practice with decades of high-volume conveyancing between them.
- Works on a **referral-partner model**. JLL signed at launch.

## Why them

- **Fastest legal layer available.** AI-native workflows on every matter — and we are the dream client: **chain-free cash buyer**, clean AML file, searches money ready on day one.
- **Repeatable.** One firm, one process, volume pricing — not a new solicitor per deal.
- **Our platform already drives them.** Going under offer now seeds a **12-step checklist** with target days, and a weekday **chaser cron** drafts nudges when steps run late (we review before sending). That machinery works on any firm — it works best on a fast one.
- **Speed is the moat.** Market average is 12–20 weeks offer-to-completion. Chain-free cash is ~8–10. With an AI-native firm + day-one searches we target **exchange in ~5–6 weeks**.

## The catch (be honest)

- Farringdon launched taking **seller-side referrals**. We need to confirm they'll act for us as **buyer** at our volume. That's the first call.
- **New firm risk.** Months old. Capacity unknown.
- **Single-firm dependency.** If they stall, every live deal stalls.

## Mitigation / backup

Keep a second instruction relationship warm with an **Orbital-powered established firm** — known users include **Enact, Simply Conveyancing, Sort Legal, Blacks, Knights**. Same tech, longer track record.

## The commercial ask (when we call)

- **Fixed fee per purchase**, volume-priced.
- **SLA:** searches ordered day one · enquiries turned in 48h · target exchange week 5–6.
- Named contact + our matter reference on every deal (our chaser emails use it).

## What Ant needs to decide

1. ✅ / ❌ **Farringdon-first** as panel firm (subject to them acting buy-side)?
2. Which **backup firm** do we open a relationship with?
3. **Who makes the call** — and do we pitch the volume deal now or after 2–3 test instructions?

*Full technical detail: \`docs/architecture/legal-orbital.md\` in the repo.*
`.trim(),
  },
];
