# Kept capital partner pack

_Last verified against the code: 2026-11-28_
_Status: **DRAFT. Dark. Do not send to anyone.** See "Before this leaves the building"._

**For:** Samir (founder review)
**Audience:** investors who commit capital in advance, so Kept can buy
homes within agreed guardrails and sell them on.
**Not the same as:** the back-to-back `InvestorPack` (one deal, one
price, register interest). That already exists. This is the layer above it.

> Text in **[SQUARE BRACKETS]** is a placeholder. Nothing in brackets is a
> fact yet. Do not fill a bracket with a guess.

---

## 1. The one-page version

**What we offer.**
A standing mandate. You commit capital. We buy only homes that fit your
written rules. The system checks every deal against those rules, reserves
your capital, and reports back. You see every decision and the reason.

**Who sells to us.**
People with a reason to move: probate, chain breaks, repossessions,
relocations, short leases. We deal with them directly, not through a
portal. That is where below-market purchases come from.

**Why the numbers can be trusted.**
- We refuse to value a home without a real sale nearby. No guessing.
- Every valuation is frozen at the moment it is made.
- Every month we compare those frozen numbers with what the homes
  actually sold for. The result is published to you, good or bad.

**What we are not.**
- Not a fund that promises a return.
- Not for people who want a hands-off yield with no view of the risk.
  If that is you, we will say so.

---

## 2. The mandate: how capital is deployed

You do not hand over cash and hope. You agree a **buy box**. A deal
either fits it or it does not.

### 2.1 The buy box (placeholders are for you to set)

| Rule | What it controls | Starting value | Where it lives in the system |
|:--|:--|:--|:--|
| **Price vs AVM, ceiling** | We never pay more than this share of the valuation | **88%** of AVM | `ceilingFraction` in `offer-config.ts` |
| **Price vs AVM, floor** | Below this, a person reviews: the offer may be too low to be credible with the seller | **60%** of AVM | `floorFraction` (CEO escalation) |
| **Target discount by seller type** | The margin we aim for | Probate 20%, chain break 20%, short lease 15%, repossession 25%, relocation 20%, standard 22% | `sellerTypeMargin` |
| **Minimum margin** | Margin can never be squeezed below this | **10%** | `minEffectiveMargin` |
| **Total risk discount cap** | Stops a pile of small penalties turning into a lowball | **40%** | `totalDiscountCap` |
| **Valuation confidence** | A wide, uncertain range sends the deal to a person first | Range width over **15%** is flagged | `maxIntervalWidthRatio` |
| **Evidence disagreement** | Comps that contradict each other send the deal to a person | Ring gap, own-sale gap, type mismatch | `evidence-checks.ts` |
| **Price band** | Lowest and highest purchase price | **[£__ to £__]** | _to build_ |
| **Geography** | Postcode districts in scope | **[districts]** | Scouting areas, partly built |
| **Property type and tenure** | e.g. freehold houses, flats over 90 years | **[rules]** | _to build_ |
| **Condition and refurb** | Maximum refurb budget as a share of GDV | **[__%]** | `refurb.ts`, `gdv.ts`, partly built |
| **Single-deal exposure** | Largest share of the pot in one home | **[__%]** | _to build_ |
| **Total exposure by area** | Stops concentration in one district | **[__%]** | _to build_ |
| **Hold period** | Maximum months from purchase to sale | **[__ months]** | _to build_ |
| **Target return floor** | Minimum modelled return to qualify | **[__%]** | `deal-model.ts`, `maxOfferForRoi` |

These are the **starting** values already in code. You can tighten any of
them for your own mandate. You cannot loosen the safety ones (floor,
evidence checks, no-sale refusal). See section 5.

### 2.2 How a deal moves

1. **Source.** The scout finds a motivated seller.
2. **Appraise.** The AVM values the home from sold comps. No comps, no
   number.
3. **Check against your buy box.** Pass or fail, with the reason written
   down.
