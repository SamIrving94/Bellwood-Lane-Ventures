/**
 * Seed content for the in-app Strategy page. The live, editable copy lives in
 * the database (Setting key `strategy.decisionStack`); this is what we seed it
 * with the first time the page is opened. The git-tracked snapshot is
 * docs/DECISION-STACK.md — keep them roughly in step when making big changes.
 */
export const STRATEGY_SETTING_KEY = 'strategy.decisionStack';

export const DEFAULT_DECISION_STACK = `# Bellwoods Lane — Decision Stack

**An evergreen strategy document.** Based on Martin Eriksson's Decision Stack: each layer should justify the one below it. If a piece of work doesn't ladder up to a bet, and a bet up to the mission, and the mission up to the vision — question it.

> **How to use this doc**
> - Read top-down to understand *why* we're doing anything.
> - Read bottom-up to check any task earns its place.
> - This is **living**. Update it at the end of major sessions. Add to the Changelog at the bottom.

---

## Who we serve (ICP)

Three audiences, one chain:

1. **Vendors** — UK homeowners who need to sell *fast and for certain*, not for the last pound. Probate, chain-breaks, repossessions, relocations, short leases, problem properties. They value **speed, certainty, empathy** over squeezing the top price.
2. **Introducers** — estate agents & solicitors sitting on a **collapsed sale**. We give them a 60-second cash figure and a signed offer in 4 hours, so they rescue a dead instruction and keep their fee.
3. **Capital** — investor syndicate who fund the deals we choose not to buy ourselves, for a sourcing fee.

The wedge is the **fall-through moment** — the instant a chain breaks, the agent needs us before they need anyone else.

---

## 1. Vision — *the change in the world*

**Selling a house in a crisis should take days, not months — and feel humane.**

A UK where any homeowner facing a forced or urgent sale can get a fair, certain cash offer in hours, with dignity, instead of months of uncertainty, chains that collapse, and fire-sale auctions.

## 2. Mission — *what we do about it*

**We turn collapsed and distressed sales into fast, fair, certain completions — sourced direct and through agents, appraised by machine, closed by humans.**

We are a direct-to-vendor deal sourcer that pairs **automated sourcing & appraisal** with **human judgement on the things that matter** (the vendor call, the negotiation, the offer).

### Operating principle — *Steps vs Thoughts*

- **Automate the steps:** scraping, enrichment, valuation, admin, drafting.
- **Protect the thoughts:** vendor empathy, negotiation, the final offer call.
- Software should hand the founder a *decision*, never a blank page.

---

## 3. Big Bets — *the few things we believe will win*

### Bet 1 — Own the fall-through moment (agent channel)
The cheapest, warmest lead in UK property is a sale that **just** collapsed. If agents reflexively send us fall-throughs (60s quote → 4h signed offer → they keep a fee), we get deal flow no ad budget can buy.

### Bet 2 — A valuation engine agents & investors *trust*
Speed and certainty are worthless if the number is wrong. A defensible, conservative, **comparable-driven AVM** (sold comps, distance-weighted, last 12 months) is the foundation everything else rests on.

### Bet 3 — Founder-in-the-loop automation, not a call centre
We scale by removing **steps**, not by hiring bodies. The pipeline appraises, ranks and drafts; the founder reviews and decides.

### Bet 4 — Capital-light growth via the investor syndicate
We don't need to buy every deal. Routing surplus deals to investors for a sourcing fee lets volume grow faster than our balance sheet.

---

## 4. Objectives & Key Results — *measurable, near-term*

> Set for the soft-launch phase. Revisit each quarter. Fill the bracketed targets with Sam once agreed.

### O1 — Make the appraisal engine provably trustworthy
- **KR1.1** Median AVM error ≤ **[8%]** vs eventual agreed/sold price across a back-test of **[20]** known deals.
- **KR1.2** **100%** of deal valuations cite **≥3 comparable sales** within 0.5 miles & 12 months (else flagged low-confidence).
- **KR1.3** **0** unit/display defects in money fields.

### O2 — Prove the agent referral channel
- **KR2.1** **[3]** friendly agents live on /save-the-sale.
- **KR2.2** **[10]** real fall-through submissions received.
- **KR2.3** **≥90%** of submissions get a signed offer **within the 4-hour SLA**.
- **KR2.4** **[1]** completion (or agreed offer) from the channel.

### O3 — Make the weekly pipeline review effortless
- **KR3.1** Bi-weekly pipeline sheet appraised end-to-end in **< [10] minutes**.
- **KR3.2** **100%** of rows valued or explicitly flagged — none dropped.
- **KR3.3** Founder reviews deals in **discount-ranked priority order** every cycle.

### O4 — Stand up the capital path
- **KR4.1** **[1]** investor partner onboarded to the feed.
- **KR4.2** **[1]** deal passed to an investor with sourcing-fee tracked.

---

## 5. Roadmap — Now / Next / Later

### Now (in flight)
- **Batch upload v2** — exact-file export + extra PropertyData signals. *(O3)*
- **AVM backfill** — re-value every existing deal with the fixed engine. *(O1)*
- **Confirm PROPERTYDATA_API_KEY** on both Vercel projects. *(O1, blocker)*

### Next
- **Auction rule** — guide ≈10% below reserve → target 30% below market for auction lots. *(O1)*
- **Price-reduction signal** — 2nd/3rd reduction + 6 months on market. *(O1, O2)*
- **AVM back-test** — measure median error vs known outcomes. *(O1)*
- **3 friendly agents live** + first 10 submissions. *(O2)*

### Later
- Resale/exit workflow (agent re-lists when we sell). *(Bet 1 promise)*
- CRM link: /save-the-sale submission → Contact → outreach. *(O2)*
- Investor feed depth + automated sourcing-fee settlement. *(O4)*
- Real domain + business WhatsApp number. *(O2)*

---

## 6. What we are deliberately NOT doing

- **Meta / Instagram ads** — distressed sellers aren't there.
- **LinkedIn automation** — accounts get banned; we draft, the human sends.
- **Buying every deal** — capital-light by design (Bet 4).
- **Chasing top price** — we compete on speed + certainty.
- **A human call centre** — we scale on automation (Bet 3).

---

## Changelog

- **2026-06-21** — Created. AVM pounds↔pence bug fixed; distance-weighted comps shipped; batch Excel upload (parse → appraise → rank → diff → export) shipped; batch v2 (exact-file export + PropertyData signals) shipped.
`;
