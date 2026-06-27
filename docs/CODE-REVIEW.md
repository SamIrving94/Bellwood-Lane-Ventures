# Code Review — Bellwood Lane Ventures

**Date:** 2026-06-27 · **Scope:** whole monorepo · **Lens:** critical but
constructive. Goals — (1) sound quality, (2) can scale, (3) refactor
opportunities, (4) a better way with current tech.

**Altitude:** pragmatic / ship-focused. You are a **solo founder at soft-launch**.
The advice below protects velocity and fixes what bites at *first* scale. Big
rewrites are flagged, not pushed.

---

## 1. Executive summary

**The codebase is in good shape for its stage.** It is a well-organised
next-forge Turborepo (Next.js 15, React 19, TS 5.8 strict, Prisma+Neon, Vercel,
Vitest). Boundaries are clean, the data contract is a single Prisma schema, and
the AI layer is genuinely well-built.

**What's healthy**
- **Clear monorepo split** — `apps/*` (dashboard, api, web), `packages/*` (domain
  logic), `services/*`. Business logic is isolated in packages, not smeared
  through the UI.
- **Strong AI abstraction** — `packages/ai/claude.ts`: provider fallback, prompt
  caching, timeouts, structured `LlmCallLog`, never-throws contract.
- **Safety rails enforced in code** — vendor emails held for review
  (`OutreachHold`), CEO escalation under 60% of AVM, SLA dedup.
- **Strict typing + Zod** on untrusted input; secrets via typed `env` modules; no
  committed `.env`.

**What to fix first (the short list)**
1. **N+1 in `agents/export`** — will time out as feedback data grows. *(High)*
2. **In-memory rate-limit + caches** — leak and don't survive Vercel's serverless
   model. *(High for correctness at scale)*
3. **Serial, sleep-bound scouting cron** — the main horizontal-scale blocker.
   *(Medium — fine now, plan the fix)*
4. **Test coverage ~2.5%** — for an automation-heavy platform, raise a pragmatic
   floor on the money-critical paths. *(Medium)*
5. **God-files** — `propertydata.ts` (2,282 LOC) and two big UI files. *(Medium —
   PropertyData split is in progress in this same change.)*

**One-line verdict:** nothing here is on fire. A handful of scale landmines and a
thin test floor are the real risks. Fix those, keep shipping.

---

## 2. Severity-ranked findings

| # | Severity | Area | Finding | File |
|:-:|:--|:--|:--|:--|
| 1 | **High** | Scale | N+1: up to 500 serial `findUnique` inside one `Promise.all` | `apps/api/app/agents/export/route.ts:34` |
| 2 | **High** | Scale | Unbounded in-memory rate-limit `Map`, per-instance, never evicts | `apps/web/app/api/quote/route.ts:16` |
| 3 | **Med** | Scale | In-memory PropertyData cache: O(n) eviction, dies on cold start | `packages/property-data/src/propertydata.ts:30` |
| 4 | **Med** | Scale | Scouting cron is serial + sleep-bound; capped at ~6 seeds to dodge 300s limit | `apps/api/app/cron/scouting/route.ts` |
| 5 | **Med** | Quality | 2,282-LOC god-module (fetch+cache+credits+25 endpoints) | `packages/property-data/src/propertydata.ts` |
| 6 | **Med** | Quality | Two 850–1,500 LOC UI files hard to test/review | `apps/app/.../leads/[id]/page.tsx`, `apps/web/.../instant-offer/components/chat-flow.tsx` |
| 7 | **Med** | Correctness | Silent `sellerType` coercion to `'standard'` on unknown reason | `apps/api/app/intake/route.ts:44` |
| 8 | **Med** | Tests | ~14 test files / ~558 source (~2.5%); agent/cron routes untested | repo-wide |
| 9 | **Low** | Quality | ~11 `as any` casts in enum/form/AVM paths | `intake`, `cron/pipeline-appraise`, `actions/evals/seed.ts` |
| 10 | **Low** | Observability | DB-config read failures swallowed; silent fallback to env | `apps/api/app/cron/scouting/route.ts:91,122` |
| 11 | **Low** | Consistency | Auth (Bearer/`CRON_SECRET`) re-implemented inline across ~40 routes | `apps/api/app/cron/*`, `apps/api/app/agents/*` |

