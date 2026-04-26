# PropertyData Setup

PropertyData (propertydata.co.uk) gives us 69 paid REST endpoints across UK
property datasets. We use it in two distinct ways:

1. **Path A — MCP for Sam's local Claude Code.** Natural-language access for
   research, ad-hoc queries, drafting investor packs, agent prospecting.
2. **Path B — REST for the platform.** Server-only client at
   `@repo/property-data/propertydata.ts`, used by the AVM engine and (later)
   Paperclip enrichment.

Both share the same API key. Treat the key like a database password.

---

## 1. Set the env var (do this first)

The key lives in **three places**, all entered separately so it's never
accidentally exposed in source or git:

### Local development (`.env.local`)

```sh
PROPERTYDATA_API_KEY=YOUR_KEY_HERE
```

### Production (Vercel)

Set on **all three Vercel projects** that import `@repo/property-data`:

```sh
vercel env add PROPERTYDATA_API_KEY production
# paste the key when prompted

vercel link --yes  # if not already linked
# repeat for each project: bellwood-web, bellwood-api
```

Or via the Vercel dashboard:
**Settings → Environment Variables → Add → Production**.

### Local Claude Code MCP

See section 2 below.

### Sanity check

After deploying, hit any endpoint that calls `/valuation-sale` (e.g. submit
a test through `/save-the-sale`). Vercel logs should show:

```
[propertydata] /valuation-sale +3 credits (process total: 3)
```

If you see `skipped — no PROPERTYDATA_API_KEY configured`, the env var
hasn't taken effect. Redeploy after setting.

---

## 2. Path A — MCP server for local Claude Code

PropertyData ship a hosted MCP server. One-time setup in your terminal:

```bash
claude mcp add --transport http propertydata https://api.propertydata.co.uk/mcp \
  --header "Authorization: Bearer YOUR_KEY_HERE"
```

Or add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "propertydata": {
      "url": "https://api.propertydata.co.uk/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_KEY_HERE"
      }
    }
  }
}
```

Restart Claude Code. The 10 PropertyData tools become available:

| Tool | Use |
|---|---|
| `get-prices` | Asking prices by postcode |
| `get-rents` | Long-let rental data |
| `get-rents-hmo` | HMO room rents |
| `get-sold-prices-per-sqf` | £/sqft sold prices |
| `get-prices-per-sqf` | £/sqft asking prices |
| `get-flood-risk` | Flood risk (England) |
| `get-crime` | Crime stats by area |
| `get-planning-applications` | Live planning data |
| `get-council-tax` | Council tax bands |
| `address-match-uprn` | Address → UPRN |

Try: *"What are asking prices and £/sqft trends in M1 5AB?"*

The remaining 59 endpoints (valuations, demographics, growth, demand, agents,
etc.) are REST-only and called via the platform — see Path B.

---

## 3. Path B — REST client (server-only)

Lives at `packages/property-data/src/propertydata.ts`. Currently exposes:

- `getPropertyDataValuation()` → `/valuation-sale` — the £/sqft AVM. Used as
  the 20% external cross-check inside `base-valuation.ts` (per BELA-12 spec).
- `getFloorAreas()` → `/floor-areas` — EPC-derived floor area + bedrooms.
- `getFloodRisk()` → `/flood-risk`.
- `getMarketDemand()` → `/demand`.
- `getAgentsByPostcode()` → `/agents` — for the prospecting cron.

All endpoints:

- **Server-only** (`'server-only'` import enforces it).
- **In-memory cached** with per-endpoint TTLs (7d for AVM/agents/demand,
  90d for flood-risk/floor-areas — these change slowly).
- **Credit-logged** — every call prints credit usage so we can grep Vercel
  logs to monitor spend. Pre-cap is `getProcessCredits()` for a runtime read.
- **Rate-limited via timeout** (10s per call; aborts with a graceful null).
- **Schema-validated** with Zod before being returned to callers.

### Adding a new endpoint

1. Add a Zod schema at the top of the relevant section in `propertydata.ts`.
2. Define a small typed wrapper around `fetchPropertyData()` with:
   - `endpoint`: the path
   - `ttlMs`: cache lifetime
   - `estimatedCredits`: per-call cost (for telemetry)
   - `schema`: the Zod schema
3. Re-export from `packages/property-data/src/index.ts`.
4. Add the use case to `docs/paperclip-handoff/agent-quick-form-ops.md`.

---

## 4. Credit budget (5k plan = £48/mo)

Cap: 5,000 credits/month. Estimated usage at current volume:

| Workflow | Calls/month | Credits |
|---|---|---|
| Live `/api/quote` indicative (cached at postcode level) | 200 calls | ~600 |
| Paperclip enrichment per submission | 30 deals × 6 calls | ~360 |
| Weekly `/agents` prospecting (20 postcodes × 4 weeks) | 80 calls | ~240 |
| Ad-hoc queries via MCP from local Claude | ~50 | ~150 |
| **Headroom** | | ~3,650 |

Move to API 15k (£96/mo) only when deal volume exceeds 60/month.
