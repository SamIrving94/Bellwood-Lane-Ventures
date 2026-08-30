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
    id: '2026-08-prime-2m-keyhole',
    date: '2026-08-29',
    title: '£2M+ fringe trial · the district truth machine · Keyhole',
    reviewer: 'Ant',
    status: 'for_review',
    markdown: `
## What happened (Sam approved, 29 Aug — built and in PR #94)

Deep research on prime sourcing came back. Three decisions came out of it.
All three are **built**. This is the review, not the request.

## The three things, in one breath each

**1. The £2M+ fringe trial.** There was never a price cap in the code —
only a scanning gap. **W11 (Notting Hill) and NW3 (Hampstead)** can now be
seeded with one command. Optionality, not conviction: the research
SUPPORTED our super-prime exclusion (prime London fell 7.5–9% in Q2), so
we scan and glance, we don't chase. Cost: **~2 extra prime seeds per run**.

**2. The truth machine** (\`scripts/arbitrage-rank.mts\`). Our 33-district
list was a hypothesis. This measures it: every house sale (Land Registry)
matched to its EPC certificate, split **unmodernised (band F/G) vs
refurbished (A–C)**, median **£/sqft each side, per district**. The gap is
the arbitrage. Strict matching, minimum 5 sales per side or it says
"insufficient". Nobody publishes this data; now we make it ourselves.

**3. Keyhole** (\`/keyhole\`, unlisted). Free one-page report for probate
solicitors, surveyors and wealth managers: EPC condition, the street's
recorded sales, refurb cost bands. **Never a valuation, never
auto-contact.** One opt-in button sends the property to deals@. The flip:
instead of paying for professional referrals, we give the network a tool
they want, and the leads are the byproduct. Buying agents (Domus Holmes
tier) get **first look at our refurbished exits** — never our distress
feed.

## Why this is worth Ant's attention

- **Probate is the only quantified discount** in the research: 10–25%
  below market, 85–90% of asking accepted. Everything else is "not found".
  Keyhole aims squarely at the probate professionals.
- The truth machine ends district debates. Next tier changes come from
  **measured spreads**, not instinct.

## What Ant needs to decide / sanity-check

1. ✅ / ❌ **The fringe trial itself** — comfortable scanning W11 + NW3 at
   ~40% more credits per prime seed?
2. **SDLT structure before the first £2M+ buy** — flat 15% corporate SDLT
   vs developer/trader relief is up to **~£300k on a £2M deal**. Which
   accountant, and when?
3. **Bridging** — who arranges the sub-60% LTV line (0.55–0.75%/month vs
   0.95–1.5% moves whole-deal margin)?
4. **Keyhole compliance gate** — free pilot needs nothing, but **no
   referral fees to solicitors/surveyors until an SRA/RICS opinion** is in.
   Agreed as a hard gate?
5. **deals@wearekept.co.uk** — Keyhole referrals land there. Does that
   mailbox exist and get read?
6. **The kill-gate** — pilot is 5–8 warm professionals; **1 referred lead +
   1 completed deal in 12 weeks or we stop**. Agree the bar?

## Update, same day: Keyhole reframed twice — and got stronger

Sam's legal research corrected the framing before any pilot saw it.

- **The problem:** executors carry PERSONAL liability (devastavit) for
  selling under best achievable price. A tool that nudges toward a cash
  buyer trips exactly that alarm. Referral fees to surveyors must be
  disclosed in writing anyway.
- **The fix:** Keyhole sells **defence of the decision**, not leads. The
  file that justifies whatever route the estate takes. Our binding
  written offer becomes **evidence they can request** for that file. CTA
  re-pointed the same day: "request a written offer", never "send us the
  property".
- **Pushed further:** two bigger valuation-free pains found — the **IHT
  funding catch-22** (tax due in 6 months, cash frozen, house unsellable
  pre-grant) and **vacant-property liability** (insurance lapses at day
  30–60, executors personally exposed). Keyhole becomes module one of a
  **probate property shelf**: vacancy guard → IHT map → decision file.
  Tree + sequencing: \`docs/proposals/keyhole-probate-shelf-tree.md\`.

Three more things to decide, on top of the six above:

7. **Agree the shelf framing** — trust-first, referral-late?
8. **Next module** — vacancy guard (recommended: sharpest liability
   motivator, most reuse, weekly touchpoints) or the IHT map?
9. **The integrity firewall** — professionals' case data is never our
   scouting feed. Sign it off as written?

Also: the compliance opinion scope now covers the FCA perimeter (no
credit broking, no insurance arranging — signpost and illustrate only).

## Second update: the barbell, and a flagged buy-box question

Sam's evening research widened the channels past probate. Short version
(full detail in \`docs/proposals/keyhole-probate-shelf-tree.md\`):

- **£700k–£1.5M** estates are handled by **local high-street probate
  firms in our own postcodes** — they get the tools.
- **£1.5M–£10M** goes to **relationships, not software**: family
  offices, Tier 1 private client, divorce solicitors, LPA receiver
  panels (pitch = "certainty on the day you choose to sell" — receivers
  DO owe a proper-price duty, so never "no duty, sell cheap").
- One idea **vetoed pending counsel**: funding the IHT gap in exchange
  for first-look rights. A lender-buyer tie is devastavit with a paper
  trail plus FCA perimeter. Signposting independent lenders only.

10. **The barbell** — agree tools-local, relationships-top-end?
11. ~~The prime floor~~ **DECIDED (Sam, 29 Aug): floor stays £700k;
    £1.5M–£10M is the named cornerstone tier** (own badge — queued —
    and relationship channels). No ceiling change needed: none exists.
12. **The IHT-funding veto** — confirmed?

Two founder-approved anchors from the same exchange: the receiver/top-end
pitch line is **"certainty on the day you choose to sell"**, and the
grant-stage trigger is pursued the CLEAN way (the solicitor's own dates,
in-tool) — the IHT421 itself is invisible to outsiders and the public
grant record has no API, so anyone promising postcode-level grant feeds
is selling either Smee-&-Ford-style commercial data (evaluate) or smoke.

## 🚀 October launch

Target set 30 Aug: **launch in October.** The single action board — who
owns what, the week plan, and the freelancer recommendation (hire a PPC
executor for the existing \`PLAN.md\`, never a generalist; professional
channels stay founder-led) — lives in **\`docs/OCTOBER-LAUNCH.md\`**.
Decisions #8 (next module), #9 (firewall) and #12 (funding veto) above
are now launch-blocking, plus one new joint call: does October mean
go-loud-on-vendors, or professional-first with a small paid test?

## Sam's four switch-on actions (already listed for him)

EPC token on the web project · \`pnpm migrate\` · seed W11+NW3 · pick the
pilot professionals.

*Full detail: \`docs/proposals/prime-2m-plus-keyhole-flip.md\`,
\`docs/proposals/keyhole-probate-shelf-tree.md\`,
\`docs/prds/keyhole-v1-2026-08.md\`, research in \`docs/research/\`, code in
PR #94.*
`.trim(),
  },
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

