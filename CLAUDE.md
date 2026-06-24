# CLAUDE.md

Guidance for AI assistants (Claude Code and others) working in this repository.

## What this is

**Bellwood Lane Ventures** — a direct-to-vendor UK real estate deal-sourcing
platform. It scouts distressed/motivated sellers (probate, chain breaks, repos,
relocations, short leases), appraises properties with an AVM, drafts outreach,
and runs deals through a pipeline (`sourced → appraised → offered → completed`).

It is built on the **next-forge** Turborepo template (the `package.json` name is
still `bellwood-ventures` / `next-forge`). The business logic lives in custom
`packages/*` and the `apps/api` agent + cron endpoints.

**Operating philosophy — "Steps vs Thoughts":** automate _steps_ (scraping,
enrichment, scoring, draft generation), protect _thoughts_ (vendor calls,
negotiation, final judgment). Vendor-facing emails are **never auto-sent** —
they are always held for founder review.

> The founder (Samir) is dyslexic. In chat replies prefer **short sentences,
> bullets, bold keywords, clear headings**. Avoid dense paragraphs.

## Tech stack

- **Monorepo:** Turborepo + **pnpm 10.5.2** (workspaces: `apps/*`, `packages/*`, `services/*`)
- **Framework:** Next.js 15.5.15 (App Router, Turbopack in dev), React 19, TypeScript 5.8
- **Auth:** Clerk
- **Database:** Neon Postgres via **Prisma** + `@prisma/adapter-neon` (WebSocket driver adapter)
- **Email:** Resend (`@repo/email`, graceful fallback when no token)
- **AI:** Vercel AI SDK + OpenAI; agent orchestration via external "Paperclip" agents
- **Lint/format:** **Biome** via **Ultracite** preset (`pnpm lint` / `pnpm format`)
- **Tests:** Vitest
- **Hosting:** Vercel — two projects: `bellwood-app` (dashboard) and `bellwood-api` (crons/agents)
- **Node:** >= 18 (CI uses Node 20)

## Apps (`apps/*`)

| App | Name | Port | Purpose |
|:---|:---|:---|:---|
| `apps/app` | `app` | 3000 | Authenticated founder **dashboard** (deals, leads, actions, valuations, etc.) |
| `apps/web` | `web` | 3001 | Public marketing site |
| `apps/api` | `api` | 3002 | **Crons + Paperclip agent endpoints** (the automation backbone) |
| `apps/email` | `email` | 3003 | React Email preview/dev |
| `apps/docs` | `docs` | 3004 | Mintlify documentation site |
| `apps/studio` | `studio` | 3005 | Prisma Studio (DB browser) |
| `apps/storybook` | `storybook` | 6006 | Design-system component explorer |

`apps/app` route groups: `app/(authenticated)/*` (dashboard pages),
`app/(unauthenticated)/*` (sign-in/up), `app/actions/*` (server actions),
`app/api/*` (route handlers). Shared helpers live in `apps/app/lib`.

## Packages (`packages/*`) — workspace name `@repo/<dir>`

Business-logic packages (the custom part of this codebase):

| Package | What |
|:---|:---|
| `@repo/database` | Prisma client + Neon adapter; **schema is the data contract** |
| `@repo/scouting` | Probate / distressed-seller discovery + lead scoring |
| `@repo/valuation` | AVM orchestrator (base + risk + trend → offer) |
| `@repo/property-data` | HMLR, EPC, OS Places, PropertyData adapters |
| `@repo/auctions` | Auction House UK / Savills / Clive Emson scrapers |
| `@repo/email` | Resend wrapper with graceful fallback |
| `@repo/calendly` | Booking-link generator + webhook verification |
| `@repo/whatsapp-parser` | Parse inbound WhatsApp intake messages |
| `@repo/instant-offer`, `@repo/quote-ops`, `@repo/deal-updates`, `@repo/document-pipeline`, `@repo/knowledge-base`, `@repo/notifications` | Deal/offer/document/notification workflows |
| `@repo/mcp-server` | MCP server exposing repo capabilities (see `.mcp.json`) |

Platform/infra packages (mostly inherited from next-forge):
`@repo/auth`, `@repo/analytics`, `@repo/design-system`, `@repo/observability`,
`@repo/security`, `@repo/seo`, `@repo/storage`, `@repo/webhooks`,
`@repo/next-config`, `@repo/testing`, `@repo/typescript-config`, `@repo/ai`.

Packages export TypeScript source directly (e.g. `"main": "./src/index.ts"`) and
are consumed in-source — no build step between workspace packages.

## Services (`services/*`)

- `services/whatsapp-bridge` — standalone Node service using `whatsapp-web.js`
  to relay WhatsApp messages into the intake pipeline.

## The automation backbone (`apps/api`)

This is the most important custom surface. Two families of route handlers:

**Agent endpoints** — `apps/api/app/agents/<name>/route.ts`. External
"Paperclip" agents POST structured payloads here. Examples: `leads`,
`valuations`, `outreach`, `legal`, `alerts`, `events`, `export`, `eval-config`,
`auctions`, `scout`, `intake`, `concierge`, `dispatch`, `quote-ops`,
`deal-update`, `inbox`, `agents-in-area`.
- **Auth:** `Authorization: Bearer <BELLWOOD_API_KEY>` validated via
  `apps/api/app/agents/_lib/auth.ts` (`validateAgentAuth` / `unauthorizedResponse`).
  `PAPERCLIP_API_KEY` is accepted as a legacy alias only.

