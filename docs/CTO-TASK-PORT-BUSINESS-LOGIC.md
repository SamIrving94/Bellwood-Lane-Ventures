# CTO Task: Port Business Logic to Bellwood Platform

## Context

The Bellwood Ventures platform has been scaffolded as a Next.js 15 monorepo (Turborepo + pnpm) at `C:/Users/samir/bellwood-app/`. The database schema is set up with Prisma + Neon Postgres. The UI pages are built. Now we need the **business logic** ported from the Express/SQLite prototype you built.

## What Exists

### Your Original Code (Express/SQLite)
Location: `C:/Users/samir/.paperclip/instances/default/projects/680a218f-39b4-4669-9f11-7324d48191b4/c8448ce6-440b-4ea3-a50d-5b9d0b86f799/_default/seller-intake/`

- `services/avm.js` (491 lines) — Full AVM engine
- `services/valuation.js` (181 lines) — Base valuation with Land Registry + EPC
- `services/property-data/index.js` — Unified property lookup orchestrator
- `services/property-data/hmlr.js` — HM Land Registry Price Paid
- `services/property-data/epc.js` — EPC Register
- `services/property-data/companies-house.js` — Companies House
- `services/property-data/os-places.js` — Ordnance Survey Places
- `services/scouting/agent.js` — Scout agent orchestrator
- `services/scouting/scorer.js` — Lead scoring (1-100)
- `services/scouting/enrichment.js` — Tier 1/2/3 cascade
- `services/scouting/probate-data.js` — Probate lead fetching
- `services/scouting/rbac.js` — GDPR field sanitiser

### New Platform (Next.js monorepo)
Location: `C:/Users/samir/bellwood-app/`

Target packages to create:
- `packages/property-data/` — UK property API orchestrator
- `packages/valuation/` — AVM engine (split into 4 modules)
- `packages/scouting/` — Lead generation engine

## What to Port

### Package 1: `@repo/property-data`
```
packages/property-data/
├── src/
│   ├── index.ts        # lookupProperty() — parallel API calls
│   ├── hmlr.ts         # HM Land Registry Price Paid (free)
│   ├── hmlr-hpi.ts     # HM Land Registry House Price Index (free)
│   ├── epc.ts          # EPC Register (free tier)
│   ├── companies-house.ts  # Companies House (free)
│   └── os-places.ts    # Ordnance Survey (free tier)
├── keys.ts             # t3-env validation
├── package.json
└── tsconfig.json
```

### Package 2: `@repo/valuation`
```
packages/valuation/
├── src/
│   ├── index.ts            # runAVM() orchestrator
│   ├── base-valuation.ts   # Land Registry comparable analysis
│   ├── risk-scoring.ts     # 0-100 risk model
│   ├── offer-calculation.ts # Base 17% discount + risk adjustments
│   └── trend-projection.ts  # Weighted linear regression
├── keys.ts
├── package.json
└── tsconfig.json
```

### Package 3: `@repo/scouting`
```
packages/scouting/
├── src/
│   ├── index.ts        # runScoutingPipeline()
│   ├── scorer.ts       # 1-100 scoring
│   ├── enrichment.ts   # Tier 1/2/3 cascade
│   ├── probate-data.ts # Probate lead fetching
│   └── rbac.ts         # GDPR field sanitisation
├── keys.ts
├── package.json
└── tsconfig.json
```

## Porting Rules

1. **Convert JS to TypeScript** — add proper types for all inputs/outputs
2. **Replace `https.request()` with `fetch()`** — modern API
3. **Remove `db.prepare()` calls** — return pure data, let server actions handle persistence
4. **Add Zod schemas** for runtime validation of API responses
5. **Add `keys.ts`** using `@t3-oss/env-nextjs` for env var validation
6. **Keep RBAC/GDPR sanitiser** at the boundary — this is critical for probate data
7. **Export clean functions** that the server actions and cron routes can call

## Database Schema Reference

The Prisma schema is at `packages/database/prisma/schema.prisma`. Key models:
- `Deal` — full deal with asking price, offer, EMV, margin, verdict, seller info
- `ScoutLead` — scored leads with verdict, equity, market trend
- `AvmResult` — cached AVM results with risk score and full JSON output
- `LegalStep` — legal progress tracking per deal
- `Contact` — CRM contacts
- `OutreachTemplate` / `OutreachCampaign` / `OutreachRecipient` — email outreach

## Priority

1. **`@repo/property-data`** first — everything else depends on it
2. **`@repo/scouting`** second — this feeds the lead pipeline (#1 business priority)
3. **`@repo/valuation`** third — AVM engine for deal qualification