## New sourcing channels feeding the tracks (shipped 4 Aug)

Deep research found two channels with hard evidence, both now live in the scout:

- **Receiverships** — lender-appointed receivers MUST sell. Appointments are
  **~2x 2023 / ~3x 2022 levels**; **65% residential**; distress reportedly
  concentrated in prime central London + part-built schemes. The scout now
  reads Gazette receiver/administrator notices, pulls the company's charges
  from Companies House, and mines property addresses out of the particulars.
  New lead type \`receivership\` (scores just below probate). One legal
  caveat: the receiver's appointment must be validated before purchase.
- **Allsop auctions** — one catalogue = **344 lots** including whole London
  blocks (verified: 18 flats in Finsbury Park at £1.6m+ guide, under
  £90k/unit). New scraper feeds the Monday auction scan; prime/block lots
  raise their own card.

Also flipped on (4 Aug): PropertyData's **back-on-market** list — a failed
sale is a motivated vendor, and we were already paying for the data.

Also live (5 Aug): **stalled planning consents** from the national
brownfield register — sites permissioned 18+ months ago and still unbuilt,
with dwelling counts (multi-unit sites auto-classify as block track). Free
government API, verified live, runs weekly.

Full citations + the channel roadmap: \`docs/architecture/sourcing-channels.md\`.
Next up: Savills/Clive Emson auction parsers.
One for Ant directly: **ground-rent freeholders** become motivated block
sellers as the £250 ground-rent cap approaches (~2028) — that's a
relationship channel, not a scraper.

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
