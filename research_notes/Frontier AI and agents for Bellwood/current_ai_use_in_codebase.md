# Current AI, LLM and "agent" use in the Bellwood / Kept codebase

_Read-only study of the repo at `/home/user/Bellwood-Lane-Ventures`, 25 Nov 2026. Sources are local files, cited as `path:line`. Nothing was run against a database or an external service. The live routing table (a `Setting` row), the live `LlmCallLog` rows and production env vars are NOT visible from the repo, so anything about "what is actually configured in production" is marked as a gap._

---

## 1. LLM plumbing: what `@repo/ai` exposes, routing, models, structured output, caching, fallbacks, cost tracking, SDK version

### Takeaway
There is one shared, well-hardened single-shot LLM client (`@repo/ai/claude`) on Vercel AI SDK 4.1 with OpenRouter as the only funded route, per-feature model routing editable from the dashboard, a fallback chain, shadow evals and metrics-only logging. It supports text, schema-constrained objects, images and an OpenRouter web-search plugin, but has **no tool calling, no streaming, no multi-turn loop and no content tracing**.

### Cited Findings

**Package surface and versions**
- `@repo/ai` exports four entry points: `.` (`export * from 'ai'`), `./claude`, `./keys`, `./brand-voice` — `packages/ai/package.json:5-10`, `packages/ai/index.ts:1`.
- Dependencies: `ai ^4.1.52`, `@ai-sdk/anthropic ^1.2.0`, `@ai-sdk/openai ^1.2.0`, `@openrouter/ai-sdk-provider ^0.4.0`, `@anthropic-ai/sdk ^0.32.1`, `zod ^3.24.2` — `packages/ai/package.json:17-29`. The lockfile resolves `ai@4.1.53` — `pnpm-lock.yaml:5856`.
- `@anthropic-ai/sdk` is still listed as a dependency but no source file imports it (grep found only a comment at `packages/auctions/src/lot-screener.ts:135`). CLAUDE.md says "no `@anthropic-ai/sdk`" — `CLAUDE.md` (Tech stack, AI bullet).
- Leftover next-forge template code: `packages/ai/lib/models.ts:1-12` (OpenAI `gpt-4o-mini` chat + `text-embedding-3-small`), `packages/ai/lib/react.ts:1` (`ai/react`), `packages/ai/components/message.tsx`, `thread.tsx`. No importer of `@repo/ai/lib` or `@repo/ai/components` was found in `apps/` or `packages/`.

**Public functions** (`packages/ai/claude.ts`)
- `callClaude` (text → `string | null`) `:331-335`; `callClaudeWithMeta` (adds model/provider/viaFallback) `:338-501`; `callClaudeForJson` (tolerant JSON extraction, no schema) `:542-553`; `callClaudeForObject` (Zod-schema-constrained via AI SDK `generateObject`) `:595-696`; `extractJson` `:515-532`; `hasLlmProvider()` `:114-116`; `setLlmLogger` `:156-158`; `recordLlmCall` (for direct calls that bypass the client) `:709-711`.
- Model constants: `CLAUDE_HAIKU = 'claude-haiku-4-5'`, `CLAUDE_SONNET = 'claude-sonnet-4-5'`, `CLAUDE_OPUS = 'claude-opus-4-7'` — `packages/ai/claude.ts:96-98`. No call site uses `CLAUDE_OPUS` (grep of call sites).
- Only `generateText` and `generateObject` are imported from the AI SDK — `packages/ai/claude.ts:52`, used at `:380-394` and `:607-614`. A repo-wide grep for `streamText`, `streamObject`, `useChat`, `tools:` and `tool({` outside `node_modules` returned nothing in LLM code.
- Defaults: `maxTokens 800`, `temperature 0.3` for text (`claude.ts:369-370`); `temperature 0.2` for objects (`claude.ts:612-613`).
- "Iron rules": never throws (returns `null`), server-only, "Stateless: a single import; no module-level retry loops or queues" — `packages/ai/claude.ts:42-46`.

**Inputs the client supports**
- `images` (base64 + media type, sent as image parts ahead of the text) — `claude.ts:279-283`, `packages/ai/prompt-shape.ts:74-87`.
- `webSearch: { maxResults }` → OpenRouter web plugin `plugins: [{ id: 'web', max_results }]` — `claude.ts:285-290`, `:403-405`.
- `cacheSystemPrompt` → Anthropic ephemeral cache breakpoint, only when `system.length > 1024` — `claude.ts:258-262`, `:304-308`; implemented as message-level `providerOptions.anthropic.cacheControl` — `prompt-shape.ts:44-46`, `:66-72`. Shadow calls switch caching off — `claude.ts:459`.
- Per-attempt and total time budgets (`attemptTimeoutMs`, `totalBudgetMs`) — `claude.ts:263-272`.

**Routing**
- Resolution order: dashboard route for the feature tag → caller's hardcoded model → Sonnet — `packages/ai/routing.ts:9-12`, `claude.ts:344-347`.
- A route can carry `model`, `shadowModel`, `shadowSampleRate`, `providerOnly`, `zdr`, `denyDataCollection` — `routing.ts:30-43`.
- The router and the logger are installed through `globalThis` hooks in each app's `instrumentation.ts` because that runtime cannot import `server-only` modules — `apps/api/instrumentation.ts:5-13`, `:35-56` (logger), `:58-75` (router reads `Setting` key `model_routing`, 60-second cache).
- Dashboard editor: Settings → AI models, one row per feature with Model, Shadow model and a PII-safe tick — `apps/app/app/(authenticated)/settings/ai/routing-table.tsx:6-12`, `:63-82`; suggestion list of ids `:29-45`.
- Provider plan: with an OpenRouter key every model goes to OpenRouter first (bare Claude ids are mapped hyphen→dot), then Anthropic direct if keyed, then a per-tier chain — `routing.ts:250-308`, id mapping `:163-180`.
- Fallback chains: fast = `anthropic/claude-haiku-4.5` → `qwen/qwen3-235b-a22b-2507` → `deepseek/deepseek-v4-flash`; strong = `anthropic/claude-sonnet-4.5` → `z-ai/glm-5.2` → `moonshotai/kimi-k2.6` — `routing.ts:196-207`, `docs/LLM-ROUTING.md:23-26`.
- "OpenRouter is the only route" (founder decision, 3 Oct 2026); the Anthropic account is unfunded and the key is being retired — `docs/LLM-ROUTING.md:13-17`, `:104`; `packages/ai/keys.ts:9-16`.
- PII guardrails live on the route: host pinning, zero-data-retention, deny-training — `routing.ts:25-27`, `:90-102`; a Claude id under a third-party host pin is re-pinned to Anthropic's endpoint — `routing.ts:109-132`.
- Constants for a newer Claude generation (`claude-sonnet-5`, `claude-opus-5`) exist but are not the defaults because their OpenRouter slugs "could not be verified from the build sandbox" — `routing.ts:143-153`.

**Fallbacks and failure handling**
- `callWithFallback` walks primary then fallbacks on recoverable errors only — `packages/ai/fallback.ts:220-280`.
- Recoverable = 408/425/429, 404, 5xx, timeouts/network, billing/quota errors, invalid/empty responses and schema misses (`AI_NoObjectGeneratedError`) — `fallback.ts:144-184`, billing signatures `:112-136`.
- An empty answer or unparseable JSON counts as a failed attempt so the next model gets a turn — `claude.ts:424-428`, `:545-550`.
- Time budgets: per-attempt `min(180s, max(45s, 30s + maxTokens × 25ms))`, total deadline 270 s — `fallback.ts:44-53`. Founder direction Oct 2026: "slower is fine, cutting out is not" — `fallback.ts:31-37`.
- There is no same-provider retry with backoff inside the client; the "retry" is the next model in the chain (`fallback.ts:240-279`).

**Cost and usage tracking**
- Every call writes a metrics-only row: feature, model that answered, input/output tokens, duration, success, short error — `claude.ts:122-137`; table `LlmCallLog` — `packages/database/prisma/schema.prisma:1259-1273`. It "NEVER stores prompt or response content" — `schema.prisma:1247-1257` (comment block above the model).
- Fallback-served calls are logged as `<feature>_via_fallback` (`claude.ts:437`); shadow calls as `<feature>__shadow` (`claude.ts:456`, `:668`).
- `/admin/llm-usage` is a 7-day rollup with a **hardcoded** USD price table; unknown ids are costed as Sonnet — `apps/app/app/(authenticated)/admin/llm-usage/page.tsx:7-14`, `:20-41`, `:43-50`, `:64`.

**Shadow evals and bake-off**
- After a successful primary call, the same prompt (and schema, for objects) is re-run on the route's `shadowModel`, logged and discarded — `claude.ts:446-465`, `:658-676`.
- Offline bake-off script runs "our real prompt shapes" (vendor-reply triage, WhatsApp parse, comp rationale, morning briefing) across candidate models and writes `docs/llm-bakeoff/<date>.md` — `scripts/llm-bakeoff.mts:1-26`, `docs/LLM-ROUTING.md:68-82`. No `docs/llm-bakeoff/` directory exists in the repo (directory listing).

**Models per feature (as documented; live table not visible)**
- Code defaults per call site are listed in section 2.
- The September 2026 "tactic" table plans four job classes: bulk JSON reads on `deepseek/deepseek-v4-flash`; photos on `minimax/minimax-m3`; "reasoning over money" on Claude Sonnet; vendor-facing words on Claude Sonnet with no shadow because "the Beth Sims bar is a human read" — `docs/LLM-ROUTING.md:112-129`. Every change goes in as a shadow first — `docs/LLM-ROUTING.md:115-116`.

**Known past faults in the plumbing (context for any new technique)**
- 12 Sep–3 Oct 2026: every long-prompt marketer call failed inside the SDK because the cached system prompt was shaped as a text-part array; the fallback chain could not rescue it — `docs/LEARNINGS.md:9-45`, `packages/ai/prompt-shape.ts:8-25`.
- ~9 Sep 2026: an empty Anthropic balance took four features down for days because HTTP 400 was treated as fatal and three features bypassed the client — `docs/LEARNINGS.md:167-199`.
- The LLM logger never ran in production at one point ("zero LlmCallLog rows, ever") until the `globalThis` hook — `apps/api/instrumentation.ts:5-13`.
- Vercel logs in the 1 Oct audit still showed `@repo/ai` "all providers failed" (8) and "no object generated" (8) in seven days — `docs/mcp/01-audit.md:57-58`.

