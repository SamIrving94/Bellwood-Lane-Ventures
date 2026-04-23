# Bellwood Ventures — Context Handover

**Date:** 2026-04-23
**Purpose:** Hand over context to a new Claude Code session started from `C:\Users\samir\bellwood-app`.

---

## 🎯 What This Is

**Bellwood Ventures** — direct-to-vendor UK real estate deal sourcer.

- Target sellers: chain breaks, probate, repos, relocations, short leases, problem properties
- Differentiator: **Speed + Certainty + Empathy**
- Business model: Source → appraise → offer → complete. Self + investor syndicate.
- Philosophy: **Steps vs Thoughts** — automate steps (scraping, outreach, analysis), protect thoughts (vendor calls, negotiation, judgment).

## 👤 User Profile (Samir)

- Dyslexic — use **short sentences, bullets, bold keywords, clear headings**
- No dense paragraphs
- Role: Founder. Co-founder not yet added to Clerk.

---

## 🏗️ Tech Stack

- **Monorepo:** Next.js 15.5.15 + Turborepo + pnpm 10.5.2 (next-forge template)
- **3 apps:** `apps/app` (dashboard, 3000), `apps/api` (crons + agent endpoints, 3002), `apps/web` (public, 3001)
- **Auth:** Clerk
- **Database:** Neon Postgres via Prisma + `@prisma/adapter-neon` (WebSocket)
- **Hosting:** Vercel (2 projects: `bellwood-app`, `bellwood-api`)

## 🗄️ Database

- **Neon URL:** `ep-floral-mud-ab9u0u41-pooler.eu-west-2.aws.neon.tech`
- **Schema:** `packages/database/prisma/schema.prisma`
- **16+ models:** Deal, ScoutLead, AvmResult, OutreachCampaign, FounderAction, AgentEvent, FounderFeedback, EvalConfig, OutreachHold, AuctionLot, etc.
- **Migrations:** `cd packages/database && pnpm exec prisma db push`

---

## 🚀 Production URLs

| | |
|:---|:---|
| **Dashboard** | https://bellwood-app.vercel.app |
| **API** | https://bellwood-api.vercel.app |
| **GitHub** | https://github.com/SamIrving94/Bellwood-Lane-Ventures |
| **Vercel org** | samjlirving-gmailcoms-projects |

---

## 🔑 API Keys (in .env.local)

