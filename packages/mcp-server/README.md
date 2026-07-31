# @repo/mcp-server

Bellwood Ventures **Model Context Protocol** server. Exposes Bellwood's
domain primitives — HMLR / EPC / OS Places / HPI / Companies House /
scout DB / deal pipeline / founder action centre — as MCP tools that
Claude Code, Cursor, or any in-product agent can call in natural language.

**One server, three audiences:**

1. **Founder in Claude Code** — `"show me STRONG probate leads in M14 from this week, and the latest HMLR comps for 8 Alder Road"` → uses `query_scout_db` + `lookup_hmlr_pricepaid` without you opening tabs.
2. **Engineer in Cursor** — write code that references real data. Cursor's MCP integration means autocomplete + chat can read your live scout DB.
3. **In-product agents** — eventually, the Paperclip agents call the same tools over HTTP instead of duplicating the schemas in their own code.

---

## Tools shipped in v0.1

| Tool | Underlying source | Use |
|---|---|---|
| `lookup_hmlr_pricepaid` | HMLR Price Paid Data | Recent comparables for a postcode |
| `lookup_epc` | EPC Register | Energy band, floor area, bedrooms for a property |
| `lookup_os_places` | Ordnance Survey Places | Address ↔ UPRN resolution |
| `lookup_hpi` | HMLR HPI | Annual / monthly trend for a region |
| `search_companies_house` | Companies House | Company status, address, SIC codes |
| `search_dissolved_property_companies` | Companies House | Dissolved property-related firms (lead source) |
| `query_scout_db` | Prisma → ScoutLead | Lead exploration by score / verdict / area |
| `query_pipeline` | Prisma → Deal | Deals by stage / postcode / date |
| `read_founder_actions` | Prisma → FounderAction | The held-for-review queue |

---

## Install — Claude Code

1. **Ensure deps + build are current** in the monorepo: `pnpm install`.

2. **Add the server** to your Claude Code config file. On macOS:
   `~/Library/Application Support/Claude/claude_desktop_config.json`. On
   Windows: `%APPDATA%\Claude\claude_desktop_config.json`.

```json
{
  "mcpServers": {
    "bellwood": {
      "command": "pnpm",
      "args": ["--filter", "@repo/mcp-server", "start:stdio"],
      "cwd": "C:\\Users\\samir\\bellwood-app"
    }
  }
}
```

(Adjust the `cwd` path to wherever the repo lives on your machine.)

3. **Set the env vars** Claude Code will pass through (the server inherits
   your shell environment). Easiest: put them in your shell rc so they're
   present whenever you launch Claude Code.

   ```sh
   export DATABASE_URL="postgres://..."
   export OS_PLACES_API_KEY="..."
   export EPC_API_TOKEN="..."   # bearer token from get-energy-performance-data.communities.gov.uk My account
   export COMPANIES_HOUSE_API_KEY="..."
   export PROPERTYDATA_API_KEY="..."
   ```

4. **Restart Claude Code.** Type `/mcp` to confirm the `bellwood` server
   shows as connected and lists the 9 tools above.

---

## Install — Cursor

`.cursor/mcp.json` at the repo root:

```json
{
  "mcpServers": {
    "bellwood": {
      "command": "pnpm",
      "args": ["--filter", "@repo/mcp-server", "start:stdio"]
    }
  }
}
```

The `cwd` is inferred from the project root.

---

## Try it

In Claude Code, ask things like:

- *"Use bellwood to pull HMLR Price Paid for SK4 3HQ, then summarise the median terraced price."*
- *"Find STRONG probate leads in M14 from the last 7 days that have a contact phone number."*
- *"What founder actions are critical-priority right now?"*
- *"Cross-check: is `Bell Properties Ltd` registered? When was it dissolved?"*

The model picks the right tool, calls it, and renders the JSON response
in plain English.

---

## How tools are organised

```
src/
├── tools/
│   ├── lookup-hmlr.ts         ← one file per tool
│   ├── lookup-epc.ts
│   ├── lookup-os-places.ts
│   ├── lookup-hpi.ts
│   ├── search-companies-house.ts  ← search + dissolved together
│   ├── query-scout-db.ts
│   ├── query-pipeline.ts
│   ├── read-founder-actions.ts
│   └── index.ts                ← registerAll(server)
└── server.ts                   ← buildServer()
bin/
└── local-stdio.ts              ← the bin entry
```

Adding a new tool:

1. Create `src/tools/my-new-tool.ts` exporting `registerMyNewTool(server)`.
2. Add the import + call to `src/tools/index.ts`.
3. Add the name to `TOOL_NAMES`.
4. Restart Claude Code.

---

## Production HTTP transport (not yet shipped)

For agent flows that hit the same tools over HTTPS, the next iteration
adds a Next.js route at `apps/api/app/mcp/route.ts` wrapping
`StreamableHTTPServerTransport`. Auth is bearer-token via
`validateAgentAuth()`. Tool surface is identical. See the TODO at the
bottom of `src/server.ts`.

---

## Safety

- The stdio transport runs **inside the founder's machine**. No remote
  exposure. Trust model = parent process (Claude Code / Cursor).
- The DB tools read only — no write endpoints in v0.1. Adding writes
  later requires explicit per-tool confirmation prompts.
- API keys come from the founder's shell environment. They are NOT
  baked into the server binary.
- Tool descriptions are part of the prompt context — keep them honest;
  Claude trusts them.