4. **Reserve.** If it passes, the capital is ring-fenced for that deal.
5. **Offer.** A written offer is drafted. See the human step below.
6. **Complete.** Legal workflow, refurb, sale.
7. **Report.** You see the outcome against the original forecast.

### 2.3 The human step (decision for the founder)

Automatic does not mean unattended. Our rule today:

- **Steps are automated.** Sourcing, valuing, checking, reserving,
  drafting, reporting.
- **Thoughts stay with a person.** The vendor conversation and the final
  offer. Vendor emails are never auto-sent. They are held for founder
  review (`OutreachHold`).

So in version 1, capital is **committed automatically** to deals that
pass. The **offer to the seller is still approved by a person.**

**Decision needed:** do you want any deal class to skip that approval
later? Our recommendation: **no, not until the AVM backtest has a reading
of 200+ matched sales.** See section 4. Until then, "automatic" is the
qualification and the capital reservation, not the cheque.

---

## 3. How we differ

### 3.1 Sourcing nobody else is doing at this depth

- Direct to the seller, using real situations: probate notices,
  receiverships, auctions, chain breaks. Not scraped portal listings that
  every other buyer also sees.
- A lead is scored on motivation before anyone spends time on it.
- **[FOUNDER TO SUPPLY: how many leads sourced, how many appraised, how
  many offers, how many completed, over what period.]**

### 3.2 Honest valuation

Most automated valuation fails quietly. Ours is built to fail loudly.

- **It never values without a sale.** If radius comps, postcode comps and
  postcode-sector sales are all empty, it stops and says so. It does not
  fall back to an area average. This rule exists because of a real
  incident: a £750k semi was valued at £345k off a placeholder average.
- **It sizes the home from its own EPC certificate**, matched by UPRN. On
  65 leads this changed 7 valuations by over 5%.
- **It leans on price per square foot** when it has enough sized comps.
  On a hold-out of 209 real sales (May to July 2026), median error fell
  from 15.6% to 12.3%.
- **It flags its own doubts.** Wide ranges and contradictory comps go to a
  person before any offer.

**What we do not claim.** 12.3% is a hold-out result, not live
performance. Our own target is under 8%. We are not there. See section 4.

### 3.3 Servicing: why sellers choose us, and why that helps you

Better seller experience is a return driver, not decoration.

- 24-hour response.
- We view every property.
- Confirmed written offer within two working days of viewing, binding upon
  Kept for a week.
- Completion in weeks, not months. As little as two weeks.
- The price does not change, except in three stated cases.

Why you care:

- **Fewer fall-throughs.** A seller who trusts the process does not walk.
  A fall-through costs you time and carrying cost.
- **Better terms.** Sellers who need certainty accept a below-market price
  for it. That discount is your margin.
- **Reputation.** Probate solicitors and agents send repeat work to
  people who treat their clients well.

We also say who we are wrong for. If a seller can get a clearly better
price on the open market and has time, we tell them.

### 3.4 Visibility: you see what we see

This is the main point of difference.

- **A live view of your mandate.** Capital committed, reserved, deployed,
  returned. **[TO BUILD: investor portal view.]**
- **Every decision has a written reason.** Passed, failed, sent to review.
- **Every valuation is frozen.** We cannot quietly change a number after
  the fact. The record is the record.
- **A monthly accuracy report.** Median error, bias, share within 10%
  and 20%, and whether the range caught the sale. Published even when it
  is bad.
- **Segment honesty.** We grey out any segment under 100 sales. We say
  "too few" instead of showing a number that means nothing.
- **Deal updates.** Each live deal sends updates through the existing
  `DealUpdate` flow. Seller personal details never reach you.

---

## 4. Evidence

### 4.1 What is proven

**[FOUNDER TO SUPPLY. Required before this pack is used.]**

You said you have a proven record outside Kept. For each deal or
programme, we need:

| Item | Detail |
|:--|:--|
| Entity and role | Who bought, who sold, what your role was |
| Dates | Purchase, completion, sale |
| Numbers | Purchase price, costs, sale price, net profit, hold time |
| Proof | Completion statements, HMLR records, bank records |
| Capital | Whose money, how much, what they received |

**How we present it.** As **your personal record before Kept**, labelled
as such, with the entity named. **Never** as Kept's record. Kept has
**[no / __ ]** completed purchases of its own to date.
**[FOUNDER TO CONFIRM.]**

### 4.2 What is not proven yet

Say this plainly in the pack:

- The AVM backtest has **not produced a reading**. The first matches land
  a few months after the first snapshots. Under 30 sales gives no
  verdict. Under 200 is directional only.
- No capital partner has funded a deal through this mandate yet.
- Modelled returns are modelled. They are not results.

### 4.3 What would change this

When the backtest reaches **200+ matched sales**, update this section
with the real median error. If it is over 8%, say so, and say what we
changed.

---

## 5. The guardrails investors cannot switch off

These are the parts that stop us repeating a known mistake.

| Safeguard | What it prevents | Real incident |
|:--|:--|:--|
| **No valuation without a sale** | A number built on nothing | SW16, Sep 2026 |
| **Evidence disagreement flag** | Narrow-range, wrong-answer valuations | Clarendon Rise, Oct 2026 |
| **Floor at 60% of AVM triggers review** | Offers too low to be real | Built in |
| **Vendor emails held for review** | A bad email going to a bereaved seller | Built in |
| **No fabricated identifiers** | A made-up postcode failing days later | SW3, Aug 2026 |
| **Frozen valuation snapshots** | Moving the goalposts | Built in |

---

## 6. Returns

**We do not state a target return in this draft.** Any figure here must
come from either (a) your verified record, or (b) the deal model run on
stated assumptions, labelled as modelled.

### 6.1 Structure

| Term | Proposal |
|:--|:--|
| Minimum commitment | **[£__]** |
| Commitment period | **[__ months]** |
| Vehicle | **[SPV / loan note / other. Legal to decide.]** |
| Return to investor | **[fixed coupon / profit share / hybrid]** |
| Kept fee | **[__% of profit / __% of capital]** |
| Fees disclosed | All of them, in one table, up front |
| Exit | **[how and when an investor can withdraw]** |

### 6.2 Worked example (illustration only)

**[TO BUILD from `deal-model.ts` with real sample inputs. Label as
modelled. Show the downside case first.]**

Include:

- A deal that goes well.
- A deal that returns the capital with no profit.
- A deal that loses money, and what the loss is.
- Costs shown in full: stamp duty, legal, refurb, holding, selling,
  Kept fee.

### 6.3 Why technology should improve returns

Be careful here. Say what we can show. Do not say what we hope.

- **Lower acquisition cost.** Direct sourcing and a tight valuation let
  us bid with confidence, not with a safety margin we cannot justify.
- **Fewer bad deals.** Refusal rules and evidence flags remove the worst
  ones before capital moves.
- **Faster turnaround.** Less time held means lower carrying cost.
- **Measured, not claimed.** Each of these is a testable claim. The
  monthly report shows whether it holds.

---

## 7. Risks (all of them, in plain words)

- **You can lose money.** Property prices can fall. Refurbs overrun. Sales
  take longer.
- **The valuation can be wrong.** Our hold-out error was 12.3%. On a
  £400k home that is about £49k.
- **Capital is illiquid.** **[State the exit terms.]**
- **Concentration.** A small number of deals means one bad one hurts.
- **Key person.** This business has one founder.
- **Regulation.** Rules for pooled property investment can change.
- **Technology.** Systems fail. Data feeds go down. The no-sale rule means
  we stop, not guess, but stopping has a cost.

---

## 8. Who we are wrong for

- Investors who want a guaranteed return.
- Investors who need to withdraw at short notice.
- Investors who do not want to read the risk section.
- Investors who want us to buy at any price to hit a deployment target.

