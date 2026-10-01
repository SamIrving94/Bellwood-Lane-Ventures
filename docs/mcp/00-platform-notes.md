# Platform notes — ChatGPT plugins + MCP

_Researched: 2026-10-01 · updated for DevDay (29 Sep 2026). Re-check before each phase — this changes often._

**Caveat:** the OpenAI docs sites (incl. developers.openai.com/plugins) are blocked from our build sandbox. Lines marked **[snippet]** come from search summaries of the official pages, not the page itself. npm package facts were read directly.

**Naming:** we say **plugin** everywhere. A plugin is built on MCP. "MCP Apps" below is the name of the open UI standard, not a ChatGPT product.

## Big changes in 2026

- **26 Jan** — "MCP Apps" open standard launched. ChatGPT, Claude and VS Code support it.
- **9 Jul** — ChatGPT **"apps" renamed "plugins"**. Plugin Directory replaces App Directory. Apps SDK still works underneath.
- **27 Jul** — MCP TypeScript SDK **v2** (split packages).
- **28 Jul** — MCP spec **2026-07-28**: stateless, no session id, SSE transport deprecated.
- **Sep** — OpenAI plans to retire custom GPTs into plugins.
- **29 Sep (DevDay)** — plugin **extensions** (sidebar, panels, settings), **Plugin Creator**, redesigned submission flow, better ranking and in-conversation recommendations, MCP Events. Details below.

## How a ChatGPT plugin works

- An **MCP server** over **Streamable HTTP** (not SSE).
- **Tools** return `structuredContent` (model sees it), `content` (model sees it) and `_meta` (widget only, hidden from model).
- **Widget** = an HTML resource at a `ui://...` URI, mime `text/html;profile=mcp-app`.
  - Old `text/html+skybridge` = legacy. Unverified if still accepted.
- Link tool → widget with `_meta.ui.resourceUri` (alias `openai/outputTemplate`).
- Resource `_meta.ui.csp` lists allowed domains. `_meta.ui.domain` is **required for submission** and must be unique.
- Status text: `openai/toolInvocation/invoking` / `invoked` (≤64 chars). **[snippet]**
- Widget ↔ host bridge: `ui/*` postMessage methods. ChatGPT extras on `window.openai` (`callTool`, `sendFollowUpMessage`, `openExternal`, `setWidgetState`…).
- `_meta.ui.visibility` sets whether a tool is callable by the model, the widget, or both. **[snippet]**
- A plugin can bundle **MCP servers + skills + templates**. One directory is shared by ChatGPT and Codex. **[snippet]**

## Display modes **[snippet]**

- **Inline** — card in the conversation. Default.
- **Fullscreen** — for multi-step work. Composer stays on top.
- **Picture-in-picture** — floating, for live sessions.
- **Declare them:** set `_meta["openai/ui"].availableDisplayModes` on the resource contents (e.g. `["inline", "fullscreen"]`). Also declare during MCP Apps initialisation.

## Extensions (new, DevDay) **[snippet]**

These hook a plugin into ChatGPT surfaces outside the chat flow:

- **Sidebar apps** — open the plugin from the sidebar, fullscreen.
- **Conversation panels** — open the plugin beside a conversation.
- **Plugin settings** — user-set options inside ChatGPT.
- **File viewers / editors** — open supported files in our UI.
- **Not available to Free and Go users on web yet** ("coming soon"). Free/Go users can still find plugins via the directory and recommendations.

## MCP Events (new, DevDay) **[snippet]**

- ChatGPT supports the *proposed* MCP Events spec.
- A plugin can tell ChatGPT "something happened" and start an automation.
- Not needed for a one-shot calculator. Noted for later.

## Discovery and ranking (new, DevDay) **[snippet]**

- Better ranking in the directory **and** in-conversation recommendations.
- **Placement is not guaranteed by submission.** It depends on real usefulness and user satisfaction.
- Plugins with strong utility and satisfaction "may be eligible" for directory placement or proactive suggestions.
- So: tool names and descriptions must match how people actually ask. Bad answers will cost us reach.

## Versions (npm, 2026-10-01)

