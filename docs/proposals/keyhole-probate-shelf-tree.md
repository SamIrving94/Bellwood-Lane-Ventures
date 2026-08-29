# The probate property shelf — opportunity-solution tree

**For:** Sam / Ant
**From:** Claude Code session (founder research + codebase mapping)
**Date:** 29 Aug 2026 (same day as the Keyhole Phase 0 ship and pivot)
**Decision needed:** which module ships next, and the integrity firewall
**Evidence:** `docs/research/executor-duty-keyhole-pivot-2026-08.md` (and
the founder's IHT/vacancy research summarised there and below — mixed
authority, all claims gated on the compliance opinion)

---

## The outcome we are actually chasing

> Be the trusted, useful presence on a probate property from the WEEK the
> instruction opens — so that months later, when the estate chooses speed,
> we are the obvious call. Never by steering. By being there.

The founder's two research passes converged on the same law: a tool that
nudges toward a sale trips the executor's liability sensor (devastavit).
A tool that reduces the executor's and solicitor's own risk and workload
gets used on every estate. Value first, referral as a byproduct of trust.

## The tree

**Outcome: earliest trusted presence on every probate property in our patch**

- **Opportunity A — the IHT catch-22 (cash-timing pain)**
  IHT is due by the end of the sixth month; the grant needs the IHT
  position settled; the estate's cash is frozen and the house cannot be
  sold pre-grant. Every taxable estate with property hits this wall.
  - *Solution:* **IHT timeline + funding-gap mapper.** Enter dates and
    rough cash position → a dated timeline (death, IHT deadline, realistic
    grant window, marketing, completion) with the funding gap flagged, and
    the four routes compared side by side: Direct Payment Scheme,
    instalments on the property share, executor funds, bridging (generic
    cost maths at published rate bands).
  - *Build:* small. Deterministic date/cost arithmetic + a printable page.
    Reuses the Keyhole page/report rails. No new data licences.
  - *Conflict:* none — we never touch the sale decision, only the maths.
  - *Regulatory rail:* generic cost illustration ONLY. No lender intros,
    no product recommendations — credit broking is FCA territory. The
    compliance opinion must cover this perimeter before Phase 2.
  - *Signal for us:* an estate whose map says "cash needed by [date]" is a
    dated future decision — see the firewall below.

- **Opportunity B — vacant-property liability (risk pain)**
  Standard cover lapses 30–60 days into vacancy; insurers impose
  inspection conditions; executors are personally exposed for burst
  pipes, theft, fire. Recurring, painful, and nothing to do with price.
  - *Solution:* **Vacancy guard.** Cliff-edge reminders (day 30/60),
    specialist-cover prompt (signpost, never arrange — insurance
    distribution is also regulated), an inspection log with photos, a
    drain-down/utilities checklist, and empty-property council-tax
    premium dates. Output: a "vacancy file" — the executor's evidence
    they managed the asset properly.
  - *Build:* light. Reuses `@repo/notifications` + Resend for reminders
    and the field-partner photo-upload rails for the inspection log.
  - *Signal:* vacancy duration is the single best deterioration proxy we
    could hold — firewall applies, hard.

- **Opportunity C — beneficiary noise (time pain)**
  Executors burn hours on "any update?" calls.
  - *Solution:* **read-only estate status page** — the solicitor shares a
    tokenised link showing stage only (insured → grant applied → grant
    received → marketing → under offer). We already built this pattern
    for sellers (`/track/[token]`). Second wave.

- **Opportunity D — title and lease health (delay pain)**
  An unregistered title or a shortening lease is months of delay and real
  money, discovered late.
  - *Solution:* flags on the existing Keyhole report: registered vs
    unregistered title (HMLR), lease length with the 80-year marriage-value
    cliff dated (`@repo/scouting` short-lease logic exists). Facts and
    deadlines, never a price. Cheap add.

- **Opportunity E — the sale-stage decision file** *(the earlier pivot,
  unchanged)* — comparables on the record, holding-cost context,
  net-proceeds comparator on user-entered figures, decision-record
  export. Where a written offer from us becomes evidence for the file.

- **Opportunity F — practicals rolodex** (clearance, locksmiths,
  unoccupied insurers). Relationship product, not code. Later; pairs
  with the clearance-firm channel from the sourcing research.

## Sequencing recommendation

1. **Vacancy guard first.** Sharpest personal-liability motivator, uses
   the most existing rails, weekly touchpoints (reminders) rather than
   one-off lookups — trust compounds through repetition.
2. **IHT map second.** Day-one utility on taxable estates; pure maths.
3. **Decision file (E) third** — it lands better once the professional
   already trusts the shelf.
4. C and D ride along as cheap adds; F when relationships warrant.

Each module ships as one page on the Keyhole rails with its own
kill-gate, not as a platform. Two-person company: modules must reuse
rails or they wait.

## The integrity firewall (non-negotiable)

The tools hold professionals' case data. **Case data is theirs, not our
scouting feed.** We never mine vacancy logs, IHT dates or status pages
for acquisition targeting. Our side of the loop is only: the professional
knows us, the tool carries one clearly-labelled, opt-in way to request a
written offer as evidence, and they press it or they don't. One breach of
this kills the entire strategy — trust IS the product.

## Regulatory rails (one list, extended from the PRD)

- No legal claims in copy before the solicitor-grade opinion.
- No credit broking, no insurance arranging — signpost and illustrate,
  generic figures only (FCA perimeter added to the opinion's scope).
- No referral fees to regulated professionals before SRA/RICS clearance.
- Never a valuation, never our figure on screen. Unchanged, load-bearing.

## What Ant is being asked

1. Agree the shelf framing (trust-first, referral-late)?
2. Which module next: **vacancy guard** (recommended) or IHT map?
3. Sign off the integrity firewall as written?
4. Extend the compliance opinion scope to the FCA perimeter points?