---

## 3. Findings by focus area

### 3.1 Valuation / AVM (Bet 2 — the foundation)

**This is your best-engineered, best-tested area.** Money is stored in **pence as
integers**, the engine was hardened in June 2026, and it has the bulk of the
repo's unit tests. Don't over-touch it.

**Small, worthwhile improvements**
- **Back-test harness.** Your own OKR (KR1.1: median AVM error ≤8% across ~20
  known deals) needs a repeatable measurement. Build it as a script/test fixture
  so every engine change is scored, not vibes.
- **Remove `as any` in `cron/pipeline-appraise`** where AVM result fields are
  cast — give the AVM result a proper shared type so the pipeline consumes it
  type-safely.
- **Comp transparency is the moat** (KR1.2: ≥3 comps within 0.5mi/12mo or flag
  low-confidence). Keep that invariant covered by a test so a refactor can't
  silently weaken it.

### 3.2 AI / agent architecture (a strength)

**`packages/ai/claude.ts` is the model to copy elsewhere.** It does provider
fallback (Anthropic → OpenRouter), per-attempt timeouts, automatic prompt caching
for system prompts >1024 chars, structured logging, and returns `string | null`
instead of throwing. That's a mature pattern.

**Pragmatic notes (none urgent)**
- **Runtime model has drifted.** The docs describe external "Paperclip" agents,
  but marketing already moved to **internal Vercel crons calling Claude
  directly**. Pick one story and write it down — right now a newcomer (or future
  you) has to reverse-engineer which path is live. Recommend: *internal crons are
  the runtime; Paperclip is optional dev tooling.*
- **Vercel AI SDK is on v4.** v5 exists (better streaming, typed tool-calling,
  agent loop helpers). **Defer** — it's a breaking upgrade with no launch value
  today. Tag it "later".
- **No circuit breaker on the fallback.** If OpenRouter is down, every request
  pays the full retry. Low priority, but a simple cooldown after N consecutive
  failures would save latency under an outage.
- **Auth duplication.** Every agent/cron route re-implements the Bearer /
  `CRON_SECRET` check inline. A shared `withAgentAuth()` / `withCronAuth()`
  wrapper would remove ~40 copies and is the natural *next* refactor.

### 3.3 Scale & infra (where the real risk is)

The recurring theme: **per-instance in-memory state on a serverless host.** Vercel
spins functions up and down — anything held in a module-level `Map` is unreliable
and can leak.

- **N+1 in `agents/export` (`:34`).** 500 feedback rows → 500 serial
  `findUnique`. Fix: collect IDs per `targetType`, do one `findMany({ where: { id:
  { in } } })` each, join in memory. Use `Promise.allSettled` so one bad row
  doesn't fail the whole export.
- **Rate-limit `Map` in `web/api/quote` (`:16`).** Never evicted → grows forever;
  per-instance → useless across functions. For *hygiene*, a TTL'd `lru-cache`.
  For *real* abuse protection, a durable store (Upstash Redis / Vercel KV).
- **PropertyData cache (`:30`).** Same class of problem; eviction ignored read
  recency. Fixed structurally in the split — extracted to an isolated, bounded
  LRU with true recency-aware eviction (no new dependency).
- **Scouting cron.** Honest comment in the file: `~11s + 2.7s/seed` serial sleeps,
  capped at ~6 seeds/run to stay under the 300s Vercel cap. This is the **main
  thing that won't scale**. Fine for soft-launch; before volume grows, move to a
  **job queue** (Inngest / Trigger.dev / QStash) so seeds run as independent,
  retryable jobs instead of one long serial route.
- **DB access.** Prisma + Neon serverless adapter is the right call. Watch for
  N+1s elsewhere as features grow; prefer `findMany…{ in }` + in-memory joins.

