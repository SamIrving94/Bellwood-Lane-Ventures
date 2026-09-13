# Where an LLM 20x's how we work — and the honest state of our leads

_Last verified against the codebase: 2026-09-12_

Written for Sam after the question: "If we put an LLM over the AVM, would
it not make sense for some reasoning to look at it? And with OpenRouter we
could use an open-source model." Short answer: yes, and most of the plumbing
already existed. This doc covers what shipped, where else the same trick
pays off, and what the lead and source quality really looks like.

## 1. What shipped (PR #112)

Everything in the Tier 1 list below, plus Tier 2 D, shipped in this PR
after the founder said "action everything". Section 2 keeps the reasoning
and marks each item.

**Batch 1 — the appraisal**

- **Deep appraisal now argues with the AVM.** The cron hands the in-house
  AVM figure (from `rawPayload.avmFull`) to the model. The model must form
  its own ARV from the comparables first, then say **agree / AVM too high /
  AVM too low**, with evidence. Result lands in `appraisal.avmCrossCheck`
  and shows under ARV on `/appraisals`.
- **Deep appraisal is now routable.** It goes through the shared client
  with feature tag `deep_appraisal`. It appears on **Settings → AI models**
  after its first run. You can set the model, a shadow challenger, and
  zero-data-retention providers. No deploy.
- **OpenRouter-only works.** It used to bail without `ANTHROPIC_API_KEY`.
  Now either key is enough.
- **It is logged.** Every call hits `LlmCallLog`, so cost and latency show
  on the usage page. Before, it was invisible.

**How to try an open-weights model safely**

1. Settings → AI models → row `deep_appraisal`.
2. Put the candidate in **Shadow model** (any `vendor/model` id).
3. Wait a week. Compare on the LLM usage page.
4. Flip it into **Model** when happy. Tick zero-data-retention: prompts
   carry vendor addresses.

Open-weights models are weaker at large strict schemas. Expect some failed
calls at first. A failure falls back to Sonnet automatically.

**Batch 2 — scout, sourcing, routing, desk**

- **Scout reads every listing's text** (feature `listing_motivation_read`,
  Haiku, before the shortlist). Upgrades the lead type when the text
  states a stronger reason than the source list implied; adds a capped,
  founder-tunable score factor; quote shown on the lead page.
- **Savills and Clive Emson are live** via LLM extraction (feature
  `auction_lot_extract`). Money and postcodes are parsed and validated by
  code, never by the model. Entry URLs are unverified from the sandbox:
  check the first Monday run's logs.
- **Photo screener and WhatsApp parser are routable** (features
  `property_photo_screen`, `whatsapp_intake_parse`). The shared client
  gained image support. The probate PDF extractor stays direct (Files API)
  but now logs to the usage page as `probate_pdf_extract`.
- **Founder desk** (feature `founder_desk`): every pending action carries a
  ranked one-line call and the why, shown on the Action Centre card. The
  morning briefing leads with the top one.
- **WhatsApp leads are scored by the same scorer** as every other lead.
  Parser confidence still gates auto-convert and is kept on the payload.

## 2. Where else an LLM 20x's the work — ranked

Rule of thumb used here: **steps, not thoughts.** Put the LLM where a person
today reads unstructured text and makes a routine call. Keep the number
that gets audited deterministic.

### Tier 1 — do next

**A. Read motivation from listing text at source.** _Shipped._
Lead scoring is 100% rule-based (`packages/scouting/src/scorer.ts`). Lead
type for listings comes from keyword rules (`lead-type.ts`), and that file's
own header records the bug where every listing silently earned the 20-point
probate credit. The only LLM screen today is the dealbreaker check, and it
runs **after** scoring, on STRONG/VIABLE leads only.
A Haiku-class read of the listing description on **every** lead would
answer: is this really distressed? Executor sale, no onward chain, cash
buyers only, needs modernisation, tenant in situ. Output a typed
`motivation` object that feeds the acquisition pillar. This is the single
biggest lift to lead quality, at well under a penny a lead.

**B. Clear the founder-action queue with a ranked desk.** _Shipped._
`docs/LEARNINGS.md` records 24 actions pending and 0 resolved in a week.
Generation is not the bottleneck. Decision throughput is. A daily desk that
ranks pending actions and drafts a one-line call per action (with the why)
turns 24 open tabs into a 10-minute review. The morning briefing already
exists (`morning_briefing`, Haiku). Extend it to draft decisions, not just
summarise.

**C. Make the four unrouted LLM calls routable.** _Shipped for two;
the other two log but stay direct (Anthropic-only features)._
Same trick as this change. These call a provider directly, are not on the
routing table, and three do not log cost:

| Call site | What it does |
|:---|:---|
| `packages/auctions/src/lot-screener.ts` | Photo condition screen (vision) |
| `packages/whatsapp-parser/index.ts` | WhatsApp intake parse |
| `packages/document-pipeline/src/probate-extract.ts` | Probate PDF extract |
| `apps/api/app/cron/overnight-research/route.ts` | Overnight analyst (web search) |

Each is a small refactor. The vision one needs image support in the shared
client, which it does not have yet.

### Tier 2 — after the above

**D. Replace brittle scrapers with LLM extraction.** _Shipped._
Savills and Clive Emson scrapers are stubs that return nothing. The Gazette
adapter was rewritten after weeks of 500s. Auction catalogues and notices
change layout; a model reading the page into a typed lot is far more robust
than a CSS selector. Same routing, same cost controls.

**E. Shadow-eval the existing Sonnet routes.**
`comp_rationale`, `offer_narrative`, `scoring_rationale`,
`agent_outreach_draft` all default to Sonnet. All are prose. Run an
open-weights shadow for a week each. Likely most can move.

**F. Use the new cross-check as a free dataset.**
Every deep appraisal now stores AVM vs LLM ARV and the delta. In three
months that is a back-test of the AVM for nothing. `scripts/avm-backtest.mts`
already exists for the outcome side.

### Where NOT to put an LLM

- **The AVM number.** Keep it deterministic and back-testable. The LLM
  challenges it. It does not replace it.
- **Score weights.** Every point must be traceable by a person. That is a
  product feature, not a limitation.
- **Sending to vendors.** Never auto-send. The hold-for-review rail stays.

## 3. Lead and source quality — the honest state

This is from the code and `docs/LEARNINGS.md`, not from a data pull. Some
items may have been fixed since they were written. Check before acting.

**Sources**

- Nine discovery sources feed `ScoutLead`. Several have been dark or thin:
  HMCTS probate returns empty without a key. Gazette had weeks of 500s.
  Savills and Clive Emson auction scrapers are stubs.
- `source-health.ts` records the lesson: for weeks the scout looked healthy
  (200 OK, ~30 leads a day) while four of six sources were dark. The leads
  were real listings carrying none of the distress signal the thesis rests
  on.
- PropertyData is the only source of listing distress (days on market,
  reductions). It is also the spend. Scouting is founder-triggered for that
  reason.
- Three PropertyData endpoints are degraded per LEARNINGS: energy-efficiency
  retired (EPC never contributes), HPI 404 (synthetic HPI feeds the AVM),
  and the valuation endpoint's floor-area unit is unconfirmed.
- `packages/property-data` now has tests for its adapters. An older
  learnings entry says it had none. That entry is stale.

**Scoring**

- Two pillars: acquisition (max 45) and ROI (max 40), plus market trend and
  risk modifiers. Verdict thresholds 70 / 50 / 30. All rule-based.
- The ROI pillar only exists after appraisal. Before that a proxy is used.
  The proxy was rewarding the opposite of a discount until 6 Sep 2026.
- WhatsApp intake sets lead score to LLM confidence × 100. That is a
  different scale from the scorer. Those leads are not comparable to the
  rest of the inbox.
- The prime track was near-empty for structural reasons recorded in
  `scripts/prime-audit.mts`: `estimatedEquityPence` is null for probate,
  receivership and Companies House leads, and a London floor was applied to
  Manchester postcodes.

**Keys and ops**

- A parallel branch (PR #111, 12 Sep) records that the **Anthropic account
  ran out of credits around 9 Sep** and four LLM features went quiet:
  deep appraisal, the photo screener, the morning briefing and the
  marketer. So the key exists; the balance did not. Every feature in this
  PR accepts `OPENROUTER_API_KEY` alone. Top up Anthropic or set the
  OpenRouter key on `bellwood-api`, and check the usage page the next
  morning.
- **PR #111 and PR #112 both change the shared LLM client.** #111 makes
  OpenRouter the primary provider with a fallback chain; #112 adds shadow
  evals for structured calls, image support and direct-call logging.
  Whichever merges second needs a careful merge of `packages/ai/claude.ts`.
- The response loop, not the pipeline, is where leads die. See Tier 1 B.

## 4. Suggested order

1. Fix the LLM balance: top up Anthropic or set `OPENROUTER_API_KEY` on
   `bellwood-api`. Confirm `PROPERTYDATA_API_KEY` while there.
2. Merge #111 and #112 with a careful merge of the shared client.
3. Week one: read the "vs in-house AVM" verdicts, the "listing says"
   quotes on new leads, and the desk calls on the Action Centre. Measure
   STRONG leads per week and actions resolved per week against the week
   before.
4. Check the first Monday auction scan's logs for Savills and Clive Emson.
5. Shadow-eval the Sonnet routes on an open-weights model (Tier 2 E).