### Inferences
- The client is a good base for adding tools/agents (routing, logging, fallback, PII pinning already exist), but tool calling, streaming and multi-step loops would be new code paths: nothing in `claude.ts` passes `tools`, `maxSteps` or message history.
- Because `LlmCallLog` holds no prompt or output text, there is today no stored corpus of LLM inputs/outputs to build evals from; any eval set has to be assembled from domain tables (FounderAction metadata, GuidePost, DealEmail digests) or new opt-in tracing.
- Prompt caching only has an effect on Claude routes; if bulk features move to open-weight models (the documented tactic), the caching flag becomes a no-op for them.
- AI SDK 4.1 is the installed major; features that only exist in later SDK majors would require an upgrade of a client that has already had one SDK-shape incident.

### Gaps
- The live `model_routing` Setting row and live `LlmCallLog` data were not read, so which model each feature actually runs on today, real spend, and success rates are unknown.
- Whether `OPENROUTER_API_KEY` is set on all three Vercel projects (app, api, web) cannot be confirmed from the repo.
- Whether prompt caching through OpenRouter is actually producing cache hits is not measurable from the repo (the log has no cached-token column — `schema.prisma:1259-1273`).

---

## 2. Inventory: every feature that calls an LLM (or another AI model)

### Takeaway
I found 26 LLM feature tags in code plus three AI calls outside the shared client (probate PDF via Anthropic direct, Whisper transcription, PropertyData's hosted "George"). All are single-shot calls; almost every output lands as a `FounderAction` for human review, and nothing vendor-facing is sent by a model. Two helpers (`comp_rationale`, `scoring_rationale`) are implemented but appear to have no live caller.

### Cited Findings

**A. Sourcing and scoring (`packages/scouting`)**

| Feature tag | Where | What it does | Default model / method | Human review |
|:--|:--|:--|:--|:--|
| `listing_motivation_read` | `packages/scouting/src/motivation-llm.ts:168-175`; called at `packages/scouting/src/index.ts:1421`; cron note `apps/api/app/cron/scouting/route.ts:272-275` | Reads every listing description (≤600 chars each) and returns level, signals, leadType, evidence quote from a closed vocabulary. Upgrades lead type (never downgrades) and adds a capped score factor | Haiku, `callClaudeForObject`, temp 0, batches of 20, concurrency 4, cap 600 reads/run (`motivation-llm.ts:47-58`, `:69-75`) | Quote shown on the lead page; the score change is automatic (`motivation-llm.ts:22-26`) |
| `dealbreaker_screen` | `packages/scouting/src/dealbreakers.ts:119-126`; called `apps/api/app/cron/scouting/route.ts:295-356` | Applies the founder's own hard rules (mined from feedback notes) to STRONG/VIABLE leads | Haiku, object, temp 0, ≤20 rules, batches of 20 (`dealbreakers.ts:24-27`) | Violators are parked as `passed` with the reason, never deleted, reversible (`dealbreakers.ts:13-18`; `scouting/route.ts:375`) |
| `scoring_rationale` | `packages/scouting/src/rationale-llm.ts:90-95` | 1–2 sentence plain-English reason for a STRONG lead | Sonnet default (no model passed), text, 200 tokens | Opt-in flag `enrichRationaleLlm` defaults to `false` (`packages/scouting/src/index.ts:498`, `:672`, `:1791`); no caller passing `true` was found, so this looks dormant |

- Lead scoring itself is rule-based: "Lead scoring is 100% rule-based (`packages/scouting/src/scorer.ts`)" — `docs/LLM-LEVERAGE-REVIEW.md:73`; two pillars (acquisition max 45, ROI max 40), thresholds 70/50/30 — `docs/LLM-LEVERAGE-REVIEW.md:158-159`.

**B. Valuation and offers (`packages/valuation`, `packages/instant-offer`, `apps/web`)**

| Feature tag | Where | What it does | Default model / method | Human review |
|:--|:--|:--|:--|:--|
| `deep_appraisal` | `packages/valuation/src/deep-appraisal.ts:407-416`; schema `:59-166`; prompt `:220-240`; data gather `:251-260` | Structured bid-or-walk appraisal: comparables with exclusions, ARV with 50/80% intervals, six environmental risks, bid cap, pre-auction checklist, confidence, escalations, and an `avmCrossCheck` verdict (agree / avm_too_high / avm_too_low / no_avm) against the in-house AVM | Sonnet, `callClaudeForObject`, 4,000 tokens, 180 s attempt timeout (`deep-appraisal.ts:218`, `:410-415`) | Callers: `apps/api/app/cron/deep-appraisal/route.ts:206`, `:236` (max 10/run, `:54`) → `review_appraisal` FounderAction (`route.ts:46-48`); and `apps/api/app/cron/quote-ops/route.ts:76` |
| `comp_rationale` | `packages/valuation/src/comp-rationale-llm.ts:125-131` | "Why these comparables" paragraph for a solicitor | Sonnet default, text, cached system prompt | Exported at `packages/valuation/src/index.ts:92` but no caller found in `apps/` or `packages/` |
| `offer_narrative` | `packages/instant-offer/src/index.ts:550-557`; called `:356` | 2–3 paragraph vendor-facing narrative for the PDF / follow-up email | Sonnet default, text, cached | "NEVER load-bearing" (`index.ts:353-355`); no figure is shown on screen (`apps/web/app/instant-offer/components/chat-flow.tsx:205` `SHOW_ONSCREEN_OFFER = false`) |
| `save_the_sale_triage` | `apps/web/app/api/quote/route.ts:136-143` | Triage of a public quote submission: urgency signal, watch-outs, recommended next step for the founder | Haiku, `callClaudeForJson` + Zod `safeParse` of untrusted output (`route.ts:145-153`) | Feeds the founder's action card only |

- The AVM number itself is deterministic and not LLM-produced: "The AVM number. Keep it deterministic and back-testable. The LLM challenges it. It does not replace it." — `docs/LLM-LEVERAGE-REVIEW.md:127-128`.
- The public "instant offer" UI is a step form, "a Kept document being filled in, not a chatbot" (the earlier chat with a fake thinking delay was removed) — `apps/web/app/instant-offer/components/chat-flow.tsx:8-17`; it posts to `/api/quote` (`chat-flow.tsx:395`).

**C. Photos (vision)**

| Feature tag | Where | What it does | Default model / method | Human review |
|:--|:--|:--|:--|:--|
| `property_vision` | `packages/auctions/src/lot-screener.ts:30-31`, `:152-164` | Up to 10 public photos (fetched, ≤5 MB each, inlined as base64) → conditionScore, condition (pristine…derelict), flags, rationale, confidence | Sonnet, text call with images, then `extractJson` + Zod (`lot-screener.ts:174-191`) | Callers: Monday auction scan (cap 50 lots, `apps/api/app/cron/auction-scan/route.ts:21`, `:133`), daily lead appraise (`apps/api/app/cron/lead-appraise/route.ts:311`), and the manual lead "enrich" action (`apps/app/app/actions/leads/enrich.ts:248`). Pre-fills the deal-model condition "so the founder doesn't have to eyeball it" (`lot-screener.ts:4-10`) |

**D. Extraction from pages, messages and documents**

| Feature tag | Where | What it does | Default model / method | Human review |
|:--|:--|:--|:--|:--|
| `auction_lot_extract` | `packages/auctions/src/llm-lot-extract.ts:225-233` | Catalogue HTML → plain text (cheerio, ≤60k chars) → typed lots; money parsed by code (`parseGuideText`), postcodes regex-validated, never guessed (`llm-lot-extract.ts:15-24`) | Haiku, object, 6,000 tokens, temp 0 | Used by Savills and Clive Emson adapters (`packages/auctions/src/sources/savills.ts:9-18`); entry URLs "could not be re-verified from the build sandbox" (`savills.ts:14-18`) |
| `whatsapp_parse` | `packages/whatsapp-parser/index.ts:68-69`, `:121-129` | Pasted WhatsApp text → address, postcode, asking price, seller situation, contact, urgency, confidence | Sonnet, `callClaudeForJson` + Zod that strips unknown keys and caps lengths because the message is attacker-controllable (`index.ts:35-39`, `:134-138`) | `apps/api/app/agents/intake/whatsapp/route.ts:109`; auto-creates a ScoutLead when confidence ≥ 0.5 and an address exists (`route.ts:116`), else a manual-review FounderAction (`route.ts:204-209`); scored by the same rule scorer (`route.ts:42-58`) |
| `probate_pdf_extract` (logged name per `docs/LLM-LEVERAGE-REVIEW.md:56-57`) | `packages/document-pipeline/src/probate-extract.ts:19-25`, `:55-135`, `:364-470` | Probate grant PDF → optional Mistral OCR → Anthropic Files API upload → Claude Sonnet with the Citations beta → typed `ProbateExtract` with per-field citation spans | **Direct Anthropic HTTP**, not the shared client; returns `no_api_key` when `ANTHROPIC_API_KEY` is absent (`probate-extract.ts:59-65`) | Callers: dashboard `/documents` action (`apps/app/app/(authenticated)/documents/actions/process.ts:51`), `/agents/scout/process-probate-pdf` (`route.ts:58`, `:83`), Postmark inbound webhook (`apps/api/app/webhooks/postmark/inbound/route.ts:248`). Documented as "otherwise dark while the account is unfunded" (`docs/LLM-ROUTING.md:59-64`) |

**E. Founder desk, briefings, research**

| Feature tag | Where | What it does | Default model / method | Human review |
|:--|:--|:--|:--|:--|
| `founder_desk` | `apps/api/app/cron/pipeline-summary/route.ts:335-345`, `:429-437` | Ranks up to 40 pending actions and drafts a one-line call + why for each; stamped on `FounderAction.metadata.desk` | Haiku, object, 8,000 tokens; ids validated, ranks re-densified in code (`route.ts:440-460`) | Shown on the Action Centre card; "the founder still decides" (`route.ts:341-343`) |
| `morning_briefing` | `apps/api/app/cron/pipeline-summary/route.ts:320-327` | Daily summary of overnight activity | Haiku, text, 500 tokens | A FounderAction (`route.ts:8-11`) |
| `overnight_analyst` | `apps/api/app/cron/overnight-research/route.ts:155-165` | Web-searched morning brief for up to 5 target areas (planning, market shifts, auctions, distress signals) | Sonnet, text, OpenRouter web plugin with 8 results, 3,000 tokens (`route.ts:29-31`) | One `general` FounderAction per day, expires after 24 h (`route.ts:177-197`) |
| `deal_email_digest` | `apps/api/app/cron/_lib/deal-email-digest.ts:88-97`; schema `:30-35` | Two-line read of a logged deal email: summary, party, needsReply, nextStep | Haiku, object, temp 0; ≤6,000 chars of body; 15 per cron run (`apps/api/app/cron/google-sync/route.ts:28`) | Display-only: "nothing the model returns is acted on" (`deal-email-digest.ts:1-11`); the email is treated as untrusted data in the prompt (`:41`) |
| `feedback_insight_extraction` | `apps/app/lib/feedback/insights.ts:73-87` | Founder note (often a voice-note transcript) → sentiment, likes/dislikes by theme, dealbreakers, summary | Haiku, object, temp 0 | Runs after the response via `after()` (`apps/app/app/actions/feedback/submit.ts:80`); stored on `FounderFeedback.overrides._insights` (`submit.ts:96-104`) |

**F. Marketing and outreach drafts (all held for approval)**

| Feature tag | Where | What it does | Default model / method | Human review |
|:--|:--|:--|:--|:--|
| `ig_post_draft` | `apps/api/app/cron/marketer-daily/route.ts:147-154`, `:179-186` | Anonymised Instagram caption for yesterday's offers/completions | Haiku, object (schema with `anonymisationCheck`) | `approve_ig_post` / `approve_case_study` FounderActions (`route.ts:215`, `:347`); "NEVER auto-publishes" (`route.ts:18-19`) |
| `ig_post_draft_catchup` | `apps/api/app/cron/event-poller/route.ts:364-372` | Same, for offers the daily cron missed | Haiku, object | FounderAction |
| `vendor_reply_triage` | `apps/api/app/cron/event-poller/route.ts:212-220` | For each newly **held** outreach to an `individual` (`route.ts:175-182`): intent, summary, urgency, suggested reply, compliance flags | Haiku, object | `approve_outreach_draft` FounderAction, priority high (`route.ts:261-289`); "NEVER auto-sends" (`route.ts:26`) |
| `linkedin_topics` | `apps/api/app/cron/marketer-weekly/route.ts:108-120` | Five LinkedIn topics for the week, "anchored to UK property news of the past 7 days" | Haiku, `callClaudeForJson`, cached. The call passes only the current date; no `webSearch` option is set (`route.ts:108-120`) | One `approve_linkedin_post` action (`route.ts:165`) |
| `solicitor_outreach` | `apps/api/app/cron/marketer-monthly/route.ts:178-185` | Email + LinkedIn DM draft per solicitor firm, ≤15/run (`route.ts:28`) | Haiku, JSON, cached | `approve_solicitor_outreach` (`route.ts:199`) |
| `paid_ad_copy` | `apps/api/app/cron/marketer-monthly/route.ts:300-313` | 3 headlines + 3 bodies per segment | Haiku, JSON, cached | `approve_paid_ad_copy` (`route.ts:331`) |
| `agent_outreach_draft` | `apps/api/app/cron/agent-prospecting/route.ts:421-427` | Personalised first-touch draft for newly surfaced estate agents, ≤15/run (`route.ts:21`) | Sonnet default (no model passed), JSON, cached | `approve_outreach_draft` (`route.ts:441`) |
| `guide_topic_pick` | `apps/api/app/cron/guide-research/route.ts:169-189` | Picks 3 evergreen questions against the week's trade-press / HMLR / Reddit signals; cites signal indices, not URLs | Sonnet default, JSON, cached, 120 s total budget | Feeds the drafter; other candidates ride in action metadata (`route.ts:38-43`) |
| `blog_draft` | `apps/api/app/agents/marketer/draft-blog/route.ts:257-265` | Guide/blog draft in Kept voice from the hook and only the supplied sources | Sonnet default, JSON, 8,000 tokens, cached | — |
| `blog_compliance_audit` | `apps/api/app/agents/marketer/draft-blog/route.ts:291-298` | Second, independent "counsel" pass against CPR, NTSELAT, ICO/UK GDPR, PECR, ASA/CAP → verdict + issues | Sonnet default, JSON, cached | Both land in an `approve_blog_draft` FounderAction + a `GuidePost` draft (`route.ts:316-318`); publishing is a founder click (`apps/api/app/cron/guide-research/route.ts:45-47`) |
| `investor-pack-draft` | `apps/app/app/actions/investors/packs.ts:225-227` | Headline, snippet, summary, highlights for an investor pack from deal figures and viewing notes | Sonnet, object | Founder-triggered; "the AI drafts the copy, the founder edits it, and only the founder's click sends anything" (`packs.ts:12-19`) |

- All marketer prompts import one voice block, `KEPT_VOICE_RULES` — `packages/ai/brand-voice.ts:80-107`, imported e.g. at `apps/api/app/cron/marketer-daily/route.ts:2`.

**G. AI calls outside the shared client**
- **Voice notes**: founder feedback audio is sent to OpenAI `whisper-1`; the audio is never stored — `apps/app/app/api/transcribe/route.ts:4-7`, `:74-83`. It reads `OPENAI_API_KEY` directly and needs it on the dashboard project — `route.ts:9-14`; `CONTEXT-HANDOVER.md:76-79`.
- **"George"**: the dashboard `/research` page is a chat with PropertyData's hosted AI (`/george` endpoint), not our own model — `apps/app/app/api/research/ask/route.ts:45`, `packages/property-data/src/propertydata.ts:3344-3392`; it costs 10 PropertyData credits per call — `docs/LEARNINGS.md:69-70`.
- **Embeddings** (Voyage `voyage-3` or OpenAI `text-embedding-3-small`) — see section 5.
- **Mistral OCR** (`mistral-ocr-latest`) inside the probate pipeline when `MISTRAL_API_KEY` is set — `packages/document-pipeline/src/mistral-ocr.ts:47-48`, `probate-extract.ts:81-99`.

**H. "Agent"-named jobs that do NOT call an LLM** (checked by imports)
- `pipeline-outreach` (template substitution + Resend; auto-sends to business contacts, holds everything else) — `apps/api/app/cron/pipeline-outreach/route.ts:9-13`, `:67`, `:83-109`.
- `legal-chaser` (drafts solicitor chasers from templates, never auto-sent) — `apps/api/app/cron/legal-chaser/route.ts` header comment.
- `weekly-patterns` (aggregates the week and creates a FounderAction asking a "board"/CEO agent to answer three questions; no model call) — `apps/api/app/cron/weekly-patterns/route.ts:21-31`, `:281-306`.
- `sla-alerts`, `watchdog`, `provider-health`, `ch-stream`, `avm-backtest`, `google-daily` (the Google morning brief is assembled without `@repo/ai`; no file in `packages/google` imports it).
- Quote ops, deal updates, notifications: `packages/quote-ops` (PDF render + human approve-and-send, `packages/quote-ops/src/send-signed-offer.ts:1-7`), `packages/deal-updates` (timeline + template emails, `packages/deal-updates/src/index.ts:1-8`) and `packages/notifications` (Knock; "Dead code" per `docs/mcp/01-audit.md:103`) contain no LLM call.

### Inferences
- The LLM is used almost entirely for (a) reading unstructured text/photos into typed fields and (b) drafting words for a human to approve. That matches the "Steps vs Thoughts" principle and means the review queue (FounderAction) is the single choke point for all AI output.
- `linkedin_topics` asks for topics anchored to the last seven days of news without supplying any news or search results, while `guide_topic_pick` and `overnight_analyst` do supply signals/search. The LinkedIn basket is therefore the one drafting feature whose factual grounding depends on model memory.
- `vendor_reply_triage` is named for replies, but the code scans newly held outbound outreach. Inbound seller messages from the tracking page create a FounderAction with `workflow: 'vendor_reply_triage'` (`apps/web/app/api/track/[token]/reply/route.ts:96-127`) whose comment says the event-poller will triage it, but I found no code that reads that workflow tag. Inbound replies therefore appear to reach the founder un-triaged.
- Several features default to Sonnet for bulk or prose work (`whatsapp_parse`, `agent_outreach_draft`, `guide_topic_pick`, `blog_*`), which the routing doc intends to move or shadow (`docs/LLM-ROUTING.md:118-123`).

### Gaps
- I did not read every line of every cron; features were located by grepping for `callClaude*`, `feature:` tags and provider hosts. An LLM call hidden behind a helper with a different name is unlikely but not excluded.
- Whether `comp_rationale` and `scoring_rationale` have ever run in production is unknown (no caller found; live logs not read).
- Feature names in `docs/LLM-LEVERAGE-REVIEW.md:54-56` (`property_photo_screen`, `whatsapp_intake_parse`) differ from the code (`property_vision`, `whatsapp_parse`); the code names are used here.

---

## 3. Agent architecture: single-shot calls or loops? Orchestration, queues, retries, hand-offs

### Takeaway
"Agents" here are scheduled Vercel cron routes that each make one (occasionally two or three) single-shot LLM calls and write rows to Postgres. There are no tool-using loops, no queue, no durable workflow engine and no agent-to-agent messaging beyond database rows; the external Paperclip agent runtime was retired in July 2026.

### Cited Findings
- The external Paperclip runtime is decommissioned (verified against prod AgentEvents, 16 Jul 2026); its jobs run as internal crons that kept the agent names — `CLAUDE.md` § "Paperclip (retired)"; `docs/PAPERCLIP-SYNC-BRIEF.md:3-11`.
- Only five `/agents/*` routes remain: `auctions`, `dispatch`, `intake/whatsapp`, `marketer/draft-blog`, `scout/process-probate-pdf` (directory listing of `apps/api/app/agents`); new ones need founder sign-off — `CLAUDE.md` § "Paperclip (retired)".
- 25 scheduled crons are declared in `apps/api/vercel.json:2-103`; `scouting` is absent from the schedule by design (founder-triggered to control PropertyData spend) — `CLAUDE.md` § automation backbone; `apps/api/app/cron/_lib/heartbeat.ts:33-36`.
- The morning sequence (UTC): overnight research 05:30 → provider health 06:45 → pipeline-appraise 07:15 → pipeline-outreach 07:30 → marketer-daily 07:45 → lead-appraise 07:50 → pipeline-summary 08:00 → deep-appraisal 08:30 → SLA alerts 09:00 — `apps/api/vercel.json:3-42`.
- **No tool loop anywhere**: `generateText` is called without `tools` (`packages/ai/claude.ts:380-394`); repo grep for tool definitions returned nothing.
- The longest chains are fixed pipelines, not loops:
  - Guide research: fetch feeds/Reddit → one pick call → HTTP self-call to `/agents/marketer/draft-blog` → draft call → audit call → GuidePost + FounderAction — `apps/api/app/cron/guide-research/route.ts:26-47`, `:241`.
  - Deep appraisal: parallel data gather (HMLR, HPI, EPC, PropertyData) → one structured call — `packages/valuation/src/deep-appraisal.ts:251-260`, `:385-416`.
  - Quote ops: preflight checks → deep appraisal → render signed PDF to Blob → `approve_offer` FounderAction with a 4-hour expiry → breach watch — `apps/api/app/cron/quote-ops/route.ts` header (lines 6-26).
- **Hand-offs are database rows**:
  - `FounderAction` (type, priority, status, metadata, `dedupKey`, `expiresAt`) is the universal output — `packages/database/prisma/schema.prisma:788-814`; 20 action types — `schema.prisma:76-97`.
  - `AgentEvent` is the audit/summary log each cron writes, and the morning summary reads it — `schema.prisma:771-786`; `apps/api/app/cron/pipeline-summary/route.ts:41-44`.
  - Data passes between crons on JSON columns: lead-appraise writes `ScoutLead.rawPayload.avmFull`, deep-appraisal reads it for the cross-check — `apps/api/app/cron/deep-appraisal/route.ts:41-44`, `:56-75`.
  - `metadata.assignedToAgent` (`board`, `marketer`, `counsel`, `liaison`, `appraiser`) is still written, a label from the Paperclip era — e.g. `apps/api/app/cron/scouting/route.ts:534`, `:583`, `:670`; `apps/api/app/agents/marketer/draft-blog/route.ts:353`.
  - `/agents/dispatch` logs an event and creates one FounderAction per "assigned agent" for a campaign; its comment still describes Paperclip agents subscribing — `apps/api/app/agents/dispatch/route.ts:5-6`, `:53-66`.
- **Idempotency and safety nets instead of a workflow engine**:
  - `dedupKey` unique per action so a cron replay creates nothing — `schema.prisma:803-806`; e.g. `apps/api/app/cron/event-poller/route.ts:9-12`, `apps/api/app/cron/overnight-research/route.ts:100-114`.
  - Heartbeats in `Setting` rows + an hourly watchdog that raises one card per silent cron and auto-clears it — `apps/api/app/cron/_lib/heartbeat.ts:4-13`; `apps/api/app/cron/watchdog/route.ts` header.
  - Per-run caps bound time and spend: 8 lead appraisals, 10 deep appraisals, 50 vision screens, 15 outreach drafts, 15 email digests, 5 quote-ops — `apps/api/app/cron/lead-appraise/route.ts:31`, `deep-appraisal/route.ts:54`, `auction-scan/route.ts:21`, `agent-prospecting/route.ts:21`, `google-sync/route.ts:28`, `quote-ops/route.ts:30`.
- **Long-running handling**: 14 routes set `export const maxDuration = 800` (e.g. `apps/api/app/cron/pipeline-summary/route.ts:17`, `scouting/route.ts:27`, `agents/marketer/draft-blog/route.ts:209`), others 300/120/60. CLAUDE.md still says long routes set 300 (Vercel Pro cap).
- Post-response work uses Next's `after()` in three places — `apps/web/app/api/quote/route.ts:684`, `apps/app/app/actions/feedback/submit.ts:80`, `apps/api/app/cron/scouting/route.ts:1024`.
- No queue/workflow/tracing library is present: grep for inngest, trigger.dev, temporal, bullmq, qstash/upstash, langfuse, langsmith, helicone, braintrust, promptfoo found nothing in `apps/`, `packages/`, `scripts/` or their `package.json` files.
- Cron-to-route self-calls go over HTTP with the agent key, resolved from server-controlled URLs only — `apps/api/app/cron/_lib/self-origin.ts:1-24`; a protected-deployment URL once made every self-call 401 and "the weekly guide never produced a draft" — `self-origin.ts:17-23`.
- A known time-budget failure: `lead-appraise` timed out (504) from ~13 Jul 2026 doing ~15 PropertyData calls × 8 leads inside one function — `docs/LEARNINGS.md:333-337`.
- The stated meta-rule for degradation: "Every silent fallback should raise exactly one deduped founder action" — `docs/LEARNINGS.md:370-373`; and "'0 drafted' every day is a failure signal, not a quiet week" — `docs/LEARNINGS.md:43-45`.

### Inferences
- Work that cannot finish inside one serverless invocation (large batches, multi-step research, waiting on a human) has no home today; it is handled by capping the batch and letting the next cron run pick up the rest.
- The "agent" vocabulary (scout, appraiser, marketer, liaison, counsel, orchestrator) survives as enum values and labels, not as autonomous actors. `weekly-patterns` and `dispatch` in particular still create actions addressed to agents that no longer exist, so those cards fall to the founder.
- The FounderAction + dedupKey + AgentEvent pattern is a ready-made human-in-the-loop checkpoint for any future multi-step agent: propose → card → approve.

### Gaps
- Vercel plan limits and whether Fluid compute is enabled (which the 800-second setting implies) are not stated in the repo.
- I did not find documentation of how often crons fail in production; the watchdog cards live in the database.

---

## 4. MCP / assistant surface: `apps/plugin`, `packages/kept-tools`, `packages/mcp-server`, `docs/mcp/`

### Takeaway
Kept has a new, isolated MCP app (`apps/plugin`) exposing four public, no-login tools and four OAuth-gated "Pro" tools for partner agents and investors, built for ChatGPT and launched dark without directory review. The older stdio `@repo/mcp-server` is broken and unsafe (returns lead contact details) and is superseded.

### Cited Findings
- `apps/plugin` runs on port 3006 with MCP SDK v2 and zod 4, isolated from the rest of the monorepo — `apps/plugin/package.json:5`, `:13`, `:21`, `:25`; `CLAUDE.md` apps table.
- Two endpoints: public `/mcp` and `/pro/mcp`, both `maxDuration = 60` — `apps/plugin/app/mcp/route.ts:10`, `apps/plugin/app/pro/mcp/route.ts:17`.
- **Public tools (no auth)**: `compare_sale_routes`, `plan_inherited_home`, `estimate_renovation_cost`, `get_property_facts` — `apps/plugin/lib/public-tools.ts:63-66`, registered at `:106`, `:232`, `:298`, `:383`.
- **Pro tools (OAuth, scope = role)**: `refer_sale_to_kept`, `my_kept_referrals` (agent scope); `kept_released_deals`, `register_interest_in_deal` (investor scope) — `apps/plugin/lib/pro-tools.ts:109`, `:236`, `:356`, `:465`.
- Pro rules: identity re-read from the database on every call; agents see status and dates, never the internal auto-quote; investors never see PropertyData-derived values; writes create an Action Centre card and nothing is sent to a vendor — `apps/plugin/lib/pro-tools.ts:5-14`; referral and interest cards at `:199-206`, `:531-539`.
- Auth is a custom-built OAuth server in the app (`/oauth/authorize`, `/oauth/register`, `/oauth/token`, `.well-known` metadata) with email + 6-digit code sign-in — file list under `apps/plugin/app/oauth/*`, `apps/plugin/lib/oauth/*`; `docs/mcp/06-go-live.md:103`, `:141`.
- Tool logic lives in `@repo/kept-tools`: pure modules (CGT, inherited-home plan, money, renovation bands, sale routes, sources) plus `property-facts` reading open data (EPC, HMLR) only; "Nothing here touches PropertyData: its licence covers internal use only" — `packages/kept-tools/src/index.ts:1-9`.
- Privacy-safe usage logging: one line per call with tool, outcome and time; never arguments or results — `apps/plugin/lib/usage.ts:1-12`.
- The plugin never returns a valuation: asking "How much is my house worth?" should yield "No value. That's correct." — `docs/mcp/06-go-live.md:72`.
- **Status**: founder decision 1 Oct 2026, "high risk tolerance. Go live without OpenAI's directory review, then test and learn" — `docs/mcp/06-go-live.md:5`. It is not in the directory and reachable only in developer mode — `06-go-live.md:9-11`. Creating the Vercel project, connecting in ChatGPT and turning on Pro were still founder to-dos in that doc — `06-go-live.md:20-25`. The What's-new entry calls it a "dark launch" — `apps/app/lib/whats-new.ts:533-536`.
- Accepted risks: privacy page still draft with no ICO number; no compliance opinion; custom OAuth with no outside security review — `docs/mcp/06-go-live.md:136-141`.
- Strategy record: a sell-vs-let calculator was challenged and dropped; the plugin targets inherited homes; "Kept does not buy tenanted homes" — `docs/mcp/01b-strategy-check.md:3`, `:85-87`.
- **Old server**: `packages/mcp-server` has 9 stdio tools (HMLR, EPC, OS Places, HPI, Companies House ×2, scout DB, pipeline, founder actions) — `packages/mcp-server/README.md:16-25`; "crashes on boot (ESM/CJS import error)", stdio only, no auth, "returns lead phone numbers and emails to any caller" — `docs/mcp/01-audit.md:24-27`, `:102`. `.mcp.json` still points Claude Code at it — `.mcp.json:1-8` (and it failed to connect in this session).
- The audit that preceded the plugin found a P0 bug where every quote emailed a price to the seller — `docs/mcp/01-audit.md:28-33`; the quote route now records only a figure-free `quote_requested` update, and the only event that reveals a figure is the human approve-and-send — `apps/web/app/api/quote/route.ts:476-494`.

### Inferences
- The plugin is the only place where an external assistant can call Kept code, and it is deliberately read-mostly and figure-free. Any richer assistant surface (for example a founder-side MCP over leads and actions, "Track 3" in `docs/mcp/02-ranking.md:197`) would need the PII and auth problems of the old server solved first.
- Because Pro writes land as FounderActions, the plugin reuses the same human checkpoint as the crons.

### Gaps
- Whether the `bellwood-plugin` Vercel project was ever created and whether anyone has connected it is not recorded in the repo after 1 Oct 2026.
- `docs/mcp/00-platform-notes.md`, `02-ranking.md`, `03-improvements.md`, `04-prd.md` and `05-build-plan.md` were only skimmed by heading.

---

## 5. Retrieval and memory: embeddings, RAG, persistent memory, the knowledge base, founder feedback loops

### Takeaway
A pgvector RAG package over the `docs/` folder exists but nothing calls it, and there is no conversational or agent memory. The real "memory" is structured: founder ratings and voice notes are mined into themes and dealbreaker rules, which feed (a) an automatic lead screen and (b) human-applied scorer-weight suggestions; marketer prompts do not learn from feedback.

### Cited Findings
- `@repo/knowledge-base` provides heading-aware chunking, Voyage `voyage-3` (preferred) or OpenAI `text-embedding-3-small` embeddings normalised to 1,024 dims, and cosine top-k search over `KnowledgeChunk` — `packages/knowledge-base/src/index.ts:2-12`, `embedder.ts:3-18`, `:35-40`, `search.ts:5-13`; table `packages/database/prisma/schema.prisma:1294-1306`.
- It needs the pgvector extension enabled manually on Neon and a one-shot ingest CLI — `schema.prisma:1282-1286`; `packages/knowledge-base/README.md:16-24`, `:54`.
- **No caller**: the only reference outside the package is a dependency line in `apps/api/package.json:26`; grep for `searchKnowledge` in `apps/` found nothing. The search module's comment mentions "the concierge route" (`packages/knowledge-base/src/search.ts:34-37`) but no concierge route exists under `apps/api/app/agents` today.
- Audit note: "Search doesn't filter by embedding model" — `docs/mcp/01-audit.md:97`.
- No other embedding or vector use was found (grep for `embed(`/`embedMany` outside the package and the template `lib/models.ts`).
- **Feedback capture**: a feedback panel on leads, deals, actions etc. stores a 1–5 rating, field overrides, notes and a "perfect template" flag — `schema.prisma:818-832`; target types `:124-133`; action `apps/app/app/actions/feedback/submit.ts:46-58`.
- Voice notes are transcribed (Whisper) and the note is mined for themes and dealbreakers — `apps/app/app/api/transcribe/route.ts:4-7`; `apps/app/lib/feedback/insights.ts:11-22`.
- **Loop 1, automatic**: dealbreaker rules from recent feedback are enforced on new leads by the scouting cron — `apps/api/app/cron/scouting/route.ts:295-356`; "the screen sharpens as feedback accumulates" — `packages/scouting/src/dealbreakers.ts:4-9`.
- **Loop 2, human-applied**: the calibration page finds factors that are over/under-weighted against star ratings and proposes a specific new scorer-config value; "Nothing here auto-applies" — `packages/scouting/src/calibration-suggestions.ts:1-15`; page `apps/app/app/(authenticated)/leads/calibration/page.tsx:37-47`; apply action `apps/app/app/actions/scorer-config/apply-suggestion.ts:53`.
- `EvalConfig` is a versioned config store, not an LLM-eval store: `lead_scoring` holds scorer weights and `avm_confidence` holds offer policy — `schema.prisma:834-846`; readers e.g. `apps/api/app/cron/scouting/route.ts:228`, `apps/api/app/cron/pipeline-appraise/route.ts:24-29`. Only those two of the five `EvalType` values are used in code (`evalType: 'lead_scoring'` ×15, `'avm_confidence'` ×14 by grep); `outreach_quality`, `deal_quality`, `campaign_targeting` exist only in the enum — `schema.prisma:135-141`.
- `markedAsTemplate` is written from the panel (`submit.ts:57`) but I found no reader that uses it (grep shows only the panel and the submit action).
- The founder desk writes its recommendation onto the action (`metadata.desk`) each morning but keeps no history of whether the founder followed it — `apps/api/app/cron/pipeline-summary/route.ts:462-481`.
- The AVM-vs-LLM cross-check is stored with each deep appraisal and was flagged as "a free dataset" — `docs/LLM-LEVERAGE-REVIEW.md:120-123`.
- `weekly-patterns` gathers weekly counts and uncertainty trends into a card for a human; it does not feed prompts — `apps/api/app/cron/weekly-patterns/route.ts:281-306`.
- The old `/agents/export` route (feedback export as JSONL/CSV "for fine-tuning") is listed in the April handover — `CONTEXT-HANDOVER.md` "Agents (API endpoints exist)" — but is not among the five remaining agent routes.

### Inferences
- The only place founder judgement currently changes model behaviour is the dealbreaker screen. Edits the founder makes to drafts (held emails via `OutreachHold.editedBody`, `schema.prisma:848-866`; guide edits; pack copy) are stored but not fed back into prompts or examples.
- The knowledge base is the closest thing to retrieval infrastructure and could be switched on for internal Q&A over docs, but it indexes only `docs/*.md`, not deals, emails or leads.
- There is no per-deal or per-vendor memory object an assistant could read: context is scattered across `Deal`, `DealActivity`, `DealUpdate`, `DealEmail`, `Viewing`, `FounderAction.metadata` and `ScoutLead.rawPayload`.

### Gaps
- Whether pgvector is enabled or any chunks were ever ingested in production is unknown.
- How much feedback exists (number of rated leads, notes, dealbreaker rules) is a database question; the repo only shows the mechanism.

---

## 6. Quality control: evals, golden sets, LLM-output tests, tracing, prompt versioning, AVM backtest and hold-out

### Takeaway
The valuation engine has a serious, pre-registered measurement regime (frozen snapshots, monthly backtest, a hold-out script, sample-size rules). LLM output quality has much less: schema validation, code-side validators, a shadow-model comparison on metrics only, an offline bake-off script and unit tests with stubbed models, but no golden set of LLM outputs, no content tracing and no prompt versioning.

### Cited Findings
**LLM side**
- Unit tests exist for the client (`packages/ai/__tests__/routing.test.ts`, `fallback.test.ts`, `prompt-shape.test.ts`, `brand-voice.test.ts`) and for LLM modules using stubs: `packages/scouting/src/__tests__/motivation-llm.test.ts`, `packages/auctions/src/__tests__/llm-lot-extract.test.ts`, `lot-screener.test.ts`, `packages/whatsapp-parser/__tests__/parse.test.ts`, `packages/valuation/src/__tests__/deep-appraisal.test.ts`, `apps/api/__tests__/deal-email-digest.test.ts`. The valuation tests alias the client to a stub where `hasLlmProvider = () => false` — `packages/valuation/test-shims/ai-sdk-stub.ts:1-9`.
- Runtime guards in code rather than evals: Zod schemas on structured calls; refs/ids validated so the model "cannot invent or re-label leads" (`packages/scouting/src/motivation-llm.ts:29-31`); money parsed by code, postcodes validated (`packages/auctions/src/llm-lot-extract.ts:15-24`); the CTA link is taken from an allow-list, "never one the model chose" (`apps/api/app/agents/marketer/draft-blog/route.ts:310-311`); em dashes stripped from pack copy (`apps/app/app/actions/investors/packs.ts:248-249`).
- A mechanical banned-phrase checker exists (`findBannedPhrases`) but is only referenced by its own test, not by any drafting pipeline — `packages/ai/brand-voice.ts:109-121`; grep shows usage only in `packages/ai/__tests__/brand-voice.test.ts:47-59`.
- A second-model compliance audit runs on guides/blogs only — `apps/api/app/agents/marketer/draft-blog/route.ts:278-298`. IG drafts self-report an `anonymisationCheck` (`apps/api/app/cron/marketer-daily/route.ts` schema), i.e. the same model marks its own work.
- Shadow evals compare models on success rate, latency and cost; outputs are discarded, so quality is not compared — `packages/ai/claude.ts:446-448`; `docs/LLM-ROUTING.md:78-82`.
- The bake-off measures contract pass rate, latency and live price and prints outputs side by side "so a human can judge the writing" — `scripts/llm-bakeoff.mts:11-16`.
- No prompt versioning: prompts are inline string constants in each file; grep for `promptVersion`/`PROMPT_VERSION` found nothing. `LlmCallLog` has no prompt hash or version column — `schema.prisma:1259-1273`.
- No tracing/observability vendor for LLM calls (see section 3 grep); Sentry instrumentation "stays disabled" — `apps/api/instrumentation.ts:21`.
- Test coverage context from the Oct audit: `apps/api` had 60 tests but "only 1 route tested: /health"; `apps/web` (the public quote flow) had none — `docs/mcp/01-audit.md:47-50`.
- The "golden set" scripts are for the property-identity (UPRN) matcher, not for LLM output: a sheet of real leads/deals with blank `correct_*` columns for hand-labelling, plus an auto-prefill with AUTO/CHECK/CONFIRM/PICK statuses — `scripts/export-golden-set.mts:1-20`, `scripts/prefill-golden-set.mts:1-21`. The target path `docs/data-quality/` does not exist in the repo.

**AVM side**
- Every `runAVM` call site freezes an `AvmSnapshot` (input, result, point estimate, range, offer, confidence, comps path, engine git sha, config version) and never edits it — `docs/AVM-BACKTEST.md:12-20`; model `schema.prisma:416-457`.
- `/cron/avm-backtest` runs on the 28th, matches each pending snapshot to the first later Land Registry sale of the same house (match score ≥ 0.85), excludes homes Kept bought, expires after 18 months, and reports MdAPE, MAPE, bias, PE10/PE20 and range coverage by segment — `docs/AVM-BACKTEST.md:21-35`, `:39-50`.
- Sample-size rules: under 30 matched sales no verdict; under 200 directional only; a segment needs ~100 — `docs/AVM-BACKTEST.md:66-74`.
- `scripts/avm-holdout.mts` values ~200 real recent sales as of just before each sold, using free data only, and compares method variants; first reading 23 Oct 2026 on 209 sales: median error 15.6% current → 12.3% for the shipped size-led variant — `scripts/avm-holdout.mts:1-28`; `docs/AVM-BACKTEST.md:98-111`. It "MODELS the radius method — it does not call production" — `scripts/avm-holdout.mts:12-15`.
- Target: median AVM error ≤ 8% — `docs/DECISION-STACK.md:95`; an external review estimated the then-current method at roughly 10–14% MdAPE and said "The current AVM is not credible enough to set an offer without human comp review" — `docs/research/scout-appraisal-review-2026-09.md:27-28` (that file labels itself external research to verify, `:3-8`).
- As of the 1 Oct audit: "No AVM accuracy evidence yet. The backtest has only just started. No reading exists." — `docs/mcp/01-audit.md:34-37`.

### Inferences
- The AVM discipline (freeze, measure, hold-out before shipping, sample-size honesty) is the house standard a future LLM eval regime would be expected to match; the founder has already accepted "measure first" as the rule for exceptions.
- The cheapest missing piece is a small labelled set per LLM feature (for example motivation reads, WhatsApp parses, email digests) so that shadow runs can be scored on correctness rather than only on "did JSON come back".
- Human review is currently the main quality gate for prose; there is no record of how often drafts are edited or rejected being used as a quality metric, although the raw data (action status, `editedBody`) exists.

### Gaps
- No backtest reading is recorded in the repo; whether one has appeared since October is unknown.
- Whether a bake-off or a shadow comparison has actually been run and what it showed is not recorded.

---

## 7. Constraints and decisions that bound new AI ideas

### Takeaway
New AI work is bounded by a long list of explicit founder decisions: a human sends everything vendor-facing, no price before a viewing and no figure on screen, the AVM is frozen pending measurement, OpenRouter only, no unofficial channels or scraping of portals, strict privacy rules on email, and a process rule to challenge strategy before building and to ship it dark.

### Cited Findings
**Operating principle**
- "Steps vs Thoughts": automate steps (scraping, enrichment, scoring, drafts), protect thoughts (vendor calls, negotiation, final judgment) — `CLAUDE.md` § What this is; `docs/DECISION-STACK.md:55-59`. "Software should hand the founder a decision, never a blank page" — `docs/DECISION-STACK.md:59`.
- Bet 3: "Founder-in-the-loop automation, not a call centre… One operator should run a deal flow that normally needs a team" — `docs/DECISION-STACK.md:77-80`.
- Where NOT to put an LLM: the AVM number, score weights ("Every point must be traceable by a person"), sending to vendors — `docs/LLM-LEVERAGE-REVIEW.md:125-131`.

**Communications**
- Vendor-facing emails are never auto-sent; always held (`OutreachHold`) — `CLAUDE.md` § Conventions (safety rails); implemented as an allow-list of business contact types (`estate_agent`, `solicitor`, `investor`, `sourcer`), everything else fails closed — `apps/api/app/cron/_lib/contact-routing.ts:15-32`, `:41-44`.
- The hold is also a compliance rail (TPS/CTPS, legitimate interest, PECR) — `docs/SOURCING-PLAYBOOK.md:57-62`.
- Iron rule: "no public-facing content goes live without CEO approval" — `docs/marketing/PLAN.md:285-287`.
- Gmail is drafts only for anything vendor-facing; the only send is to the Kept mailbox itself; personal Gmail accounts refused; Google failures are log-and-carry-on — `CLAUDE.md` § Conventions (Google); `docs/GOOGLE-WORKSPACE.md:10`, `:20-26`.
- Legal chasers to solicitors are founder-reviewed before sending — `docs/architecture/legal-orbital.md:42-45`.
- LinkedIn automation is out: "accounts get banned; we draft, the human sends" — `docs/DECISION-STACK.md:155`.
- No unofficial WhatsApp client; intake is paste-only; the official route (WhatsApp Business Platform) needs a founder decision first — `CLAUDE.md` § Services; enforced in the intake schema, which no longer accepts `bridge` — `apps/api/app/agents/intake/whatsapp/route.ts:9-11`.
- CEO escalation for offers under 60% of AVM; SLA breaches deduplicated — `CLAUDE.md` § Conventions (safety rails).

**Prices and promises**
- No indicative offers and no generated figure on screen; offers are reviewed by a person and sent by email after viewing — `CLAUDE.md` § Conventions; `docs/brand/KEPT.md:147`; gate `apps/web/app/instant-offer/components/chat-flow.tsx:205`.
- Public promise: 24-hour response → view every property → written offer within two working days of viewing, binding on Kept for a week → completion in weeks; never advertise faster internal targets; the live site wins over docs — `CLAUDE.md` § Public promises; `docs/brand/KEPT.md:138-143`.
- Copy rules: Beth Sims bar; no em dashes; never "advice" (not FCA authorised); never "legally binding"; no numbers in probate copy; never "AI", "algorithm", "machine learning", "powered by" in copy — `docs/brand/KEPT.md:100-131`, `:147-155`; `packages/ai/brand-voice.ts:50-75`, `:94-107`.
- Anonymisation for any content about a real property: postcode area only, no names, no distinguishing features, 30-day delay after completion — `docs/marketing/PLAN.md:421-433`.
- Distress-related content must signpost StepChange and Citizens Advice; no urgency or fear-led messaging — `docs/marketing/PLAN.md:398-411`; `packages/ai/brand-voice.ts:100`.
- Derived docs must be updated in the same commit as any public copy change, and stamped — `CLAUDE.md` § Keeping the derived docs evergreen.

**Valuation**
- The AVM never values without a sale: three evidence tiers, else `InsufficientEvidenceError` and a recorded no-valuation state — `CLAUDE.md` § Conventions (AVM).
- Every `runAVM` call site must freeze a snapshot; the AVM method does not change until the backtest reads, with two measured exceptions (EPC-by-UPRN floor area, 18 Oct; size-led blend, 25 Oct); "Judge future method changes on the same hold-out before they ship" — `CLAUDE.md` § Conventions (AVM); `docs/DECISION-STACK.md:164-170`.
- Never fabricate identifiers; resolve or fail loudly (SW3 incident) — `CLAUDE.md` § Conventions.
- Never fall back to synthetic data silently; synthetic leads were purged and "Do not re-enable a synthetic fallback" — `docs/scouting-roadmap.md:26`; `docs/LEARNINGS.md:345-347`.

**Data, privacy and licences**
- OpenRouter only; no raw Anthropic fetches, no `@anthropic-ai/sdk`, use `hasLlmProvider()` — `CLAUDE.md` Tech stack; `docs/LLM-ROUTING.md:13-17`.
- Anything that sees vendor names, numbers or addresses should have PII-safe pinning ticked (zero retention, no training) — `docs/LLM-ROUTING.md:88-92`. The audit notes "PII goes to many processors. Needs DPAs." — `docs/mcp/01-audit.md:80`.
- Email log: store only deal mail, never guess the deal, never fetch bodies of non-deal mail, never widen the match, read-only apart from one label, attachments never copied, the model's read is display-only — `CLAUDE.md` § Conventions (email log); `docs/GOOGLE-WORKSPACE.md:42-69`.
- PropertyData: internal use only (cannot be shown publicly) — `docs/mcp/01-audit.md:21-23`; 60-day cache ceiling — `docs/LEARNINGS.md:55-63`, `:108-110`; schemas must be written from real saved responses, one external-API change per commit, probe before adding an endpoint — `docs/LEARNINGS.md:223-225`, `:304-312`, `:114-117`.
- Scouting is founder-triggered to control PropertyData spend — `CLAUDE.md` § automation backbone.
- No portal scraping (Rightmove/Zoopla): ToS and UK GDPR exposure; pursue a licensed feed — `docs/SOURCING-PLAYBOOK.md:37`, `:95-96`.
- The plugin logs no user inputs because "a user's case data is theirs, not ours" (probate firewall) — `apps/plugin/lib/usage.ts:5-9`.
- LLM logs hold metrics only, "GDPR-safe by design" — `schema.prisma:1247-1252`.

**Process**
- Challenge before building: on anything strategy-shaped, state the strongest case against, the killer assumption and who hates it; build on the second yes; strategy builds ship dark (noindex, no outreach) until one real user validates the premise — `CLAUDE.md` § Working in this repo; `docs/LEARNINGS.md:227-270`.
- No new `/agents/*` routes for external runtimes without founder sign-off — `CLAUDE.md` § Paperclip (retired).
- Announce founder-visible features in `apps/app/lib/whats-new.ts` — `CLAUDE.md` § Working in this repo.
- The founder is dyslexic: short sentences, bullets, bold keywords; this is baked into prompts too (e.g. `apps/api/app/cron/overnight-research/route.ts:132-138`) — `CLAUDE.md` § What this is.
- Scope exclusions: no lettings and no tenanted homes (`docs/mcp/01b-strategy-check.md:85-87`; `docs/mcp/01-audit.md:17-20`); no conveyancing software, anchor to Orbital-powered firms (`docs/architecture/legal-orbital.md:7-11`); no Meta/Instagram ads, no call centre, not buying every deal (`docs/DECISION-STACK.md:150-158`); no X, Pinterest, Reddit posting, influencers, affiliates (`docs/marketing/PLAN.md:437-448`); one guide a week, no news-reaction posts (`docs/marketing/PLAN.md:251-254`).
- The agent side and the methodology page are hidden (404) since 11 Oct 2026, and channels that land on them are paused — `docs/marketing/PLAN.md:5-10`.
- Compliance posture still open: a compliance opinion (SRA/RICS referral rules, FCA perimeter) was to be commissioned — `docs/OCTOBER-LAUNCH.md:61-64`; executors' personal liability shaped the Keyhole pivot — `docs/LEARNINGS.md:229-236`.

### Inferences
- Any idea that speaks to a seller without a human in between (voice agents answering sellers, auto-replies, chat that quotes a figure) conflicts with at least three rails at once: never auto-send, no figure before viewing, and "protect the thoughts".
- Ideas that read, rank, extract, check or draft for the founder fit the rails directly, provided output lands as a held draft or a card.
- An LLM may critique the AVM but changing the number's method needs hold-out evidence first; an LLM-derived valuation would also break the "never value without a sale" and traceability rules.
- Sending seller data to new model hosts or tools needs the PII pinning route and, per the audit, data-processing agreements.

### Gaps
- `docs/brand/DESIGN-REFERENCES.md`, `REBRAND-NOTES.md`, `docs/PRIME-SCOUT.md` and the proposals/PRDs were skimmed only; they may hold further decisions (for example the "integrity firewall" and "IHT-funding veto" named at `docs/OCTOBER-LAUNCH.md:53-56`, which I did not trace).
- I found one inconsistency inside the constraints themselves: the marketer prompt block still states "Same-day response" and bans the phrase "24-hour" (`packages/ai/brand-voice.ts:24`, `:60-61`; last changed 3 Oct 2026 per `git log`), while CLAUDE.md and `docs/brand/KEPT.md:139` give the promise as a 24-hour response (founder, 18 Oct 2026). Which is intended for generated copy is unresolved in the repo.

---

## 8. Bottlenecks and gaps: manual work, known-broken pieces, absent capabilities

### Takeaway
The recorded bottleneck is the founder's decision throughput, not generation: a review queue that piled up unresolved, plus hands-on work that the rails keep human (calls, viewings, sending). Around that sit several dark or half-wired pieces (probate PDF extraction, the knowledge base, the old MCP server, unverified auction sources, an unused Google connection) and whole capability classes that do not exist yet (tool-using agents, voice with sellers, browser automation, LLM evals, durable workflows, memory).

### Cited Findings
**Where the founder still does repetitive manual work**
- "24 founder actions pending, 0 resolved in 7 days… Alerts that pile up unread are the same as no alerts" — `docs/LEARNINGS.md:365-368`; "Generation is not the bottleneck. Decision throughput is." — `docs/LLM-LEVERAGE-REVIEW.md:84-90`; "The response loop, not the pipeline, is where leads die" — `docs/LLM-LEVERAGE-REVIEW.md:183`. The founder desk and a "Clear all (keep blogs)" button were added in response — `apps/api/app/cron/pipeline-summary/route.ts:335-345`; `apps/app/lib/whats-new.ts:126-129`.
- Every vendor-facing email is approved one by one, with optional edit, then sent via Resend or pushed to Gmail drafts — `apps/app/app/actions/outreach/review-hold.ts:9-21`, `:35-49`; `docs/GOOGLE-WORKSPACE.md:10`.
- Every marketing artefact (IG, LinkedIn, case study, solicitor outreach, ad copy, guides) needs approval; LinkedIn posts are posted by hand; founder personal posts are manual — `docs/marketing/PLAN.md:263-287`.
- "The gap since the Marketer agent was retired is a person to run it" (hire a PPC freelancer; founder approves every ad text) — `docs/OCTOBER-LAUNCH.md:86-103`.
- WhatsApp deal flow is copy-and-paste into `/intake` — `CLAUDE.md` § Services; `apps/app/app/actions/intake/paste.ts:21-40`.
- Scouting runs only when the founder presses "Run scout now" — `CLAUDE.md` § automation backbone.
- Every property is viewed in person; viewing reports come from field partners on a mobile form (condition scores, refurb estimate, photos, motivation read, red flags) and are then reviewed by a founder — `schema.prisma:583-613`; `review_viewing_report` action type `schema.prisma:94`.
- Unfiled emails wait for the founder to pick the deal — `docs/GOOGLE-WORKSPACE.md:55-57`.
- Street-only leads need the founder to "pin the home" — `apps/app/lib/whats-new.ts:320-323`.
- Scorer and offer-policy tuning is by hand through versioned configs (suggestions are proposed, a human applies) — `packages/scouting/src/calibration-suggestions.ts:11-15`.
- Golden-set labelling for the UPRN matcher is manual ("a labelled sheet is hours of work") — `scripts/export-golden-set.mts:12-14`.
- The weekly pattern review card asks a human to write the three answers — `apps/api/app/cron/weekly-patterns/route.ts:287-296`.
- The quarterly distress-page compliance audit is "manual (no cron yet)" — `docs/marketing/PLAN.md:277`.
- Relationship channels are explicitly founder work, not code: ground-rent funds, probate solicitor partnerships, buying agents — `docs/architecture/sourcing-channels.md:141-153`; `docs/OCTOBER-LAUNCH.md:93-97`.
- Per the October board: "every open item above is a decision, an env var, or a relationship" — `docs/OCTOBER-LAUNCH.md:116-118`.

**Known-broken, dark, stubbed or unverified**
- Probate PDF extraction depends on the unfunded Anthropic account and is "otherwise dark"; moving it is "a product decision" — `docs/LLM-ROUTING.md:59-64`; `packages/document-pipeline/src/probate-extract.ts:59-65`.
- `@repo/mcp-server` crashes on start and exposes lead PII — `docs/mcp/01-audit.md:24-27`.
- `@repo/knowledge-base` has no caller (section 5).
- `comp_rationale` and `scoring_rationale` have no live caller (section 2).
- HMCTS probate source is a placeholder returning `[]`; the endpoint "does not exist publicly"; commercial probate APIs cost £400–£800/month and are deferred — `docs/scouting-roadmap.md:14`, `:24-26`, `:96`.
- Savills and Clive Emson run on LLM extraction but their entry URLs were never verified from the build sandbox — `packages/auctions/src/sources/savills.ts:14-18`; auction results (hammer prices) are not scraped at all — `savills.ts:20-21`, `packages/auctions/src/sources/clive-emson.ts:19`, `:41`.
- Short-lease screening has no data source (lease length unreachable) — `docs/LEARNINGS.md:100-104`, `:136-141`.
- PropertyData caveats: `/valuation-sale` area unit unconfirmed; HPI fell back to synthetic — `docs/LEARNINGS.md:344-358`.
- Deal email log: "Not yet used against a live Google account" (23 Nov 2026) — `docs/GOOGLE-WORKSPACE.md:33`.
- Google "not built yet": offer letter as a Google Doc (needs signed-off seller wording), travel time on viewing events, bank holidays in the two-working-day sum — `docs/GOOGLE-WORKSPACE.md:122-129`.
- Public `/intake` API route still has TODOs for the confirmation email and team notification — `apps/api/app/intake/route.ts:64-65`.
- The resale workflow and the CRM link between quotes and contacts were listed as not built (April) — `docs/HANDOVER.md:162-175`; resale and CRM link still sit under "Later" — `docs/DECISION-STACK.md:143-147`.
- Lease and contract PDFs are pushed through the probate extractor with "field coverage looser"; wiring them to `LegalDocument` is "Later (not now)" — `schema.prisma:1309-1326` (comment block above `DocumentExtract`); `docs/architecture/legal-orbital.md:58-63`.
- `packages/notifications` (Knock) is dead code; security (Arcjet) is off without a key — `docs/mcp/01-audit.md:103-104`.
- Plugin: not in the directory, privacy page draft, no compliance opinion — `docs/mcp/06-go-live.md:9-11`, `:136-141`.
- Doc/code drift worth knowing: CLAUDE.md says `maxDuration = 300` while 14 routes use 800 (section 3); `@anthropic-ai/sdk` still a dependency (section 1); the brand-voice promise wording (section 7); a Postmark inbound webhook for forwarded PDFs still exists (`apps/api/app/webhooks/postmark/inbound/route.ts:12-36`) although the email log deliberately uses no Postmark.

**Capabilities that are absent (checked by search)**
- **Tool-calling / multi-step agents**: none (section 3).
- **Streaming or a conversational assistant of our own**: none; the only chat is PropertyData's George (`apps/app/app/(authenticated)/research/page.tsx:11`).
- **Voice with sellers/agents, call recording, call notes**: none. Voice exists only as Whisper transcription of the founder's own feedback notes (`apps/app/app/api/transcribe/route.ts:4-7`). There is no call or transcript model in the schema; the nearest are `Deal.notes` and `DealActivity` (`schema.prisma:190`, `:278-288`).
- **Vision beyond listing/auction photos**: the screener is called only from the auction scan, lead appraise and lead enrich (section 2). `Viewing.photos` (partner photos, `schema.prisma:600`) and investor-pack images are not passed to any model; no floor-plan or document-image reading was found.
- **Document extraction beyond probate grants**: one pipeline, Anthropic-direct, currently dark (above). Email attachments are listed by name only and never read — `docs/GOOGLE-WORKSPACE.md:62-63`.
- **Browser automation**: none; scraping is `fetch` + cheerio with a polite user agent (`packages/auctions/src/llm-lot-extract.ts:39-48`).
- **LLM evals / golden sets / content tracing / prompt versioning**: none (section 6).
- **Durable workflows / queues / background jobs beyond cron**: none (section 3).
- **Memory / retrieval in prompts**: none in use (section 5).
- **Web research inside deal work**: web search is used only by the overnight brief; deep appraisal reasons about environmental risks "from postcode + known geological knowledge" rather than looked-up data — `packages/valuation/src/deep-appraisal.ts:232`.
- **Fine-tuning or learned ranking**: none; scoring is rule-based with hand-tuned weights (`docs/LLM-LEVERAGE-REVIEW.md:73`, `:158-159`). An external review recommended capacity-based ranking with 10–15% exploration and calibrated probabilities as outcomes accumulate — `docs/research/scout-appraisal-review-2026-09.md:25`, and its "priority" formula section (external research, to verify).
- Planned-but-not-done LLM items: shadow-evaluating the Sonnet prose routes on open-weight models (Tier 2 E) and using the AVM cross-check as a dataset (Tier 2 F) — `docs/LLM-LEVERAGE-REVIEW.md:115-123`, `:195`; multi-touch letter sequencing and receiver/mortgagee flag parsing on auction text — `docs/SOURCING-PLAYBOOK.md:91-94`.

### Inferences
- The highest-value AI help is likely on the review side (triage, batching, pre-checking, summarising what changed, learning from the founder's edits), because the rails keep the sending and deciding human and the queue is where work stalls.
- Reading documents and photos the business already holds (viewing photos, lease/contract packs, email attachments, auction legal packs) is an obvious unserved "steps" area, but it touches the email-log rule (attachments are not copied out of Gmail) and the dark probate pipeline.
- Inbound seller messages (tracking-page replies, emails needing a reply via `DealEmail.needsReply`) are detected but not drafted against; a held-draft reply flow would fit the existing `approve_outreach_draft` pattern.
- Because much is "built but dark", cheap wins exist before anything new: route probate extraction through OpenRouter, wire or delete the knowledge base, verify the auction URLs, fix the doc drift.

### Gaps
- Current queue size and resolution rate are database facts; the "24 pending, 0 resolved" figure is from an undated standing-hazards note written around July–September 2026 and may be stale.
- How many deals, viewings, emails and calls actually flow per week is not in the repo, so the size of each bottleneck cannot be ranked from code alone.
- I did not read the dashboard page components in depth; some manual steps in the UI may be missing from this list.

---

## 9. Data assets that could feed learning loops (`packages/database/prisma/schema.prisma`, 1,526 lines, ~45 models)

### Takeaway
The schema already captures most of what learning loops need: lead features and scores with config versions, frozen valuations with later sale outcomes, founder ratings and mined notes, held-and-edited drafts, action outcomes, emails with digests, viewing reports and realised deal economics. What is missing is LLM input/output content, call records, and explicit links from outcomes back to the prompts or models that produced a draft.

### Cited Findings

| Model | What it holds that is useful | Where |
|:--|:--|:--|
| `ScoutLead` | source, leadType, track, score, verdict, `rawPayload` (factor stack, motivation read, AVM, vision assessment, dealbreaker flag), status (new/shortlisted/watching/passed/converted), `convertedDealId`, `evalConfigVersion`, UPRN + confidence | `schema.prisma:290-340` |
| `Deal` | stage history fields, asking/offer/market value, verdict, seller type, solicitor fields; **actuals**: acquisition price, refurb/legal/other costs, exit price, realised profit; sourcing-fee lifecycle; release-for-resale flag | `schema.prisma:172-277` (actuals `:233-245`) |
| `DealActivity`, `DealUpdate` | per-deal event timeline with kinds and visibility | `schema.prisma:278-288`, `:966-1014` |
| `AvmResult` | full AVM JSON per deal with risk score and config version | `schema.prisma:390-405` |
| `AvmSnapshot` | frozen estimate + inputs + engine sha; later `soldPricePence`, `soldDate`, match score | `schema.prisma:416-457` |
| `FounderFeedback` | 1–5 rating, overrides (incl. `_insights`: themes, dealbreakers), notes, template flag, per target type | `schema.prisma:818-832` |
| `EvalConfig` | versioned scorer and offer-policy configs with activation times | `schema.prisma:834-846` |
| `FounderAction` | every AI output and alert: type, priority, status (pending/completed/dismissed/expired), resolver, timestamps, metadata (drafts, triage, desk call, appraisal payload) | `schema.prisma:788-814`; statuses `:114-120` |
| `AgentEvent` | per-run summaries and payloads (source health, backtest rollups, uncertainty events) | `schema.prisma:771-786` |
| `OutreachHold` | rendered subject/body, founder `editedBody`, status held/approved/rejected/sent | `schema.prisma:848-866` |
| `OutreachCampaign`, `OutreachTemplate`, `OutreachRecipient`, `Contact`, `EstateAgentContact`, `Campaign` | who was contacted with what template and step; contact tags | `schema.prisma:668-767`, `:1145-1175` |
| `DealEmail` | deal mail both directions: bodies, reply text, how the deal was matched, LLM summary, party, `needsReply`, `nextStep`, attachment names | `schema.prisma:498-548` |
| `Viewing` | partner condition scores per area, refurb gut-feel, photos, vendor motivation read (hot/warm/cold), summary, red flags | `schema.prisma:583-613` |
| `WorksProject`, `WorkOrder` | refurb budgets vs actuals per trade package | `schema.prisma:628-666` |
| `AuctionLot` | guide prices, `visualAssessment`, `sold`, `soldPricePence` | `schema.prisma:870-896` |
| `QuoteRequest`, `QuoteOffer` | inbound enquiries and the generated (undisplayed) quote | `schema.prisma:915-964` |
| `WhatsAppIntake` | raw pasted text, parsed fields, confidence, parse status, linked lead | `schema.prisma:367-388` |
| `DocumentExtract` | per-PDF extract JSON with confidence and provenance | `schema.prisma:1328-1346` |
| `GuidePost` | drafts with hook, sources shown to the model, compliance report, status draft/approved/published | `schema.prisma:1491-1526` |
| `InvestorPack`, `InvestorInterest`, `InvestorAccessToken` | packs sent and who registered interest | `schema.prisma:1034-1143` |
| `KeyholeReport` | open-data reports for professionals and opt-in referrals | `schema.prisma:350-365` |
| `GraphEntity`, `GraphEdge` | deterministic company ↔ property ↔ lender graph with provenance; read-only, "NEVER changes scoring or gating" until hit-rates justify it | `schema.prisma:1195-1245` |
| `PropertyBatch`, `PropertyBatchItem` | the bi-weekly pipeline spreadsheet runs (appraise, rank, diff) | `schema.prisma:1362-1442` |
| `LlmCallLog` | metrics only, no content | `schema.prisma:1259-1273` |
| `KnowledgeChunk` | embedded doc chunks (if ever ingested) | `schema.prisma:1294-1306` |
| `PropertyDataCache` | cached PropertyData responses (60-day licence ceiling) | `schema.prisma:1444-1460`; `docs/LEARNINGS.md:55-63` |

- Natural labelled pairs already implied by the schema:
  - AVM estimate → later sale price (`AvmSnapshot`), the one loop that is actually closed today — `docs/AVM-BACKTEST.md:10-35`.
  - Deep-appraisal `avmCrossCheck` verdict → later sale price — `docs/LLM-LEVERAGE-REVIEW.md:120-123`.
  - Lead features and score → founder triage status, star rating and conversion (`ScoutLead.status`, `convertedDealId`, `FounderFeedback`).
  - Model draft → founder-edited final (`OutreachHold.renderedBody` vs `editedBody`; guide text edits via `apps/app/app/actions/guides/edit.ts:10-32`).
  - Founder desk recommendation → what the founder did (`FounderAction.metadata.desk` vs `status`/`resolvedAt`).
  - Vision condition read → partner's on-site condition scores (`AuctionLot.visualAssessment` / lead payload vs `Viewing.conditionScores`).
  - WhatsApp parse confidence → whether manual review was needed (`WhatsAppIntake.parseStatus`).
  - Refurb estimate → actual refurb cost (`Deal.refurbCostPence`, `WorkOrder`).

### Inferences
- The scarce ingredient is volume, not schema: an early-stage business will have few completed deals, so loops with frequent outcomes (triage decisions, draft edits, vision vs viewing, AVM vs sales of homes it did not buy) will mature long before loops that need completions.
- Much of the richest signal is inside untyped JSON (`rawPayload`, `metadata`, `overrides`), which makes it usable by an LLM reader but awkward for SQL analysis without extraction.
- There is no table tying a human outcome back to the model, prompt and inputs that produced the draft; adding even a model id and prompt hash to action metadata would make later comparisons possible (some routes already store the model, e.g. `apps/api/app/cron/overnight-research/route.ts:191-198`).

### Gaps
- Row counts and fill rates are unknown (no database access by design).
- I did not read `QuoteRequest`, `InvestorPack`, `WorksProject` and `PropertyBatch` field by field; line ranges for those are approximate model spans.
- Retention rules for personal data in these tables (needed before using them for learning) were not found in the files read.

---

## 10. External data and integrations already wired (and which are stubbed or unfunded)

### Takeaway
The platform already has adapters for the main UK open property datasets, one paid data provider, email, calendar/Drive, booking, auth, analytics and storage. The weak spots are the unfunded Anthropic account, a dead probate API, partially degraded PropertyData endpoints and a Google connection that had not been exercised live when last documented.

### Cited Findings

| Integration | Used for | Status in the files |
|:--|:--|:--|
| OpenRouter | every routed LLM call | The only funded LLM route — `docs/LLM-ROUTING.md:13-17`; `CONTEXT-HANDOVER.md:71` |
| Anthropic direct | probate PDF Files + Citations only | Retired and unfunded — `docs/LLM-ROUTING.md:59-64`, `:104`; `CONTEXT-HANDOVER.md:72` |
| OpenAI | Whisper transcription; embeddings fallback | Key must be on both Vercel projects — `CONTEXT-HANDOVER.md:76-79`; `packages/knowledge-base/src/embedder.ts:35-40` |
| Voyage | embeddings (preferred) | Optional key; package unused — `packages/knowledge-base/src/embedder.ts:17`, `:37` |
| Mistral | OCR in the probate pipeline | Optional key — `packages/document-pipeline/src/probate-extract.ts:81-99` |
| PropertyData | distress lists, comps, £/sqft, floor areas, agents, UPRNs, titles, flood, demand, yields, George | Paid; internal use only; 11 endpoint schemas rewritten from real responses on 17 Sep 2026; remaining caveats — `docs/LEARNINGS.md:119-165`, `:344-358`; `docs/mcp/01-audit.md:21-23`, `:76` |
| HM Land Registry Price Paid / HPI | comps, backtest, trend | Free, live; HPI via PropertyData 404'd and fell back to synthetic at one point — `docs/mcp/01-audit.md:68-69`; `docs/LEARNINGS.md:345-347` |
| EPC register (new gov API) | floor area by UPRN, rating | Live with `EPC_API_TOKEN`; old API retired 30 May 2026 — `CONTEXT-HANDOVER.md:59` |
| OS Places | address → UPRN | Live with key; PropertyData replaced it as the second UPRN source — `git log` (#138); `docs/mcp/01-audit.md:71` |
| postcodes.io | geocoding, district validation | Free — `docs/mcp/01-audit.md:72` |
| The Gazette | probate and insolvency notices | Live, verified 5 Aug 2026; never send a `noticecode` filter — `docs/architecture/sourcing-channels.md:95-113` |
| Companies House (REST + stream) | charges, insolvency, entity graph | Live with keys; stream drained every 30 min — `apps/api/app/cron/ch-stream/route.ts` header; `docs/mcp/01-audit.md:73` |
| planning.data.gov.uk | stalled consents (brownfield register), weekly | Live, free — `docs/architecture/sourcing-channels.md:120-139` |
| HMCTS probate API | probate grants | Placeholder; endpoint does not exist — `docs/scouting-roadmap.md:24-26`; `docs/mcp/01-audit.md:78` |
| Auction houses | lot discovery | Auction House UK + Allsop live; Savills + Clive Emson via LLM extraction, unverified URLs; EIG paid feed undecided — `docs/mcp/01-audit.md:77`; `packages/auctions/src/sources/savills.ts:9-18`; `docs/OCTOBER-LAUNCH.md:68-69` |
| Reddit (script app) | guide-research signals | Optional; skipped without credentials — `CONTEXT-HANDOVER.md:70` |
| Trade press / HMLR news feeds | guide-research signals | `apps/api/app/cron/guide-research/route.ts:28-33` |
| Resend | transactional and approved outreach email | Wired with graceful fallback; one live mailbox — `CLAUDE.md` packages table; `docs/brand/KEPT.md` § Digital home |
| Google Workspace (Gmail, Calendar, Drive, Sheets) | drafts, labels, deal email log, viewing events, deal folders, partner sheet, morning brief | One Kept connection; every feature skips when not connected; email log "Not yet used against a live Google account" — `docs/GOOGLE-WORKSPACE.md:8-16`, `:24-25`, `:33` |
| Calendly | booking links + webhook | Wired; "No replay protection" — `docs/mcp/01-audit.md:98`; `apps/api/app/webhooks/calendly/route.ts` |
| Postmark inbound | forwarded PDFs → document pipeline | Webhook route exists — `apps/api/app/webhooks/postmark/inbound/route.ts:12-36`; setup doc `docs/setup/email-forward.md` |
| Clerk | dashboard auth | Wired — `CLAUDE.md` Tech stack; `apps/api/app/webhooks/clerk/route.ts` |
| Vercel Blob | signed offer PDFs, pack images, uploads | Wired; audit notes the blob is public — `docs/mcp/01-audit.md:81` |
| PostHog, Google Analytics / GTM, Meta Pixel | site analytics and ad tracking, consent-gated | `packages/analytics/posthog/*`, `apps/web/components/cookie-consent.tsx:221`, `:266`; `apps/app/lib/whats-new.ts:215-218` |
| Arcjet, Knock, Sentry | security, notifications, error tracking | Arcjet off without key; Knock unused; Sentry instrumentation disabled — `docs/mcp/01-audit.md:103-104`; `apps/api/instrumentation.ts:21` |
| Orbital / Farringdon (conveyancing AI) | none in code | Commercial anchor only; "no buyer-side API" — `docs/architecture/legal-orbital.md:26-29` |
| WhatsApp | intake | Paste only; unofficial bridge removed 23 Nov 2026 — `CLAUDE.md` § Services |
| ChatGPT (MCP plugin) | public tools + Pro tools | Dark launch, developer mode only — `docs/mcp/06-go-live.md:5-11` |

- Running costs noted in April: about £68/month total (Vercel Pro ~£20, PropertyData £48), "Negligible until we have volume" — `docs/HANDOVER.md:197-209`. LLM spend was judged trivial per feature (e.g. ~£0.06 per deep appraisal, ~$0.07/month for the monthly marketer) — `packages/valuation/src/deep-appraisal.ts:33-35`; `apps/api/app/cron/marketer-monthly/route.ts:22-25`; "Cost is no longer the lever; the sources are." — `docs/LLM-ROUTING.md:131-134`.

### Inferences
- Data access, not model cost, is the binding constraint the docs keep returning to: PropertyData spend and licence, a missing probate feed, no lease-length source, no portal data.
- The open-data adapters (HMLR, EPC, Gazette, Companies House, planning) are the natural tool set for any future tool-using agent, and `@repo/kept-tools` plus the nine old MCP tools show two existing packagings of them.
- Several integrations are wired but unproven in live use (Google email log, plugin Pro, Savills/Clive Emson), so new AI work layered on them inherits that uncertainty.

### Gaps
- Which env keys are actually set in production today (Resend, Calendly, Google, Reddit, Mistral, Voyage, OpenAI on each project) cannot be confirmed from the repo; `CONTEXT-HANDOVER.md:81-83` lists Resend and Calendly as "Not yet set" but that section dates from April 2026 and later commits imply email is live.
- Current PropertyData plan, credit usage and remaining headroom are not in the repo.
- Whether data-processing agreements exist with any LLM host is not recorded (the audit says they are needed, `docs/mcp/01-audit.md:80`).