### 3.4 Code quality & tests

- **God-files.** `propertydata.ts` (2,282) is being split now. Backlog:
  `leads/[id]/page.tsx` (~1,516) and `chat-flow.tsx` (~854) — decompose into
  smaller components/hooks when you next touch them.
- **`as any` (~11).** Concentrated in enum/form paths. Replace with Zod enums or
  type guards. The worst is `intake/route.ts:44` — an unknown `reason` silently
  becomes `sellerType: 'standard'`, which then misroutes scoring/outreach. Make it
  a Zod enum that rejects (or explicitly maps) unknown values.
- **Swallowed errors.** `cron/scouting` (`:91`, `:122`) catches DB-config read
  failures and silently falls back to env vars. Add a visible signal (log at warn
  + a `FounderAction`/metric) so a broken config doesn't run invisibly.
- **Tests (~2.5%).** Don't chase a coverage %. Set a **pragmatic floor**:
  - AVM math + the ≥3-comps invariant (money is the business),
  - the scouting scorer,
  - auth + happy-path for 3–4 representative agent routes,
  - pure utilities as you extract them (e.g. the new `cache.ts`).
- **Inherited next-forge surface.** Several platform packages (`analytics`,
  `webhooks`, `storage`, `seo`, `collaboration`) are template scaffolding. Not
  harmful, but they add dependency weight and Lambda-size pressure (the
  `next.config` exclude lists are already fighting the 262MB limit). Worth a
  one-pass audit later to delete what you'll never use.

---

## 4. Latest tech / a better way (tagged by urgency)

| When | Change | Why |
|:--|:--|:--|
| **Now** | Split `propertydata.ts`; isolate + harden the in-memory cache | Maintainability + the cache-eviction bug. *(In this change.)* |
| **Now** | Batch the export N+1; `Promise.allSettled` | Stops a guaranteed future timeout. |
| **Soon** | Durable rate-limit + cache (Upstash Redis / Vercel KV) | Serverless-correct; survives cold starts; shared across functions. |
| **Soon** | Shared `withAgentAuth`/`withCronAuth` route wrapper | Kills ~40 inline auth copies + centralises error handling/logging. |
| **Soon** | Pragmatic test floor on AVM + scorer + key routes | Money-critical paths must not regress silently. |
| **Later** | Job queue for long crons (Inngest / Trigger.dev / QStash) | Removes the 300s-cap workaround; retryable, observable jobs. |
| **Later** | Vercel AI SDK v4 → v5 | Typed tool-calls + agent loop; breaking, no launch value yet. |
| **Later** | Audit/remove unused next-forge packages | Smaller installs, faster builds, less Lambda-size pressure. |
| **Later** | Re-enable Sentry once off the free tier | You currently fly with Logtail only; real error tracking matters at volume. |

---

## 5. Recommended refactor sequence

Do them in this order — each is shippable on its own and de-risks the next.

1. **Split `propertydata.ts`** *(in progress in this change)* — pure structural
   move, zero public-API change. Establishes the "small modules" pattern.
2. **Shared route-handler wrapper** — auth + Zod + try/catch + logging in one
   place; apply across `apps/api` routes.
3. **Scale-landmine fixes** — export N+1, durable rate-limit, durable cache.
4. **Test floor** — AVM, scorer, representative routes, extracted utilities.
5. **God-file UI decomposition** — `leads/[id]/page.tsx`, `chat-flow.tsx`.
6. **Later bets** — job queue, AI SDK v5, dependency audit, Sentry.

---

## 6. What we are *not* recommending (and why)

- **No big rewrite.** The architecture is sound; the wins are targeted.
- **No premature Redis everywhere.** Add a durable store where correctness needs
  it (rate-limit, shared cache), not as a reflex.
- **No blanket 80% coverage target.** Cover what costs money or silently misroutes
  deals. Skip churny UI snapshots.
- **No AI SDK v5 now.** Breaking change, zero soft-launch payoff.

*This document is a snapshot. Update it as the items above are actioned.*