| Package | Version |
|:--|:--|
| `@modelcontextprotocol/server` (SDK v2) | 2.2.0 |
| `@modelcontextprotocol/sdk` (v1 line) | 1.31.0 |
| `@modelcontextprotocol/ext-apps` | 2.0.3 (needs v2 + zod ^4.2) |
| `mcp-handler` (Vercel) | 2.2.0 (needs server v2 + zod ^4; Node 20+) |
| `@openai/apps-sdk-ui` | 0.2.2 |
| Our `packages/mcp-server` | sdk **1.6.1** — very old |

⚠️ Repo uses **zod 3**. v2 SDK needs **zod 4**. Plan for an isolated package or Next.js project.

## Auth

- **Anonymous tools are allowed** (`securitySchemes: noauth`). **[snippet]**
- If OAuth: OAuth 2.1, `/.well-known/oauth-protected-resource`, CIMD preferred, DCR deprecated.

## Tool annotations — required for review

Every tool must set, explicitly:

- `readOnlyHint` — false if it writes, emails, logs or queues anything.
- `destructiveHint` — true if irreversible (incl. sending messages).
- `openWorldHint` — true if it reaches the public internet or external people.

## Submission (redesigned, DevDay) **[snippet]**

- **Plugin Creator** — new builder tool inside ChatGPT.
- Package the plugin, upload, then submit from the **Plugins** page.
- Track it under **Review status**. Feedback comes **by email**, and is clearer than before.
- A **submission errors** page lists automated-check failures.
- After launch, changes to tool security schemes, tool `_meta` and UI resource links go through **continuous review**, once automated checks pass.
- Still required: verified org identity, privacy policy, tool annotations, test prompts (incl. negative ones), unique UI domain.

## Review rules that matter to us **[snippet]**

- **Financial advice = sensitive.** Needs safeguards + disclaimers.
- **Real estate:** no explicit rule found.
- **Data minimisation:** collect only what's needed. No "just in case" fields. Broad lead-gen PII capture = high risk.
- **No ads.** Must have standalone value, not exist mainly to advertise.
- **No redirecting** the user away or inserting unrelated content.
- **Privacy policy mandatory** (categories, purposes, recipients, retention, controls).
- **Submission:** see section above. A video walkthrough was required before DevDay. **Unverified** whether the new flow still asks for one.
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

## Carry-forward for later phases (founder, 1 Oct)

Done: see `02-ranking.md` (Rec fit score) and `05-build-plan.md` (extensions, submission, 30 prompts). The original asks were:

- **02-ranking:** a 6th score, **Recommendation fit** (1–5) — would ChatGPT likely suggest this plugin for common questions? Re-rank on it.
- **05-build-plan:**
  - Is any extension (sidebar / panel) worth it for v1? Default: **no, inline only**, unless justified.
  - The new submission steps (above).
  - **30 test prompts** to check the plugin gets triggered.

## Not verified

- Live wording of OpenAI pages.
- Whether ChatGPT speaks the 2026-07-28 stateless protocol natively (mcp-handler 2 serves both).
- UK availability of third-party plugins.
- Any real-estate-specific restriction.
- Exact steps of the new submission flow and Plugin Creator (we only have summaries).
- Whether extensions are available in the UK.

## Sources

- [Plugin Extensions](https://developers.openai.com/plugins/build/extensions)
- [Add UI to your MCP server](https://developers.openai.com/plugins/build/chatgpt-ui)
- [Upload and submit your plugin](https://developers.openai.com/plugins/deploy/submission)
- [Package your plugin](https://developers.openai.com/plugins/build/plugins)
- [Plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines)
- [Remote MCP server review requirements](https://developers.openai.com/plugins/deploy/app-review)
- [Plugins in ChatGPT (help centre)](https://help.openai.com/en/articles/20001256-plugins-in-chatgpt)
- [DevDay 2026 recap](https://openai.com/index/devday-2026-recap/)
- [TechCrunch, 29 Sep 2026](https://techcrunch.com/2026/09/29/openai-expands-chatgpts-plugins-with-app-like-interfaces-and-automations/)
