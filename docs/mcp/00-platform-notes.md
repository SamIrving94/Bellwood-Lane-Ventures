# Platform notes — ChatGPT plugins (Apps SDK) + MCP

_Researched: 2026-10-01. Re-check before each phase — this changes often._

**Caveat:** the OpenAI docs sites are blocked from our build sandbox. Lines marked **[snippet]** come from search summaries, not the live page. npm package facts were read directly.

## Big changes in 2026

- **26 Jan** — "MCP Apps" open standard launched. ChatGPT, Claude and VS Code support it.
- **9 Jul** — ChatGPT **"apps" renamed "plugins"**. Plugin Directory replaces App Directory. Apps SDK still works underneath.
- **27 Jul** — MCP TypeScript SDK **v2** (split packages).
- **28 Jul** — MCP spec **2026-07-28**: stateless, no session id, SSE transport deprecated.
- **Sep** — OpenAI plans to retire custom GPTs into plugins.

## How a ChatGPT plugin works

- An **MCP server** over **Streamable HTTP** (not SSE).
- **Tools** return `structuredContent` (model sees it), `content` (model sees it) and `_meta` (widget only, hidden from model).
- **Widget** = an HTML resource at a `ui://...` URI, mime `text/html;profile=mcp-app`.
  - Old `text/html+skybridge` = legacy. Unverified if still accepted.
- Link tool → widget with `_meta.ui.resourceUri` (alias `openai/outputTemplate`).
- Resource `_meta.ui.csp` lists allowed domains. `_meta.ui.domain` is **required for submission** and must be unique.
- Status text: `openai/toolInvocation/invoking` / `invoked` (≤64 chars). **[snippet]**
- Widget ↔ host bridge: `ui/*` postMessage methods. ChatGPT extras on `window.openai` (`callTool`, `sendFollowUpMessage`, `openExternal`, `setWidgetState`…).

## Versions (npm, 2026-10-01)

| Package | Version |
|:--|:--|
| `@modelcontextprotocol/server` (SDK v2) | 2.2.0 |
| `@modelcontextprotocol/sdk` (v1 line) | 1.31.0 |
| `@modelcontextprotocol/ext-apps` | 2.0.3 (needs v2 + zod ^4.2) |
| `mcp-handler` (Vercel) | 2.2.0 (needs server v2 + zod ^4; Node 20+) |
| `@openai/apps-sdk-ui` | 0.2.2 |
| Our `packages/mcp-server` | sdk **1.6.1** — very old |

⚠️ Repo uses **zod 3**. v2 SDK needs **zod 4**. Plan for an isolated package/app.

## Auth

- **Anonymous tools are allowed** (`securitySchemes: noauth`). **[snippet]**
- If OAuth: OAuth 2.1, `/.well-known/oauth-protected-resource`, CIMD preferred, DCR deprecated.

## Tool annotations — required for review

Every tool must set, explicitly:

- `readOnlyHint` — false if it writes, emails, logs or queues anything.
- `destructiveHint` — true if irreversible (incl. sending messages).
- `openWorldHint` — true if it reaches the public internet or external people.

## Review rules that matter to us **[snippet]**

- **Financial advice = sensitive.** Needs safeguards + disclaimers.
- **Real estate:** no explicit rule found.
- **Data minimisation:** collect only what's needed. No "just in case" fields. Broad lead-gen PII capture = high risk.
- **No ads.** Must have standalone value, not exist mainly to advertise.
- **No redirecting** the user away or inserting unrelated content.
- **Privacy policy mandatory** (categories, purposes, recipients, retention, controls).
- **Submission:** verified org identity, 3 negative test prompts, video walkthrough, unique UI domain.
- **UK availability:** "varies by plan and region". **Not verified for GB.**

## Testing (developer mode) **[snippet]**

1. ChatGPT → Settings → Security and login → **Developer mode** (Plus/Pro/Business/Enterprise/Edu, web).
2. Plugins → **+** → paste public URL ending `/mcp` (or Secure MCP Tunnel).
3. In chat: **+ → Developer mode** → pick the plugin.
4. **Refresh** on the plugin page after changing tools.

## Vercel hosting

- Use **`mcp-handler` 2.x**. `@vercel/mcp-adapter` is superseded.
- Starters: `vercel-labs/mcp-apps-nextjs-starter` (pins v1 — upgrade it).
- Gotchas: set `assetPrefix` to the base URL; CORS must answer OPTIONS 204; add `suppressHydrationWarning` on `<html>`; list our origin in widget CSP.

## Not verified

- Live wording of OpenAI pages.
- Whether ChatGPT speaks the 2026-07-28 stateless protocol natively (mcp-handler 2 serves both).
- UK availability of third-party plugins.
- Any real-estate-specific restriction.