### Working
- `DATABASE_URL` — Neon Postgres
- `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — auth
- `OS_PLACES_API_KEY` = `spgRAgklEAnG9O3k4oIbgzgcR8vLqQJl` (UK addresses + UPRN)
- `EPC_API_EMAIL` = `samjlirving@gmail.com`
- `EPC_API_KEY` = `8825f22ff5b2869cba3f884b72dc00f25a19162a` (EPC Register)

### Free/built-in
- HMLR Price Paid — no key needed
- HMLR HPI — no key needed

### Skipped
- Companies House — not needed for individual-vendor model
- TwentyEA / AddressMaster — OS Places covers it for now

### Not yet set
- `RESEND_TOKEN` + `RESEND_FROM` — for real email sending
- `CALENDLY_API_TOKEN` + `CALENDLY_EVENT_URL` — for booking links

---

## 🤖 Paperclip Agents (9 total)

1. **CTO** — writes code, opens PRs on `paperclip/cto/*` branches
2. **Scout** — sources leads from probate/auction feeds → `POST /agents/leads`
3. **Appraiser** — runs AVM + offer calc → `POST /agents/valuations`
4. **Marketer** — drafts outreach campaigns → `POST /agents/outreach`
5. **Counsel** — legal steps + flags → `POST /agents/legal`
6. **Orchestrator** — SLA alerts, chain breaks → `POST /agents/alerts`
7. **Concierge** — vendor-facing comms (held for founder review)
8. **Relationship Manager** — investor syndicate
9. **Chief of Staff** — calendar, priority, summaries

**Auth:** `Authorization: Bearer <PAPERCLIP_API_KEY>`

**Full onboarding instructions:** `docs/PAPERCLIP-SYNC-BRIEF.md` — 686 lines, has a copy-paste prompt block for each agent.

---

## 📅 Daily Pipeline Crons

| Time | Route | What |
|:---|:---|:---|
| 7:00 AM | `/cron/scouting` | Scout new probate/distressed leads |
| 7:15 AM | `/cron/pipeline-appraise` | AVM on new deals |
| 7:30 AM | `/cron/pipeline-outreach` | Auto-send to agents/solicitors, hold vendor comms |
| 8:00 AM | `/cron/pipeline-summary` | Morning briefing FounderAction |
| 9:00 AM | `/cron/sla-alerts` | SLA breach check |
| Mon 8 AM | `/cron/auction-scan` | Weekly UK auction scrape |

---

## 📦 Key Packages

| Package | What |
|:---|:---|
| `@repo/database` | Prisma + Neon adapter |
| `@repo/email` | Resend wrapper with graceful fallback |
| `@repo/calendly` | Booking link generator + webhook verification |
| `@repo/scouting` | Probate + distressed-seller discovery |
| `@repo/valuation` | AVM orchestrator (base + risk + trend + offer) |
| `@repo/property-data` | HMLR, EPC, OS Places adapters |
| `@repo/auctions` | Auction House UK + Savills + Clive Emson scrapers |

---

## ✅ What's Built

### Core Platform
- Lead scoring with tunable eval configs
- AVM pipeline with real property data (HMLR + EPC + OS Places)
- Deal pipeline (sourced → appraised → offered → completed)
- Action Centre — founder inbox for anything needing attention
- Founder feedback panel on every entity (rate, override, notes) — trains eval models
- Agent performance dashboard (per-agent accuracy, agreement rate)
- Eval config management page

### Integrations Wired
- **Resend** — email sending in outreach cron + hold approvals (awaits token)
- **Calendly** — booking link on lead pages, webhook for booking/cancel events
- **OS Places** — real address resolution + UPRN
- **EPC Register** — real energy certs + floor area

### Safety Rails
- Vendor emails **never** auto-send (always held for founder review)
- CEO escalation for offers <60% of AVM
- SLA breach deduplication (no duplicate FounderActions)
- OutreachHold gives founder veto on anything sensitive

### Agents (API endpoints exist)
- `/agents/leads` — Scout push
- `/agents/valuations` — Appraiser push
- `/agents/outreach` — Marketer push
- `/agents/legal` — Counsel push
- `/agents/alerts` — Orchestrator push
- `/agents/events` — generic audit log
- `/agents/export` — founder feedback export (JSONL/CSV for fine-tuning)
- `/agents/eval-config` — agents read active eval config
- `/agents/auctions` — auction lots push

---

## 🚧 What's NOT Built (by design)

- **Meta ads** — skipped (sellers aren't on Instagram)
- **LinkedIn automation** — skipped (accounts get banned; Paperclip drafts, user sends)
- **PoppyAI / social automation** — skipped until proven ROI
- **TwentyEA** — skipped (OS Places covers it)
- **EIG paid auction feed** — skipped (scraping free sources instead)

---

## 🔄 Recent Session Work (2026-04-22/23)

### Commits Pushed
1. `5fa1fca` — Fix ReactNode type error in feedback panel for Next.js 15.5
2. `2e32bba` — Fix Prisma JSON and Stripe type errors in API build
3. `4b6ce3a` — Remove Stripe webhook (payments not in scope)
4. `d95247f` — Wire Resend for real email sending
5. `d792847` — Add Calendly integration
6. `280c913` — Add auction scraper (Auction House UK / Savills / Clive Emson)
7. `2b241b8` — Paperclip sync brief v2 + schema/env updates

### What I Did Tonight
- Deployed dashboard to prod: **https://bellwood-app.vercel.app** ✅
- Deployed API to Vercel (preview succeeded, prod redeploy triggered)
- Database migrated with new models (AuctionLot, Calendly fields)
- Spawned 4 parallel agents to build: Resend, Calendly, Auction scraper, Paperclip v2 brief
- All tasks completed, all types clean, all pushed to GitHub

### Known Issues / Quirks
- **Prisma CLI v7** (installed globally) doesn't work with our schema — use `pnpm exec prisma` inside `packages/database/` instead
- **`pnpm install`** sometimes leaves orphaned processes holding Prisma DLLs — kill bellwood node.exe before `prisma generate` if EPERM
- **Old repo at `C:\Users\samir\bellwood-ventures/`** — dead folder, safe to delete (not a git repo, contains old microjournal refs)

---

## 🎯 Next Priorities (when you resume)

### High Priority
1. **Register Resend account** → add `RESEND_TOKEN` + `RESEND_FROM` to Vercel env vars on both projects
2. **Pick Calendly event URL** → add `CALENDLY_EVENT_URL` env var on both projects
3. **Add co-founder to Clerk** → [dashboard.clerk.com](https://dashboard.clerk.com) → Users → Invite
4. **Give Paperclip agents the sync brief** — copy from `docs/PAPERCLIP-SYNC-BRIEF.md` into each agent

### Medium Priority
5. **Replace synthetic auction data with real HTML scrapers** — `packages/auctions/src/sources/*.ts` has TODO markers showing where to parse
6. **Generate production secrets** — `openssl rand -hex 32` for `CRON_SECRET` and `PAPERCLIP_API_KEY` (currently using dev placeholders)
7. **Test Google Ads for high-intent keywords** (sell house fast, probate sale UK)

### Low Priority
8. **Sentry auth token** — currently warning on every build, not breaking
9. **Fix turbo `cache miss` messages** — enable remote caching

---

## 🗂️ Key File Paths

| What | Where |
|:---|:---|
| Full Paperclip onboarding | `docs/PAPERCLIP-SYNC-BRIEF.md` |
| DB schema (data contract) | `packages/database/prisma/schema.prisma` |
| Agent API endpoints | `apps/api/app/agents/*/route.ts` |
| Cron jobs | `apps/api/app/cron/*/route.ts` |
| Founder Action Centre | `apps/app/app/(authenticated)/actions/page.tsx` |
| Dashboard home | `apps/app/app/(authenticated)/page.tsx` |
| Founder feedback panel | `apps/app/app/(authenticated)/components/feedback-panel.tsx` |
| Eval config seeds | `apps/app/app/actions/evals/seed.ts` |

---

## 💡 Resume Prompt

When you open Claude Code in this folder, paste this:

> Read `CONTEXT-HANDOVER.md`. This is the Bellwood Ventures platform. I want to [your goal]. Check git log for recent commits, then proceed.

---

*This file is tracked in git. Update it at the end of major work sessions so context never gets lost.*
