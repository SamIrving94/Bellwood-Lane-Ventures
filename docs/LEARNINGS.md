# Learnings — incidents and what not to repeat

A living record of production incidents, their root cause, and the rule that
prevents a repeat. Add to the top when something breaks. Read before touching
the scout, the AVM, or any PropertyData call.

---

## 2026-08-29 — Keyhole shipped with its premise un-challenged (process, not prod)

**What broke.** Nothing in production — the framing. Keyhole Phase 0 was
designed, approved and BUILT in one day as a "free tool that quietly routes
leads to us". The founder's own legal research, run hours after the ship,
showed the core loop was mis-aimed: executors carry personal liability
(devastavit) for under-selling, so a tool that reads as a nudge toward a
cash buyer is precisely what its risk-averse audience must reject. The
pitch, CTA and PRD were pivoted the same day (written offer as EVIDENCE
for the decision file). No pilot ever saw the wrong version.

**Why it slipped through.**

- The thread was already in our hands. The PRD's own risk list said
  "professionals are skeptical of anything that looks like a sales funnel
  disguised as a tool" and flagged SRA/RICS conflicts — and the assistant
  filed those as bullets to mitigate instead of pulling the thread before
  writing code.
- "Yes, do all three" was treated as the LAST checkpoint rather than the
  trigger for one more question. Momentum beat interrogation.
- The uncertainty that WAS flagged (referral volume unproven, kill-gate
  set) was about scale, not mechanism. The kill-gate would have measured a
  mis-aimed product failing slowly instead of catching the aim.

**Why the cost stayed low (keep these mitigations).**

- Everything shipped dark: noindex, closed pilot, zero outreach. The wrong
  pitch never reached a professional.
- The build itself was framing-neutral (public data, no valuation, opt-in
  panel) — the pivot cost was copy and docs, not code.

**Rules (do not repeat).**

- **Challenge before building.** On anything strategy-shaped (new product,
  new audience, new channel), founder approval triggers ONE more message
  before code: the strongest case against, the assumption that kills it,
  and who hates this and why. Build on the second yes. It costs one
  message, not a week.
- **Interrogate the mechanism, not just the volume.** "Will enough people
  use it" is a different question from "does the value loop survive
  contact with this audience's incentives and duties". Ask both.
- **Strategy builds ship dark until the premise survives one real user.**
  Noindex, no outreach, no announcements beyond the founders. This rule
  is what made this incident cheap; it is not optional next time.

## 2026-07-17 — Scout produced 0 leads (self-inflicted)