If that is you, we will say so.

---

## 9. Before this leaves the building

**Do not send, post, or discuss this pack with any potential investor
until every item below is done.**

1. **Legal review.** Pooling money from investors to buy property can be
   a **collective investment scheme**. Sending this pack can be a
   **financial promotion**, and only an FCA-authorised firm (or an exempt
   route, such as certified high-net-worth or sophisticated investors)
   can issue one. We are **not FCA authorised**. Get a solicitor who
   specialises in this to advise on structure and on who can lawfully
   receive the pack. **We do not give a view on the law here.**
2. **Track record verified** and attributed correctly (section 4.1).
3. **Brackets filled** with facts, not guesses.
4. **Copy bar.** Checked against the Beth Sims bar in
   `docs/brand/KEPT.md`. No em dashes. No "advice". No "legally
   binding".
5. **Ship dark.** No indexing, no outreach, no public page until the
   premise survives **one real investor** reading it and telling us what
   is wrong.

---

## 10. What we need to build

Split into what exists and what does not. Honest.

### Exists today

| Capability | Where |
|:--|:--|
| Valuation, offer, margins, floor, ceiling | `packages/valuation` |
| Config-driven levers, no code change needed | `EvalConfig`, `offer-config.ts` |
| Evidence flags | `evidence-checks.ts` |
| Frozen snapshots and monthly backtest | `AvmSnapshot`, `/cron/avm-backtest` |
| Deal model: GDV, refurb, ROI, max offer for ROI | `deal-model.ts`, `gdv.ts`, `refurb.ts` |
| Per-deal investor pack, interest, updates | `InvestorPack`, `InvestorInterest`, `DealUpdate` |
| Read-only investor links | `InvestorAccessToken` |
| Held vendor emails | `OutreachHold` |

### Does not exist

| Gap | Why it matters |
|:--|:--|
| **Mandate model** (an investor's buy box as data) | Without it, "within guardrails" is only words |
| **Capital ledger** (committed, reserved, deployed, returned) | The core of the product |
| **Buy-box matcher** (deal vs mandate, with a written reason) | The automatic part |
| **Capital reservation** with a rule for competing mandates | Two investors, one deal |
| **Exposure limits** (deal, area, total) | Concentration protection |
| **Investor dashboard** (live positions, decisions, reports) | The visibility promise |
| **Investor reporting** (monthly pack with accuracy and returns) | Same |
| **Audit trail** of every match decision | Trust and compliance |
| **Kill switch** (pause all deployment instantly) | Safety |

### Suggested order

1. **Mandate and ledger schema.** Data first. Add-only migration
   (`pnpm migrate:check` then `pnpm migrate:add-only`). Never a bare
   `db push`: other branches share the live database.
2. **Buy-box matcher.** Pure function, fully tested. Input: deal,
   appraisal, mandate. Output: pass or fail, with reasons.
3. **Shadow mode.** Run the matcher on real deals for 8 to 12 weeks.
   Record what it would have done. **No capital moves.** This is the
   evidence the pack needs.
4. **Investor view.** Read-only, behind the existing access-token
   pattern.
5. **Live, with a person approving every offer.**
6. **Revisit autonomy** after the backtest reading.

---

## 11. Open questions for the founder

1. **Vehicle.** SPV, loan notes, joint venture, or something else? Needs
   legal input.
2. **Fees.** What is Kept's fee, and how is it earned?
3. **Track record.** Which deals, whose capital, and what documents exist?
4. **First investor.** Who reads the first draft? One real person.
5. **Human approval.** Agree that offers stay human-approved in v1?
6. **Conflict with the buyer network.** A capital partner gets first call
   on a deal. Does the existing syndicate list see it at all? Agents and
   current investors should not learn this from a rumour.
7. **Seller disclosure.** If a seller's home is bought with investor
   money, what do we tell the seller? Keep it honest and simple.
