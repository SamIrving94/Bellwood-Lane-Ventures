# LLM routing — OpenRouter first, open-weight challengers, one bill

_Last verified against the code: 2026-09-13_

## How a call is routed

Every LLM feature goes through `@repo/ai/claude` (`callClaude`,
`callClaudeForJson`, `callClaudeForObject`, `callClaudeWithMeta`). Since
12 Sep 2026 that includes the three that used to call Anthropic directly:
deep appraisal (`deep_appraisal`), the WhatsApp intake parser
(`whatsapp_parse`) and the photo condition screener (`property_vision`).

Order of attempts, decided by `planProviders` in `packages/ai/routing.ts`:

| Keys set | Primary | Then |
|:--|:--|:--|
| `OPENROUTER_API_KEY` (+ Anthropic) | OpenRouter, same Claude tier | Anthropic direct → chain |
| `OPENROUTER_API_KEY` only | OpenRouter, same Claude tier | chain |
| `ANTHROPIC_API_KEY` only | Anthropic direct | nothing |
| both + `LLM_PRIMARY_PROVIDER=anthropic` | Anthropic direct | OpenRouter Claude → chain |

The **chain** is per tier (override with `LLM_FALLBACK_CHAIN=a/b,c/d`):

- **fast** (Haiku-class): `anthropic/claude-haiku-4.5` → `qwen/qwen3-235b-a22b-2507` → `deepseek/deepseek-v4-flash`
- **strong**: `anthropic/claude-sonnet-4.5` → `z-ai/glm-5.2` → `moonshotai/kimi-k2.6`

A fallback runs only on a **recoverable** error: 429, 5xx, timeout,
network — and, since Sep 2026, **an empty balance or quota** on any
provider (`isBillingError`). That last one is why the crons went dark:
Anthropic reports "credit balance too low" as HTTP 400, which counted as
fatal, so the chain never ran.

**Bare vs slash ids.** `claude-sonnet-4-5` (hyphen) is Anthropic's id.
OpenRouter's is `anthropic/claude-sonnet-4.5` (dot). The client maps one
to the other; you can type either in Settings. The old chain used the
hyphen form on OpenRouter, which is not a model there.

## Testing open-weight models

Two tools, use them in this order.

1. **Bake-off (offline, minutes, pennies).**
   `pnpm tsx scripts/llm-bakeoff.mts` runs our real prompt shapes
   (vendor-reply triage, WhatsApp parse, comp rationale, morning briefing)
   across the candidates and writes `docs/llm-bakeoff/<date>.md`: contract
   pass rate, latency, live price, and every output side by side. Ids are
   checked against OpenRouter's live model list first, so a typo cannot be
   "tested". `--list qwen/,deepseek/` prints current ids and prices.

2. **Shadow eval (live traffic, silent).** In **Settings → AI models** set
   the shortlisted model as the **shadow model** for a feature. Every
   primary call is re-run on the challenger and logged to `LlmCallLog`
   under `<feature>__shadow`; nothing reaches a user. Compare on
   **/admin/llm-usage** for a week, then move it to **Model** to switch.

Rules of thumb:

- Photo features need a **vision** model: Claude tiers, `moonshotai/kimi-k2.6`,
  `meta-llama/llama-4-maverick`. Text-only models fail `property_vision`.
- Anything that sees vendor names, numbers or addresses
  (`whatsapp_parse`, `vendor_reply_triage`, outreach drafts): tick
  **PII-safe pinning** on the route. It restricts OpenRouter to vetted
  hosts with zero data retention and no training on prompts.
- Structured features (`deep_appraisal`) use schema-constrained
  generation. Not every open-weight host supports it; a model that fails
  the bake-off's JSON tasks will fail these too.
- The routing table is a `Setting` row (`model_routing`), read with a
  60-second cache. No deploy needed.

## Env vars (both Vercel projects)

| Var | Purpose |
|:--|:--|
| `OPENROUTER_API_KEY` | Primary route. One bill for every model. |
| `ANTHROPIC_API_KEY` | Optional. First fallback (or primary with the flag below). |
| `LLM_PRIMARY_PROVIDER` | `openrouter` (default when keyed) or `anthropic`. |
| `LLM_FALLBACK_CHAIN` | Optional comma list of OpenRouter ids to try after the primary. |

Prices in `/admin/llm-usage` are a hardcoded table (`PRICING`) — refresh
it when a new model enters the routing table; unknown ids are costed as
Sonnet.

## Tactic — September 2026 (founder decision, 13 Sep: "go the OpenRouter route")

Route by the JOB, not by one model for everything. Four jobs, four rows.
Every change goes in as a **shadow** first and moves to **Model** only
when the usage page shows the challenger holding up for a fortnight.

| Job | Features | Primary | Shadow (try in this order) |
|:--|:--|:--|:--|
| Bulk reads — cheap, strict JSON | `listing_motivation_read`, `auction_lot_extract`, `dealbreaker_screen`, `whatsapp_parse`, `founder_desk`, `morning_briefing`, `vendor_reply_triage` | `deepseek/deepseek-v4-flash` | `qwen/qwen3.8-27b`, then Hunyuan Hy3 (`--list tencent/` for the id) |
| Photos | `property_vision` | `minimax/minimax-m3` | `qwen/qwen3.8-27b` |
| Reasoning over money | `deep_appraisal`, `comp_rationale`, `offer_narrative` | Claude Sonnet (5 once its slug is verified, else 4.5) | `z-ai/glm-5.2`, then Hunyuan Hy4 Preview |
| Vendor-facing words | `agent_outreach_draft`, `blog_draft`, `solicitor_outreach`, `paid_ad_copy`, `ig_post_draft` | Claude Sonnet | none yet — the Beth Sims bar is a human read |

Why the split: bulk reads are pennies on an open-weight model and only
need JSON discipline, which the bake-off measures; photos need a vision
model and MiniMax M3 is the cheapest good one; the appraisal cross-check
is a binding-offer input, so the frontier model stays until the shadow
data says otherwise; outreach copy must meet the tone bar.

**What the money looks like.** At V4 Flash prices the full daily listing
read costs pennies. Screening every lead's photos on M3 costs pounds a
month. Fifty deep appraisals a day on GLM 5.2 costs under a pound a day.
Cost is no longer the lever; the sources are.

**Sequence.**

1. Locally, with the key: `pnpm tsx scripts/llm-bakeoff.mts`. It rejects
   any id that is not on OpenRouter's live list, so run
   `--list anthropic/,tencent/` first to confirm the Sonnet 5 and Hunyuan
   slugs — neither could be verified from the build sandbox.
2. Settings → AI models: set the shadow column per the table. Tick
   PII-safe pinning on `whatsapp_parse`, `vendor_reply_triage` and the
   outreach drafts.
3. After two weeks on /admin/llm-usage: flip primaries where the shadow
   held (contract pass rate at or near the Claude baseline, no `__shadow`
   failure streaks).
4. Once the Claude 5 slugs are verified, flip `ANTHROPIC_SONNET` /
   `ANTHROPIC_OPUS` in `packages/ai/routing.ts` to the 5-generation ids
   (constants are already there) and the price table follows.

Ids in this section: `minimax/minimax-m3` and `qwen/qwen3.8-27b` are
taken from their openrouter.ai model pages (13 Sep 2026); the rest are
the 12 Sep verified set. Prices in `/admin/llm-usage` updated the same day.
