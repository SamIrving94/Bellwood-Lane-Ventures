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

## Added 29 Aug (evening): channels beyond probate, and the barbell

The founder's follow-up research widened the map. Probate had crowded out
three other doors, and the right mechanism differs by price band.

**The barbell:**

| Band | Who actually handles it | Mechanism |
|:--|:--|:--|
| £700k–£1.5M | Local high-street probate firms IN our hunting-list postcodes (the ~450+ small London practices), not City desks. A live competitor ("Probate Purchasers", Highgate) validates the local-referral play | Keyhole + the shelf. Tools fit this audience |
| £1.5M–£10M | Tier 1 private client (Boodle Hatfield, Farrer, Withers tier), family offices and their advisers, divorce/family solicitors, LPA receiver panels | Relationship, not software. Family-office advisers broker introductions as their core job |

**Three more doors, graded:**

- **Divorce / family solicitors** — different practice area, different
  network, and a court-order trigger date. Relationship channel (we
  dropped divorce for AUTOMATION in the Aug research; that call stands —
  this is coffee, not code).
- **Receiver panels** — seek pre-approved-buyer status with the specialist
  LPA firms, ahead of marketing. LEGAL CAUTION: receivers DO owe an
  equitable duty to obtain a proper price at the time of sale (Silven);
  what they do not owe is patience. The pitch is "certainty on the day
  you choose to sell", never "no duty, sell cheap".
- **Family offices** — calmest sellers, biggest tickets, zero tooling.
  Goes on the first-look relationship motion, asymmetry rule unchanged.

**"Ways in" before the market, graded:**

1. **Grant-stage trigger** ✅ the best idea in the batch: "IHT421 issued /
   grant received" is the moment a property becomes administratively
   sellable, weeks before an agent is instructed. This is the IHT-map
   module's killer feature — their own timeline IS the trigger.
2. **Funding the IHT gap for first-look rights** ❌ as designed. A
   lender-buyer whose facility ties to "sells to us" recreates devastavit
   in its sharpest form, sits on the FCA lending perimeter, and burns the
   shelf's neutrality. Compliant version only: signpost independent
   probate lenders, no fee, no tie, nothing more without counsel.
3. **Stopped-application alerts** ⚠️ real pain (43% of held cases) but no
   public per-case API — a true alert service means holding their case
   data. Light version instead: a "common stops and how to pre-empt
   them" checklist inside the shelf.

**Probate-delay context worth keeping** (founder research, verify before
quoting): the registry mean is down to weeks but London runs slowest; the
18-month+ tail grew ~155% since 2020/21; the real chokepoint is HMRC IHT
clearance before application; and the post-grant property sale is itself
an acknowledged 2–3 month delay layer — exactly where a two-week
completion has leverage the FIRM feels (unbillable chase time, client
blame), not just the family.

## The prime floor — RESOLVED (founder, 29 Aug)

Sam: "yes, don't change the floor." So: **£700k floor stays**, and
**£1.5M–£10M is the named CORNERSTONE TIER inside prime** — its own badge
and its own channels (relationships, per the barbell). The classifier
needs no change for the ceiling: none exists. The tier badge is a small
build, queued with the next code block rather than rushed. The
arbitrage model still referees whether the spread survives NW3/W8 prices
before any buying conviction at that level.

## Finding the grant moment — honest mechanics (added after founder Q)

"How do we find IHT421?" — three routes, in order of cleanliness:

1. **In-tool, consented (the clean one).** The IHT-timeline module asks
   the solicitor for their own case dates; when THEY mark "grant
   received", the tool serves the sale-readiness step. The trigger works
   for them, inside their file — firewall intact.
2. **Our existing Gazette scan** — the deceased-estates notices we
   already catch usually run EARLIER than the grant. Relationship starts
   at the notice; the deal becomes transactable at the grant.
3. **Commercial grant feeds** (Smee & Ford-style notification services —
   evaluate and verify before relying on it). Paid channel; a line for
   the founder list, not an assumption.

What is NOT possible, said plainly: the IHT421 itself is invisible
(HMRC → executor → registry, never public), and the public Find-a-Will
record appears ~2 weeks post-grant, searchable only by surname + death
year — **no API, no postcode browse, not scrapeable by area**.

## Tier 1 private client — what software CAN do up there (corrected)

"Relationships, not software" was overstated. Corrected: **software does
not OPEN the door at Tier 1; it keeps the door open.**

- **The vacancy guard scales UP** — an empty £5M house is a bigger
  liability than a £700k terrace. Same tool, higher stakes.
- **The decision file matters MORE at £5M** — devastavit exposure scales
  with estate value, and big-estate beneficiaries litigate.
- **White-label** (their brand in front) — already the PRD's V2 shape.
- **A counterparty pack** — proof of funds, track record, process letter
  for their file. Partly exists in the codebase already; assembly, not
  building.
- Never build: any sale process we RUN for them. Estate agency is a
  regulated activity and a conflict — we are the buyer, never the broker.

**Approved pitch line (founder, 29 Aug), for receivers and the top end:
"Certainty on the day you choose to sell."**

## What Ant is being asked

1. Agree the shelf framing (trust-first, referral-late)?
2. Which module next: **vacancy guard** (recommended) or IHT map?
3. Sign off the integrity firewall as written?
4. Extend the compliance opinion scope to the FCA perimeter points?
5. The barbell: local firms get the tools, the £1.5M–£10M tier gets
   relationships (family offices, Tier 1 private client, divorce
   solicitors, receiver panels)?
6. The prime floor: stays £700k, with £1.5M–£10M as a named cornerstone
   tier — or does the founder direction mean a true floor change?
7. Veto confirmed on IHT-gap funding tied to purchase rights?