**What broke.** The daily scout returned 0 leads on 2026-07-17. Two regressions,
both introduced the same day in one commit (41bac89, "multi-list sourcing +
typed prices-per-sqf"):

1. **Wrong response shape assumed.** The new multi-list `/sourced-properties`
   tags each property with the lists it matched. I declared the schema as
   `lists: string[]`. PropertyData actually returns `lists: {id,name}[]`
   (objects). Every response failed Zod validation, so the call returned an
   empty array. Verified in prod logs: `"Expected string, received object"` ×N.
2. **Removed an accidental rate-limit guard.** Collapsing the old six-call loop
   removed the 2.7s sleeps that were *also* spacing out the per-seed calls.
   Consecutive seeds then tripped PropertyData's `4 calls / 10s` limit (`429
   X14`).
3. A companion change, `type` on `/prices-per-sqf`, was rejected by our plan
   (`422 Invalid filter: type`) and silently returned null on every appraisal.

**Why it slipped through.**

- I built the schema from the **feature announcement text**, not the real API
  response or the docs' field types. "Tagged with its lists" was read as
  strings.
- `packages/property-data` has **zero tests**, and `tsc` cannot catch an
  API-contract mismatch (a self-consistent-but-wrong schema type-checks fine).
- Two PropertyData changes shipped **together, untested against a real
  response**, on the single most important cron.
- The pre-push build hook was skipped (`--no-verify`); it would not have caught
  this anyway, but the habit removes the last gate.

**Rules (do not repeat).**

- **Never infer an external API's response shape from marketing copy.** Capture
  one real response (a saved JSON fixture) and build the schema/parse against
  it. If you cannot capture one, do not ship the change.
- **Any change to a PropertyData call ships with a fixture-based unit test** in
  `packages/property-data` asserting the parse against a real captured payload.
  The package having no tests is itself a standing risk — the money and the
  lead flow run through it.
- **Do not change more than one external-API call per commit.** One call, one
  test, one deploy, one observed run.
- **Rate limiting lives in the client, not in accidental sleeps.** If a caller
  relies on a sibling's `setTimeout` for spacing, that is a latent bug. See the
  open item: a single global throttle in `fetchPropertyData` (≤4 calls / 10s
  per key) so no caller can trip `X14`.
- **After any scout/appraise change, watch the next real run's logs** (or
  trigger one manually) before calling it done. Heartbeat-green is not
  lead-green: the 07-17 scout heartbeat succeeded while returning 0 leads.

**Response.** Reverted `propertydata.ts` to its known-good pre-experiment state
(cd921d1) to restore the scout immediately, rather than ship a second in-place
fix untested. The improvements will be re-attempted behind a captured-response
test.

---

## Standing hazards found while investigating (pre-existing, not yet fixed)

These predate the incident above and explain why the pipeline degraded even on
"good" days. Tracked here so they are not lost.

- **`lead-appraise` has been timing out (504) since ~2026-07-13.** It does ~15
  PropertyData calls per lead × 8 leads with insufficient spacing, hits `429`
  repeatedly, and exceeds the 300s function limit, so it never records a
  heartbeat and the watchdog fires daily. Root fix = the global client throttle
  above, and/or fewer calls per lead.
- **API changes / deprecations biting live calls:**
  - `/valuation-sale` returns `400 Missing input: property_type` — we send
    `type`; the endpoint now wants `property_type`. The AVM sale cross-check has
    been failing. (Verify the exact param against the docs before changing —
    that is the whole lesson above.)
  - `/energy-efficiency` (EPC) returns HTML, not JSON — the endpoint was retired
    (May 2026). We fall back to "unavailable", so EPC never contributes.
  - `/hmlr-hpi` returns `404` — we fall back to **synthetic** HPI, which then
    feeds the AVM. Silent use of synthetic data in a real valuation is a Bet-2
    ("never silently guessed") violation.
- **`/valuation-sale`'s `internal_area` unit is UNCONFIRMED.** Nothing in this
  repo establishes whether PropertyData wants m² or sqft, and the two available
  conventions disagree: `/floor-areas` returns `total_floor_area` in m² (it is
  the EPC register), while the price endpoints are sqft-denominated
  (`/prices-per-sqf`, the `sqf` field on `/sourced-properties`). The gap is
  10.76×, and this AVM carries 15-20% of `pointEstimate`. Both callers now pass
  **m²** and the parameter is named `internalAreaSqm` — previously
  `base-valuation` sent m² and `getPropertySnapshot` declared sqft into the same
  field, so one was definitionally wrong. Founder/ops action: confirm the unit
  against PropertyData's /valuation-sale docs and convert in
  `getPropertyDataValuation` if it wants sqft. Do not change it on a hunch.
- **`ANTHROPIC_API_KEY` is not set in the `bellwood-api` production env** — the
  photo-condition vision screen is skipped entirely, so condition inference is
  off. Founder/ops action: set the key in Vercel.
- **London Gazette `/all-notices` returns HTTP 500** — the probate source (a
  primary target segment) is silently skipped. Needs a check of whether it is
  their outage or our stale query.
- **The watchdog works; the response loop does not.** 24 founder actions
  pending, 0 resolved in 7 days, many of them duplicate "cron gone silent"
  alerts. Alerts that pile up unread are the same as no alerts. Consider
  deduping repeat alerts and a weekly "unresolved criticals" digest.

**Meta-rule:** graceful degradation (skip a failed source, fall back to
synthetic) keeps the cron alive but **hides** rot. Every silent fallback should
raise exactly one deduped founder action so a human decides whether to accept
it, not discover it weeks later.