**Cron endpoints** — `apps/api/app/cron/<name>/route.ts`. Triggered on a schedule
(Vercel cron). Examples: `scouting`, `pipeline-appraise`, `pipeline-outreach`,
`pipeline-summary`, `sla-alerts`, `auction-scan`, `marketer-daily/weekly/monthly`,
`event-poller`, `deep-appraisal`, `agent-prospecting`, `quote-ops`, `keep-alive`,
`weekly-patterns`.
- **Auth:** `Authorization: Bearer <CRON_SECRET>` (checked inline in each route).
- Long-running routes set `export const maxDuration = 300;` (Vercel Pro cap).

The 7 canonical Paperclip agents (CEO, Engineer, Designer, Appraiser, Counsel,
Marketer, Liaison) and their onboarding prompts are documented in
`docs/PAPERCLIP-SYNC-BRIEF.md` — **treat that brief as the source of truth.**

## Database

- Schema: **`packages/database/prisma/schema.prisma`** (Postgres, `driverAdapters`
  preview feature, `@prisma/adapter-neon`).
- ~40 models including `Deal`, `ScoutLead`, `AvmResult`, `OutreachCampaign`,
  `OutreachHold`, `FounderAction`, `FounderFeedback`, `AgentEvent`, `EvalConfig`,
  `AuctionLot`, `Campaign`, `Contact`, `QuoteRequest`/`QuoteOffer`,
  `LegalStep`/`LegalDocument`, `WhatsAppIntake`, `LlmCallLog`.
- **Apply schema changes** (dev): from repo root run `pnpm migrate`
  (= `prisma format && prisma generate && prisma db push` inside
  `packages/database`).
- Browse data: `apps/studio` (`prisma studio`).
- **Gotcha:** use `pnpm exec prisma` from inside `packages/database/` — a
  globally installed Prisma CLI may not match this schema.

## Common commands (run from repo root)

```sh
pnpm install            # install deps; also installs lefthook git hooks (prepare)
pnpm dev                # run all apps in dev (turbo)
pnpm build              # build everything (turbo; build depends on test)
pnpm preflight          # build api + app + web only (what the pre-push hook runs)
pnpm test               # turbo test (Vitest across workspaces)
pnpm lint               # ultracite (Biome) lint
pnpm format             # ultracite (Biome) format
pnpm migrate            # prisma format + generate + db push (packages/database)
pnpm clean              # git clean -xdf node_modules
```

Run a task for one workspace with a filter, e.g.
`pnpm --filter api dev` or `pnpm --filter @repo/valuation test`.

## Conventions

- **Validation:** route handlers validate input with **Zod**. Batch endpoints
  reject bad rows individually with per-row errors rather than failing the whole
  batch (see `apps/api/app/agents/leads/route.ts`).
- **Imports:** use `@repo/<pkg>` for workspace packages and the app-local `@/`
  alias (e.g. `@/env`) within an app. Env access goes through each app's
  typed `env` module.
- **Formatting:** Biome/Ultracite owns style — single quotes, 2-space indent.
  Run `pnpm format` rather than hand-formatting. Some generated/vendored paths
  are ignored in `biome.json` (e.g. `packages/design-system/components/ui/**`).
- **Comments:** existing code uses explanatory block comments on routes and
  non-obvious logic. Match that density; explain _why_, not _what_.
- **Money:** stored in **pence** as integers (e.g. `estimatedEquityPence`).
- **Safety rails (do not break these):** vendor emails are always held for
  founder review (`OutreachHold`); CEO escalation fires for offers <60% of AVM;
  SLA breaches are deduplicated so they don't spawn duplicate `FounderAction`s.

## Testing & CI

- Tests: **Vitest**. Configs at `apps/app/vitest.config.ts`,
  `apps/api/vitest.config.ts`, `packages/valuation/vitest.config.ts`.
  Run all via `pnpm test`, or a single app config with
  `npx vitest run --config apps/api/vitest.config.ts`.
- **Pre-push hook** (`lefthook.yml`): runs `pnpm preflight` (full Next build of
  api/app/web). A failing build **blocks the push**. Bypass only in emergencies:
  `LEFTHOOK=0 git push` or `git push --no-verify`.
- **CI** (`.github/workflows/build.yml`): on PRs to `main`, installs deps,
  writes test `.env.local` files, runs `pnpm analyze` (build + bundle analysis)
  and the api Vitest suite.

## Working in this repo

- **Branch:** develop on the assigned feature branch; do not push to `master`/`main`
  without explicit permission. Push with `git push -u origin <branch>` and open a
  **draft PR**.
- Before pushing, expect the pre-push build to run (2–3 min) — keep types clean.
- **Don't commit secrets.** Real keys live in `.env.local` (gitignored) and in
  Vercel env vars on both projects. CI uses dummy values.
- Helpful docs: `CONTEXT-HANDOVER.md` (session state, env keys, prod URLs),
  `docs/PAPERCLIP-SYNC-BRIEF.md` (agents), `docs/DECISION-STACK.md`,
  `docs/architecture/`, `docs/HANDOVER.md`. `CHANGELOG.md` is auto-generated —
  don't edit by hand.
- One-off maintenance scripts live in `scripts/` (run with
  `pnpm tsx scripts/<file>` / `node`); they include lead audits and seed/purge
  utilities — read before running, several mutate the database.

## Key file paths

| What | Where |
|:---|:---|
| DB schema (data contract) | `packages/database/prisma/schema.prisma` |
| Agent endpoints | `apps/api/app/agents/*/route.ts` |
| Agent auth helper | `apps/api/app/agents/_lib/auth.ts` |
| Cron jobs | `apps/api/app/cron/*/route.ts` |
| Dashboard pages | `apps/app/app/(authenticated)/*` |
| Server actions | `apps/app/app/actions/*` |
| Paperclip agent onboarding | `docs/PAPERCLIP-SYNC-BRIEF.md` |
| Session/context handover | `CONTEXT-HANDOVER.md` |
