# Agent tooling, protocols and infrastructure — state of play, 25 Nov 2026

_Research window: Dec 2025 – Nov 2026. Notes compiled 25 Nov 2026._

**How to read these notes**

- **Status labels:** `GA` = shipped and stable. `Beta` / `Preview` = usable, may change. `Experimental` = off by default or flagged unstable. `Announced` = no shipped artefact seen. `Rumour` = none used.
- **Evidence labels:**
  - **(P)** = primary source I read directly this session (official blog, official docs, the project's own README / changelog, or the npm registry record).
  - **(S)** = I only saw a search-engine summary of the page, or the page is a third-party write-up. Treat as **unverified** until re-checked.
- **Dates from the npm registry** are publish dates of the named version. They are hard evidence that something shipped, and when.
- **Important method limits (read before trusting gaps):**
  - The shared **web-search budget ran out** after roughly 33 queries. Later work used direct page reads only.
  - This session's network **could not open** `vercel.com`, `openai.com`, `ai-sdk.dev`, `modelcontextprotocol.io` (the blog sub-domain worked), `simonwillison.net`, `arxiv.org`, `news.ycombinator.com`, `hamel.dev`, `latent.space`, `mastra.ai`, `inngest.com`, `temporal.io`, `neon.com`, `cursor.com`, and most news sites.
  - Workarounds used, all primary: Anthropic and Claude docs; the MCP blog; the **npm registry** (versions, dates, and the official docs that `ai`, `eve` and `workflow` ship inside their packages); **raw GitHub** READMEs and changelogs; and Vercel's documentation through the Vercel docs-search connector.
  - Result: **Anthropic, MCP and Vercel coverage is strong and primary. OpenAI, Cursor, Devin, Jules, Hamel Husain, Simon Willison, Latent Space, HN and conference talks are thin or secondary.** This skew is a sourcing artefact, not a judgement on importance.
- AI SDK doc URLs on `ai-sdk.dev` are mapped from the file paths of the docs bundled in `ai@7.0.181`. Two were confirmed by search results; the rest follow the same pattern.

---

## 1. Protocols: what changed in MCP during 2026, and the status of A2A, AG-UI, agent payments and agent identity

### Takeaway

MCP had its **biggest revision ever** on 28 Jul 2026: it went **stateless** (no handshake, no session header), moved long-running Tasks and interactive UI (MCP Apps) into versioned **extensions**, hardened OAuth, and deprecated Sampling, Roots, Logging and Dynamic Client Registration. A2A (v1.0) and AG-UI (v1.0) both reached stable specs in 2026 and sit beside MCP under the Linux Foundation's Agentic AI Foundation; agent payments and agent identity are **real but early** — live pilots and beta specs, not something a small UK property business needs yet.

### Cited Findings

#### MCP — the 2026-07-28 revision (GA)

- **[GA · 28 Jul 2026]** "The 2026-07-28 Model Context Protocol specification is out." Tier-1 SDKs speaking it on release day: TypeScript, Python, Go, C#; Rust in beta. **(P)** — [MCP blog](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- **[GA]** **Stateless core.** The `initialize` / `initialized` handshake and the `Mcp-Session-Id` header are removed. Every request carries protocol version and client capabilities in `_meta`. Servers that need state mint an explicit handle and take it back as a normal tool argument (SEP-2567, SEP-2575). **(P)** — [MCP spec changelog (source)](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/changelog.mdx)
- **[GA]** **`server/discover`** is a new mandatory RPC: servers advertise supported versions, capabilities and identity. **(P)** — [MCP spec changelog](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/changelog.mdx)
- **[GA]** **Elicitation changed shape.** Server-initiated `elicitation/create`, `sampling/createMessage` and `roots/list` are replaced by **Multi Round-Trip Requests (MRTR)**: the server returns `resultType: "input_required"` and the client retries with `inputResponses` (SEP-2322). Every result now carries a required `resultType`. **(P)** — [MCP spec changelog](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/changelog.mdx)
- **[GA]** **Long-running tasks** left the experimental core and became the official extension `io.modelcontextprotocol/tasks`: poll with `tasks/get`, send input with `tasks/update`; `tasks/list` removed; servers may return task handles unsolicited (SEP-2663). **(P)** — [MCP spec changelog](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/changelog.mdx)
- **[GA]** **Transport changes that break older servers:** Streamable HTTP POSTs must send `Mcp-Method` and `Mcp-Name` headers (SEP-2243); SSE resumability (`Last-Event-ID`) is removed, so a broken stream loses the in-flight request; the GET endpoint and `resources/subscribe` are replaced by one `subscriptions/listen` stream; `ping` and `logging/setLevel` are removed. **(P)** — [MCP spec changelog](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/changelog.mdx)
- **[GA]** **Caching rules:** `tools/list`, `prompts/list`, `resources/list`, `resources/read` and `server/discover` results must carry `ttlMs` and `cacheScope`; tools should be returned in a deterministic order "to enable client-side caching and improve LLM prompt cache hit rates" (SEP-2549). **(P)** — [MCP spec changelog](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/changelog.mdx)
- **[GA]** **Auth hardening:** clients must validate the RFC 9207 `iss` parameter before redeeming a code (SEP-2468); client credentials are bound to the issuing authorization server (SEP-2352); **Dynamic Client Registration is deprecated in favour of Client ID Metadata Documents (CIMD)** but still works. **(P)** — [MCP spec changelog](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/changelog.mdx)
- **[GA]** **Deprecated, with a 12-month minimum window:** Roots, Sampling, Logging (SEP-2577) and the legacy HTTP+SSE transport (SEP-2596). Suggested migrations: pass paths as tool parameters; call LLM providers directly instead of Sampling; use stderr or OpenTelemetry instead of Logging. **(P)** — [MCP spec changelog](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/changelog.mdx)
- **[GA]** The spec now documents **OpenTelemetry trace-context propagation** through `_meta` keys (`traceparent`, `tracestate`, `baggage`) (SEP-414). **(P)** — [MCP spec changelog](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/changelog.mdx)
- **[GA]** Maintainers called the release "the largest revision of the protocol since its launch." **(P)** — [MCP turns two](https://blog.modelcontextprotocol.io/posts/mcp-turns-two/)
- **[GA · TypeScript SDK]** The v2 TypeScript SDK is split into `@modelcontextprotocol/server`, `/client` and `/core`; `2.0.0` published 27 Jul 2026, latest `2.4.0` on 23 Oct 2026. The legacy single package `@modelcontextprotocol/sdk` is still maintained at `1.32.2` (23 Oct 2026). **(P)** — [npm registry: server](https://registry.npmjs.org/@modelcontextprotocol%2Fserver), [npm registry: sdk](https://registry.npmjs.org/@modelcontextprotocol%2Fsdk)
- **[Shipped in clients]** Claude Code switched all installs to "the v2 MCP client and MCP 2026-07-28 negotiation with direct HTTP servers by default" in v2.1.274 (16 Sep 2026). Anthropic said on 28 Jul that support was "rolling out across Claude products soon." **(P)** — [Claude Code changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md), [Claude blog](https://claude.com/blog/bringing-mcp-2026-07-28-to-claude)
- **[Stated benefit]** Anthropic: the request/response model means "servers can run on serverless and edge infrastructure" with no session management. **(P)** — [Claude blog](https://claude.com/blog/bringing-mcp-2026-07-28-to-claude)

#### MCP — Apps, Events, Skills, files, auth extensions, registry, discovery

- **[GA extension · 26 Jan 2026]** **MCP Apps** is the first official extension. A tool points at a `ui://` resource of bundled HTML/JS; the host renders it in a **sandboxed iframe** and talks to it with JSON-RPC over `postMessage`. Built jointly with OpenAI and MCP-UI, on patterns from the OpenAI Apps SDK. At launch: Claude (web, desktop), Goose, VS Code Insiders; ChatGPT "starting the week of the announcement." **(P)** — [MCP Apps blog](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/)
- **[GA]** By Nov 2026 MCP Apps "works across ChatGPT, Claude, Goose, and Visual Studio Code." SDK package `@modelcontextprotocol/ext-apps` hit `2.0.0` on 8 Sep 2026. **(P)** — [MCP turns two](https://blog.modelcontextprotocol.io/posts/mcp-turns-two/), [npm registry](https://registry.npmjs.org/@modelcontextprotocol%2Fext-apps)
- **[GA extension · 18 Jun 2026]** **Enterprise-Managed Authorization (EMA)** is stable: the client gets an ID-JAG from the company IdP at SSO and swaps it for a server token, so users skip per-server consent. First IdP: Okta. Clients: Claude, Claude Code, Cowork; VS Code in preview. Servers: Asana, Atlassian, Canva, Figma, Granola, Linear, Supabase. **(P)** — [EMA blog](https://blog.modelcontextprotocol.io/posts/enterprise-managed-auth/)
- **[GA extension]** The auth-extensions repo lists two **stable** extensions keyed to 2026-07-28: Enterprise-Managed Authorization and **OAuth Client Credentials**. **(P)** — [modelcontextprotocol/ext-auth](https://github.com/modelcontextprotocol/ext-auth)
- **[Beta · Oct–Nov 2026]** "October: **Skills over MCP** entered beta. November: **Events** reached beta earlier this month." A **file uploads/downloads** working group has a draft extension open for feedback (post dated 10 Nov 2026). **(P)** — [MCP turns two](https://blog.modelcontextprotocol.io/posts/mcp-turns-two/), [MCP blog index](https://blog.modelcontextprotocol.io/)
- **[Experimental in AI SDK]** AI SDK 7 implements "the webhook portion of the MCP Events design draft"; "Polling and push-stream delivery are not supported." **(P)** — [AI SDK docs: MCP events](https://ai-sdk.dev/docs/ai-sdk-core/mcp-events)
- **[Preview, not GA]** The **MCP Registry** launched in preview on 8 Sep 2025 and froze its API at v0.1 on 24 Oct 2025. Its README still says "this is still a preview release" and that GA "will follow later." No GA post appears in the full MCP blog index through 24 Nov 2026. Publishing uses the `mcp-publisher` CLI with GitHub or DNS/HTTP namespace proof, and the registry runs OSV malware checks on publish and daily. **(P)** — [MCP registry README](https://github.com/modelcontextprotocol/registry), [MCP blog index](https://blog.modelcontextprotocol.io/)
- **[In progress]** Roadmap of 22 Aug 2026: the Server Card working group "continues work on `.well-known` metadata so a server can be discovered without connecting to it"; priorities include server-initiated events ("webhooks and channels, so clients aren't left polling"), DPoP, and **agent identity and delegation** via Workload Identity Federation and token exchange with the IETF OAuth and WIMSE groups. **(P)** — [MCP roadmap](https://blog.modelcontextprotocol.io/posts/mcp-roadmap/)
- **[Unclear]** SEP-2127 "MCP Server Cards" is marked **Final**, but third-party posts disagree on the well-known path. **(S)** — [SEP-2127](https://modelcontextprotocol.io/seps/2127-mcp-server-cards)
- **[Process · 11 Nov 2026]** MCP moves to a **six-month release cadence** (last Tuesday of March and September). Next spec: **30 Mar 2027** (`2027-03-30`). Tier-1 SDK betas land ~1.5 months before each release. **(P)** — [MCP release cycle](https://blog.modelcontextprotocol.io/posts/mcp-release-cycle/)
- **[Adoption]** SDKs "just crossed 5 billion total downloads"; "more than 700 million in the last 30 days" (as of 23 Nov 2026) versus 90 million in Nov 2025; 2,500+ contributors. **(P)** — [MCP turns two](https://blog.modelcontextprotocol.io/posts/mcp-turns-two/)
- **[Governance]** MCP joined the Agentic AI Foundation (AAIF) under the Linux Foundation on 9 Dec 2025. **(P)** — [MCP blog index](https://blog.modelcontextprotocol.io/)
- **[Guidance · 16 Mar 2026]** The MCP blog published "Tool Annotations as Risk Vocabulary: What Hints Can and Can't Do." I saw the title and date only. **(P, title only)** — [MCP blog index](https://blog.modelcontextprotocol.io/)
- **[Research preview]** **MCP tunnels** let Claude reach MCP servers on private networks without public endpoints. **(P)** — [Claude blog](https://claude.com/blog/bringing-mcp-2026-07-28-to-claude), [Claude Platform release notes](https://platform.claude.com/docs/en/release-notes/overview)

#### A2A (agent-to-agent)

- **[GA · v1.0]** A2A reached "version 1.0, its first stable specification"; 150+ supporting organisations at its one-year mark (Apr 2026). **(S)** — [Linux Foundation press release](https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year)
- **[GA · JS SDK]** `@a2a-js/sdk` `1.0.0` published 22 Jul 2026; latest `1.3.0` on 29 Sep 2026. **(P)** — [npm registry](https://registry.npmjs.org/@a2a-js%2Fsdk)
- **[Governance]** The A2A README opens "Part of the Agentic AI Foundation." An AAIF post dates the move to 17 Aug 2026, next to MCP, AGENTS.md, goose and agentgateway. **(P for README; S for date)** — [A2A README](https://github.com/a2aproject/A2A), [AAIF builder's guide](https://aaif.io/blog/a2a-v1-0-a-builder-s-guide-part-1-discovery-tasks-and-clients)
- **[What it is]** JSON-RPC 2.0 over HTTP; discovery through "Agent Cards"; sync, SSE streaming and async push; agents collaborate "without exposing their internal state, memory, or tools." **(P)** — [A2A README](https://github.com/a2aproject/A2A)
- **[Framework support]** eve 1.0 added "native Agent2Agent (A2A) server support" **(S)**; Google ADK for TypeScript can "delegate to remote agents via the A2A protocol" **(P)**. — [Vercel eve 1.0 post](https://vercel.com/blog/eve-is-now-generally-available), [ADK-JS README](https://github.com/google/adk-js)

#### AG-UI (agent-to-user-interface)

- **[GA · v1.0]** "AG-UI 1.0 is here. The protocol now has a stable, frozen specification backed by a JSON Schema." `@ag-ui/core` `1.0.0` published 17 Sep 2026. **(P)** — [AG-UI README](https://github.com/ag-ui-protocol/ag-ui), [npm registry](https://registry.npmjs.org/@ag-ui%2Fcore)
- **[What it is]** An event stream between agent and app: 31 event types in eight families (run lifecycle, text, tool calls, state, reasoning, activity, subagents, custom). Human-in-the-loop is modelled as a run ending with an `interrupt` outcome that the next run resumes. **(P)** — [AG-UI README](https://github.com/ag-ui-protocol/ag-ui)
- **[Positioning]** "MCP gives agents tools and context, A2A lets agents work with other agents, and AG-UI brings agents to users." A2UI, MCP Apps and Open-JSON-UI are "generative UI specs"; AG-UI is the runtime that carries them. **(P, the project's own framing)** — [AG-UI README](https://github.com/ag-ui-protocol/ag-ui)
- **[Adoption claim]** "Adopted by Google, Microsoft, Amazon, and Oracle"; integrations listed for LangChain, CrewAI, Microsoft Agent Framework, Google ADK, AWS Strands, Mastra, Pydantic AI, Claude Agent SDK, Claude Managed Agents, Cloudflare Agents. **(P, self-reported)** — [AG-UI README](https://github.com/ag-ui-protocol/ag-ui)

#### Agent payments and commerce

- **[Beta]** **ACP (Agentic Commerce Protocol)** is "maintained by OpenAI and Stripe and is currently in `beta`." Latest stable spec snapshot: **2026-04-17** ("Cart, feed, orders, authentication, and MCP"). Earlier snapshots: 2025-09-29, 2025-12-12, 2026-01-16, 2026-01-30. **(P)** — [ACP README](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol)
- **[Samples]** **AP2 (Agent Payments Protocol)**, from Google: the repo holds a Python SDK and sample scenarios in Python, Go and Android. Google launched it in Sep 2025 (background). **(P for repo; S for date)** — [AP2 README](https://github.com/google-agentic-commerce/AP2), [The Paypers](https://thepaypers.com/payments/expert-views/the-road-to-agentic-commerce-the-journey-so-far)
- **[Shipped, crypto-first]** **x402** (HTTP `402 Payment Required` flow) moved under an **x402 Foundation** repo; schemes are `exact`, `upto` and `batch-settlement`. Cloudflare's Agents SDK lists "x402 Payments" as a built-in feature. **(P)** — [x402 README](https://github.com/coinbase/x402), [Cloudflare Agents README](https://github.com/cloudflare/agents)
- **[Deprecated]** Stripe's `@stripe/agent-toolkit` npm description now reads "(deprecated; use Stripe MCP)." **(P)** — [npm registry](https://registry.npmjs.org/@stripe%2Fagent-toolkit)
- **[Live pilots]** Visa launched **Intelligent Commerce Connect** in Apr 2026, accepting payments initiated through the Trusted Agent Protocol, MPP, ACP and UCP; Visa also announced live agent-executed transactions with 30+ European issuers (date on the release is ambiguous). **(S)** — [Visa press release](https://corporate.visa.com/en/sites/visa-perspectives/press-releases/visa-intelligent-commerce-connect-ai-shopping-for-businesses.html), [Visa UK newsroom](https://www.visa.co.uk/about-visa/newsroom/press-releases.3457328.html)
- **[Live pilots]** Mastercard Agent Pay (launched Apr 2025, background) requires registered, verified agents; a Mastercard–Santander agent payment in Jan 2026 is described by Forrester as a controlled-environment test; "Agent Pay for Machines" (AP4M) for tiny machine-to-machine payments arrived in Jun 2026. **(S)** — [Forrester](https://www.forrester.com/blogs/agentic-payments-in-b2c-commerce-where-we-are-now), [Biometric Update](https://www.biometricupdate.com/202606/mastercards-ap4m-enables-small-agentic-payments-at-machine-speed-and-scale)

#### Agent identity

- **[Drafts only]** IETF work is all Internet-Drafts: `draft-klrc-aiagent-auth` (rev -03, Jul 2026; authors from AWS, Zscaler, Ping Identity, OpenAI, Okta) treats agents as workloads and profiles existing standards (WIMSE, SPIFFE, OAuth 2.0); `draft-ietf-wimse-aims-00` (Sep 2026) is a working-group draft for an Agent Identity Management System; `draft-sharif-openid-agent-identity-00` (Mar 2026) is an individual submission. **(S)** — [draft-klrc-aiagent-auth-03](https://datatracker.ietf.org/doc/html/draft-klrc-aiagent-auth-03), [draft-ietf-wimse-aims](https://datatracker.ietf.org/doc/html/draft-ietf-wimse-aims), [draft-sharif-openid-agent-identity](https://datatracker.ietf.org/doc/draft-sharif-openid-agent-identity/)
- **[In progress]** MCP authorization extensions under way: "tying access tokens to the requesting client, and letting cloud agents sign in with their own identity." **(P)** — [MCP turns two](https://blog.modelcontextprotocol.io/posts/mcp-turns-two/)

### Inferences

- **For a team that ships an MCP server on Vercel, the stateless core is good news.** No session store, no sticky routing. But it is a **breaking** change: anything relying on `Mcp-Session-Id`, the handshake, SSE resumption or server-initiated elicitation needs migrating. Old behaviour has a 12-month floor from Jul 2026, so plan the move before **mid-2027**.
- **OAuth for MCP is moving from DCR to CIMD.** A server that only supports Dynamic Client Registration still works but is on the deprecated path.
- **"ChatGPT app" and "MCP App" are now the same shape**: an MCP server plus `ui://` resources. One build should reach ChatGPT, Claude, VS Code and Goose.
- **Deterministic `tools/list` ordering plus `ttlMs` is cheap to add** and directly lowers clients' prompt-cache misses.
- **A2A and AG-UI are stable but optional for a one-founder business.** A2A matters when agents from different vendors must talk. AG-UI matters when building a rich agent front end. Neither is needed for cron-driven back-office agents.
- **Agent payments are not yet a small-business tool.** The specs are beta and the card-network programmes are pilots. Nothing here changes how a property buyer transacts in 2026.
- **Proven in production:** MCP itself (700M SDK downloads a month), MCP Apps in four major clients, EMA at named SaaS vendors. **Hype or early:** the registry (still preview after 14 months), server cards, events, agent identity, agent payments.

### Gaps

- I could not open `modelcontextprotocol.io` itself. The changelog was read from the spec's GitHub source file. The Tasks, MCP Apps and Server Card pages were not read in full.
- **No primary confirmation of MCP Registry GA or its size.** The README may simply be stale.
- The exact well-known path for Server Cards is unresolved.
- A2A v1.0 dates and the AAIF move date come from search summaries, not the pages.
- **Web Bot Auth, Visa Trusted Agent Protocol details, Google UCP, and live-merchant counts** were not verified. Search returned nothing reliable.
- Which ChatGPT plans can use custom MCP Apps, and OpenAI's current Apps SDK status, were not verified (`openai.com` unreachable).

---

## 2. Agent SDKs and frameworks (TypeScript first), the Agent Skills standard, and subagents / plan modes / tool search

### Takeaway

The **Vercel AI SDK is on major version 7** (25 Jun 2026) and is now an agent toolkit: an in-memory `ToolLoopAgent`, a durable `WorkflowAgent`, first-class tool approvals, tool search, MCP Apps hosting and stable telemetry. **Vercel's `eve` 1.0** (15 Nov 2026) is a new filesystem-first agent framework on top of it. Both Anthropic (Claude Managed Agents, beta since Apr 2026) and OpenAI (Agents API, beta since Sep 2026) now sell a **hosted agent harness**; **Agent Skills** (a folder with a `SKILL.md`) became the cross-vendor way to package procedures.

### Cited Findings

#### Vercel AI SDK 7

- **[GA · 25 Jun 2026]** `ai@7.0.0` published 25 Jun 2026; latest `7.0.181` on 23 Nov 2026 (patch releases only, no 7.1). The v5 line is still patched (`5.0.292`, 20 Nov 2026). **(P)** — [npm registry: ai](https://registry.npmjs.org/ai)
- **[GA · breaking]** v7 major changes include: **ESM-only** ("Remove CommonJS exports from all packages"); `experimental_telemetry` made **stable**; a new `@ai-sdk/otel` package with OpenTelemetry decoupled from core; `experimental_context` renamed to `context`; a top-level `reasoning` parameter; provider file references and **skill uploads**; `stepCountIs` renamed `isStepCount`; system messages inside `messages` rejected by default. **(P)** — [AI SDK changelog](https://github.com/vercel/ai/blob/main/packages/ai/CHANGELOG.md)
- **[GA]** `ToolLoopAgent` "is the recommended approach for building agents with the AI SDK." State that should not go in the prompt (tenant settings, credentials, progress) goes in `runtimeContext`; per-tool secrets go in `toolsContext`. **(P)** — [AI SDK docs: agents overview](https://ai-sdk.dev/docs/agents/overview)
- **[GA]** **`WorkflowAgent`** (package `@ai-sdk/workflow`; `1.0.0` published 25 Jun 2026 alongside AI SDK 7, `2.0.0` on 19 Aug 2026) runs the same tool loop inside a durable workflow: "each tool execution is a durable step with automatic retries," and "Because the workflow is durable, the approval request survives process restarts — the user can approve hours later and the agent will resume." It **requires Workflow 5**. **(P)** — [AI SDK docs: WorkflowAgent](https://ai-sdk.dev/docs/agents/workflow-agent), [npm registry](https://registry.npmjs.org/@ai-sdk%2Fworkflow)
- **[GA]** **Tool approvals.** `toolApproval` on `ToolLoopAgent` returns one of `not-applicable`, `approved`, `denied`, `user-approval`. It can be a per-tool map, a function of the parsed input, or one policy for all tools, and can be set per request in `prepareCall`. Docs say it is for tools that "modify data, spend money, execute code, send messages, access private data." Provider-executed tools are **not** covered. **(P)** — [AI SDK docs: tool approvals](https://ai-sdk.dev/docs/agents/tool-approvals)
- **[GA]** **Policy as code.** `@ai-sdk/policy-opa` moves approval rules into Open Policy Agent `.rego` files that are testable in CI. The docs are blunt about limits: "Strong fits: scopes, permissions, numeric thresholds, allowlists, time windows… Weak fits: content-based or semantic filtering." **(P)** — [AI SDK docs: policy-based tool approvals](https://ai-sdk.dev/docs/agents/policy-tool-approvals)
- **[GA]** **Tool search.** `toolSearch()` with `deferLoading: true` lets the model find tools on demand; a "code mode" variant keeps the provider-visible tool list unchanged so the prompt cache survives. **(P)** — [AI SDK docs: tool search](https://ai-sdk.dev/docs/ai-sdk-core/tool-search)
- **[GA]** **MCP Apps hosting**: `@ai-sdk/mcp` helpers split model-visible from app-only tools and read `ui://` resources; `@ai-sdk/react` renders the iframe. **(P)** — [AI SDK docs: MCP Apps](https://ai-sdk.dev/docs/ai-sdk-core/mcp-apps)
- **[Experimental]** **`HarnessAgent`** runs whole agent runtimes ("Claude Code, Codex, or Pi") through one AI SDK surface. "Harness packages are **experimental**. Expect breaking changes between releases." **(P)** — [AI SDK docs: harnesses](https://ai-sdk.dev/docs/ai-sdk-harnesses/overview)
- **[Experimental]** A **decision API** asks typed choice / score / boolean questions of a "decision model" (default `typesafe-ai/jev` via AI Gateway). "The AI SDK decision model specification is experimental and can change in patch releases." **(P)** — eve docs `guides/decide.md`, bundled in [eve@1.5.0](https://registry.npmjs.org/eve)
- **[Docs for coding agents]** Both `ai` and `eve` **ship their full documentation inside the npm package** so coding agents can read it from `node_modules`. **(P)** — [eve README](https://github.com/vercel/eve), [AI SDK docs: eve](https://ai-sdk.dev/docs/agents/eve)
- **[OpenRouter]** `@openrouter/ai-sdk-provider` published `3.0.0` on 6 Jul 2026 (11 days after AI SDK 7) and `3.1.0` on 19 Sep 2026. A separate `@openrouter/sdk` reached `1.0.0` on 20 Jul 2026. **(P)** — [npm registry: provider](https://registry.npmjs.org/@openrouter%2Fai-sdk-provider), [npm registry: sdk](https://registry.npmjs.org/@openrouter%2Fsdk)

#### Vercel eve

- **[GA · 15 Nov 2026]** `eve@1.0.0` published 15 Nov 2026; `1.5.0` on 25 Nov 2026. Vercel's post says eve "has been in public preview since June, with 230+ releases." **(P for dates; S for quote)** — [npm registry: eve](https://registry.npmjs.org/eve), [Vercel eve 1.0 post](https://vercel.com/blog/eve-is-now-generally-available)
- **[What it is]** "A filesystem-first framework for durable AI agents." An agent is a folder: `instructions.md` (system prompt), `tools/`, `skills/`, `channels/` (HTTP, Slack, Discord…), `schedules/` (cron). **(P)** — [eve README](https://github.com/vercel/eve)
- **[Durability]** "Every session runs as one workflow on the open-source Workflow SDK (Vercel Workflow when you deploy on Vercel)." Self-hosting uses a local or Postgres "world." **(P)** — eve docs `concepts/execution-model-and-durability.mdx`, in [eve@1.5.0](https://registry.npmjs.org/eve)
- **[Models]** `defineAgent` accepts an AI Gateway model ID "or any AI SDK `LanguageModel` from a provider package." **(P)** — [AI SDK docs: eve](https://ai-sdk.dev/docs/agents/eve)
- **[Warning from the vendor]** "Unless you configure stricter controls, eve agents may operate with permissive settings. Tools without an approval setting run without human approval, and sandbox network egress is not deny-all. Do not rely on model behavior alone." **(P)** — eve docs `responsible-use.md`, in [eve@1.5.0](https://registry.npmjs.org/eve)

#### Anthropic: Claude Agent SDK and Claude Managed Agents

- **[Shipped, pre-1.0]** `@anthropic-ai/claude-agent-sdk` is at `0.3.332` (24 Nov 2026), versioned in step with Claude Code (`2.1.332`). It was renamed from "Claude Code SDK" on 29 Sep 2025 (background). Docs cover subagents, hooks, permissions, approvals and user input, skills, and tool search. **(P)** — [npm registry](https://registry.npmjs.org/@anthropic-ai%2Fclaude-agent-sdk), [Claude Code changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md), [Claude Code docs index](https://code.claude.com/docs/llms.txt)
- **[Beta · since 8 Apr 2026]** **Claude Managed Agents**: "Pre-built, configurable agent harness that runs in managed infrastructure. Best for long-running tasks and asynchronous work." Still **beta** in Nov 2026 (header `managed-agents-2026-04-01`). Four concepts: Agent, Environment, Session, Events. **(P)** — [Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)
- **[Beta features added in 2026]** Scheduled deployments (cron) and vault credentials (9 Jun); webhooks for environment and memory events (22 Jul); **session budgets** with a `budget_reached` stop reason (7 Aug); `auto` permission policy (10 Sep); dynamic workflows (9 Oct); **self-hosted Managed Agents**, access by request (12 Nov). MCP tunnels and "dreaming" are a narrower research preview. **(P)** — [Claude Platform release notes](https://platform.claude.com/docs/en/release-notes/overview), [Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)
- **[Limit]** Managed Agents "is not currently eligible for Zero Data Retention or HIPAA" (self-hosted excepted). Transcripts persist until deleted. **(P)** — [Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)
- **[Design rationale · 8 Apr 2026]** The service separates the "brain" (harness) from the "hands" (sandbox) with an append-only session log outside both; generated code runs where it cannot reach credentials; time-to-first-token "dropped about 60% at p50 and over 90% at p95." **(P)** — [Anthropic: Scaling Managed Agents](https://www.anthropic.com/research/managed-agents)
- **[TypeScript SDK]** `@anthropic-ai/sdk` reached `1.0.0` on 21 Oct 2026 alongside API version `2026-10-21`; the 1.0 SDKs are Apache-2.0 instead of MIT. **(P)** — [Claude Platform release notes](https://platform.claude.com/docs/en/release-notes/overview)

#### OpenAI: Agents API, Agents SDK, AgentKit, Responses API

- **[Beta · DevDay, 29 Sep 2026]** OpenAI's **Agents API** is in public beta with hosted execution, memory, tools and multi-agent support, running "a managed Codex harness." Computer use arrived in Sep 2026; the DevDay recap adds tool search and context compaction. **(S)** — [OpenAI developer community post](https://community.openai.com/t/devday-2026-announcements-and-developer-resources/1402006), [OpenAI agents guide](https://developers.openai.com/api/docs/guides/agents), [DevDay 2026 recap](https://openai.com/index/devday-2026-recap/)
- **[Being wound down]** OpenAI's AgentKit page says **Agent Builder and Evals will no longer be available from 30 Nov 2026**, pointing developers to the Agents SDK. **(S — important, re-verify)** — [OpenAI AgentKit page](https://openai.com/index/introducing-agentkit/)
- **[Shipped, pre-1.0]** The TypeScript **Agents SDK** (`@openai/agents` `0.22.0`, 12 Nov 2026) lists Agents, **Sandbox Agents** ("paired with a filesystem workspace and sandbox environment for longer-running work"), Realtime Agents, handoffs, guardrails, human-in-the-loop, sessions and tracing. It is "provider-agnostic." Needs Node 22+. **(P)** — [openai-agents-js README](https://github.com/openai/openai-agents-js), [npm registry](https://registry.npmjs.org/@openai%2Fagents)
- **[Limited preview]** A **Decisions API** was announced in limited preview. **(S)** — [OpenAI developer community post](https://community.openai.com/t/devday-2026-announcements-and-developer-resources/1402006)
- **[Positioning]** The Responses API is the lower-level option "for calling models directly or building an agent from scratch." **(S)** — [OpenAI agents guide](https://developers.openai.com/api/docs/guides/agents)
- **[Announced · consumer]** "Dots": persistent, always-on agents "with their own computers," plus a shared "ChatGPT Space." **(S, press)** — [Axios](https://www.axios.com/2026/09/29/openai-dev-day-2026-dots-space-sol), [Decrypt](https://decrypt.co/379584/openai-ai-agents-computers-devday-2026-everything-announced)

#### Other TypeScript frameworks

- **[GA · 21 Aug 2026]** **Google ADK for TypeScript**: `@google/adk` `2.0.0` on 21 Aug 2026, `2.5.0` on 12 Nov 2026 (package first created Oct 2025). Sequential, parallel, loop and routed multi-agent workflows; MCP tools; A2A delegation; a dev UI; `adk deploy cloud_run`. **(P)** — [ADK-JS README](https://github.com/google/adk-js), [npm registry](https://registry.npmjs.org/@google%2Fadk)
- **[GA · 20 Jan 2026]** **Mastra 1.0**: `@mastra/core` `1.0.0` on 20 Jan 2026; `1.86.0` on 25 Nov 2026 (a very fast release pace). Agents, graph workflows (`.then()`, `.branch()`, `.parallel()`), suspend/resume human-in-the-loop backed by storage, memory, evals, observability, MCP server authoring. Core is Apache-2.0 under a dual-licence model. **(P)** — [Mastra README](https://github.com/mastra-ai/mastra), [npm registry](https://registry.npmjs.org/@mastra%2Fcore)
- **[GA, background]** **LangGraph.js 1.0** shipped 18 Oct 2025; `1.7.5` on 17 Nov 2026. `deepagents` is at `1.17.1` (24 Nov 2026). **(P)** — [npm registry: langgraph](https://registry.npmjs.org/@langchain%2Flanggraph), [npm registry: deepagents](https://registry.npmjs.org/deepagents)
- **[Shipped, pre-1.0]** **Cloudflare Agents** (`agents` `0.34.0`, 20 Nov 2026): each agent is a Durable Object that "hibernate[s] when idle"; built-ins include scheduling, Workflows "with human-in-the-loop approval," MCP server and client (with elicitation), "Code Mode," email, voice, sub-agents and x402 payments. **(P)** — [Cloudflare Agents README](https://github.com/cloudflare/agents), [npm registry](https://registry.npmjs.org/agents)
- **[Comparison, weak]** Third-party round-ups lean "Mastra for TypeScript teams, LangGraph.js for graph-style stateful workflows, ADK for Google Cloud shops." **(S, SEO-grade sources)** — [LangChain resources](https://langchain.com/resources/ai-agent-frameworks)

#### Agent Skills

- **[What it is]** "A skill is a folder containing a `SKILL.md` file" with `name` and `description` metadata plus instructions; it may bundle `scripts/`, `references/`, `assets/`. Agents load skills by **progressive disclosure**: name and description at start-up, the full file only when a task matches, bundled files only when needed. **(P)** — [agentskills README](https://github.com/agentskills/agentskills)
- **[Governance · 22 Oct 2026]** Anthropic donated Agent Skills to the Agentic AI Foundation: name, logo, GitHub org and `agentskills.io`. Engineers from Anthropic, Google and OpenAI maintain it as individuals. Proposed roadmap: versioned releases, a formal proposal process, and "security guidance for people who write and install skills." **(P)** — [Anthropic: donating Agent Skills](https://www.anthropic.com/news/donating-agent-skills-to-the-agentic-ai-foundation)
- **[Adoption, self-reported]** "Over 70 agent platforms have integrated Agent Skills since the standard was published in December 2025," including ChatGPT, Cursor, GitHub Copilot and VS Code; about 1 million skills published; nearly 280 million installs. **(P, Anthropic's own numbers)** — [Anthropic: donating Agent Skills](https://www.anthropic.com/news/donating-agent-skills-to-the-agentic-ai-foundation)
- **[Tooling]** The `skills` CLI (`npx skills add …`) installs skills into "OpenCode, Claude Code, Codex, Cursor, and 75 more"; experimental commands sync skills shipped by npm dependencies. **(P)** — [vercel-labs/skills README](https://github.com/vercel-labs/skills)
- **[API]** Skills and the Skills API went **GA on the Claude API on 19 Aug 2026**; Managed Agents can load skills from GitHub repos (7 Aug 2026). **(P)** — [Claude Platform release notes](https://platform.claude.com/docs/en/release-notes/overview)
- **[Shift at OpenAI]** The `openai/skills` repo is "deprecated": Codex skill examples moved to an "OpenAI Plugins repository." **(P)** — [openai/skills README](https://github.com/openai/skills)
- **[Risk, unverified numbers]** Third-party reports cite malicious skills in public registries (one says 341 as of early 2026; another 6,637 of 35,878 analysed). **(S, not independently confirmed)** — [dev.to skills guide](https://dev.to/serenitiesai/ai-agent-skills-guide-2026-build-skills-for-16-ai-tools-1jea)

#### Subagents, plan mode, tool search — when they help

- **[Subagents]** AI SDK guidance: "Subagents add latency and complexity." Use them when tasks "require exploring large amounts of tokens," when research can run in parallel, or to "isolate tool access by capability." Avoid them when "tasks are simple and focused" or "sequential processing suffices." A subagent may burn hundreds of thousands of tokens and return ~1,000. **(P)** — [AI SDK docs: subagents](https://ai-sdk.dev/docs/agents/subagents)
- **[Subagents, background]** Anthropic (Sep 2025): sub-agents return "a condensed, distilled summary," often 1,000–2,000 tokens; best for "complex research and parallel exploration." **(P)** — [Anthropic: effective context engineering](https://www.anthropic.com/research/effective-context-engineering-for-ai-agents)
- **[Tool search · GA]** Anthropic's tool search tool is **stable**. "A typical multiserver setup (GitHub, Slack, Sentry, Grafana, and Splunk) can consume ~55k tokens in definitions"; tool search "typically reduces this by over 85 percent"; and "Claude's ability to pick the right tool degrades once you exceed 30–50 available tools." Use it with 10+ tools or >10k tokens of definitions; skip it under 10 tools. **(P)** — [Claude docs: tool search tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool)
- **[Tool search in Claude Code]** Since v2.1.7 (13 Jan 2026), MCP tools are deferred automatically "when MCP tool descriptions exceed 10% of the context window." **(P)** — [Claude Code changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)
- **[Programmatic tool calling · GA]** Claude writes code that calls your tools inside a code-execution container, "cutting model round trips and token use in multi-tool workflows." Not ZDR-eligible. The `allowed_callers` field "is not a hard API-level block." **(P)** — [Claude docs: programmatic tool calling](https://platform.claude.com/docs/en/agents-and-tools/tool-use/programmatic-tool-calling)
- **[Advisor tool · Beta]** A cheaper executor model consults a stronger advisor mid-task within one request (header `advisor-tool-2026-03-01`). Anthropic reports Sonnet with an Opus advisor "can cost about the same as or less than Opus alone." Poor fit for single-turn work. **(P)** — [Claude docs: advisor tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/advisor-tool)
- **[Plan mode]** Claude Code's recommended pattern: "Plan locally, execute in the cloud" — agree a plan in plan mode (no edits), commit it to the repo, then start an autonomous cloud session to execute it. **(P)** — [Claude Code docs: cloud sessions](https://code.claude.com/docs/en/claude-code-on-the-web)

### Inferences

- **The centre of gravity moved from "framework" to "harness."** In 2026 the three biggest vendors all shipped a hosted agent loop with sandbox, memory and approvals (Managed Agents, Agents API, eve). The AI SDK's `HarnessAgent` exists precisely to rent those loops.
- **For a Vercel + AI SDK + OpenRouter stack, the lowest-risk upgrade path is AI SDK 7's own agents**, not a new framework: `ToolLoopAgent` for short jobs, `WorkflowAgent` when a job must pause for a person. Both keep the model provider swappable.
- **eve is the most relevant new thing, and the least proven.** It is ten days past 1.0. Its folder layout maps neatly onto "cron routes + tools + human review," but its own docs warn that defaults are permissive.
- **AI SDK 7 is ESM-only.** Any CommonJS consumer in a monorepo must be checked before upgrading.
- **OpenRouter compatibility with AI SDK 7 is likely but not proven here.** The provider's `3.0.0` release date fits; I did not read its changelog.
- **Do not build on OpenAI's visual Agent Builder.** If the 30 Nov 2026 shutdown is right, it is gone in days. Code-first SDKs are the durable bet.
- **Skills are the cheapest win in this whole section.** A `SKILL.md` folder is plain text, version-controlled, and now read by every major coding agent. Treat third-party skills like third-party code: read before installing.
- **Rule of thumb from the sources:** add tool search past ~10 tools; add subagents only for context-heavy or parallel research; add an advisor only for long, mostly mechanical runs.
- **Proven:** AI SDK (v7 is five months old with 181 patch releases), LangGraph 1.x, Mastra 1.x, Agent Skills. **Early:** eve, HarnessAgent, decision models, Managed Agents (still beta after 7 months), OpenAI Agents API.

### Gaps

- **I could not read Vercel's AI SDK 7 blog post or `ai-sdk.dev` live.** Findings come from the docs bundled in the npm package and the repo changelog, which are primary but may lag the website.
- **OpenAI is under-sourced.** Every OpenAI DevDay claim is from search summaries. The AgentKit shutdown date, Agents API pricing and status, and the Assistants API sunset date all need a direct check.
- **Claude Managed Agents pricing** was not found in the pages read. A third-party headline mentions "$0.08/hr"; unverified.
- **No hands-on or independent production report** was found for eve, `WorkflowAgent` or Managed Agents.
- Whether `@openrouter/ai-sdk-provider@3` fully supports AI SDK 7 features (tool approvals, tool search, reasoning parameter) is unverified.
- I found no reliable, independent head-to-head of Mastra vs LangGraph.js vs AI SDK. The round-ups are SEO content.
- Hacker News, Latent Space and conference-talk reactions could not be gathered.

---

## 3. Durable execution and long-running agents: the recommended 2026 pattern

### Takeaway

The 2026 consensus, across every vendor read, is the same shape: **run the agent as a durable workflow whose steps checkpoint, pause on a "hook" or webhook for the human, sleep for free while waiting, and resume from the log** — do not hold a serverless function open. On Vercel this is now first-party: **Workflows went GA in Apr 2026**, with Schedules and Queues (both still beta) feeding it.

### Cited Findings

#### Vercel's stack

- **[GA · Apr 2026]** "Vercel Workflows is generally available on April 16" (2026). Public beta had started Oct 2025 (background). **(S)** — [Vercel: a new programming model for durable execution](https://vercel.com/blog/a-new-programming-model-for-durable-execution), [Vercel changelog: WDK public beta](https://vercel.com/changelog/open-source-workflow-dev-kit-is-now-in-public-beta)
- **[GA · SDK v5]** The open-source `workflow` package reached `5.0.0` on 30 Sep 2026; latest `5.8.0` on 24 Nov 2026. Vercel reports 1.6×–25× latency and overhead improvements for v5. **(P for dates; S for numbers)** — [npm registry: workflow](https://registry.npmjs.org/workflow), [Vercel: Workflow SDK 5](https://vercel.com/blog/workflow-sdk-5)
- **[How it works]** A function marked `'use workflow'` calls functions marked `'use step'`. Each step "compiles into an isolated API route," retries on failure, and "the workflow suspends without consuming resources while the step executes." **(P)** — [Vercel docs: workflow concepts](https://vercel.com/docs/workflows/concepts)
- **[Human approval]** "Use a hook to pause a workflow until external data arrives, such as human approval. The workflow resumes automatically when the hook receives data; no polling or message queues are needed." A route handler calls `approvalHook.resume(token, {decision, notes})`. **(P)** — [Vercel docs: workflow concepts](https://vercel.com/docs/workflows/concepts)
- **[Waiting is free]** `sleep('7 days')` pauses "without consuming compute resources." Vercel's guide says sleep works for "minutes to months." **(P; S for "months")** — [Vercel docs: workflow concepts](https://vercel.com/docs/workflows/concepts), [Vercel KB: approval workflow guide](https://vercel.com/kb/guide/agent-approval-workflow-stack-guide)
- **[Timeout pattern]** Vercel's own example races the approval webhook against `sleep('24h')` with `Promise.race`, records "Approval timed out. Nothing was published," and **rejects clicks from users not on an approver list**. **(P)** — [Vercel docs: Chat SDK + Workflows](https://vercel.com/docs/chat-sdk/integrations/workflows)
- **[Reviewer checks]** Vercel's guidance: "authenticate the reviewer and check their authority for the specific action before resuming the workflow. Confirm that the request still matches the version they reviewed, and record the approval separately from execution." **(S)** — [Vercel KB: approval workflow guide](https://vercel.com/kb/guide/agent-approval-workflow-stack-guide)
- **[Email approval is first-class]** Workflow SDK docs: instead of a button, "you could instead create a webhook and send the approval link over email or Slack to resume the agent." Workflows resume "even after days of inactivity" and stay stable "across code deployments." **(P)** — Workflow SDK docs `ai/human-in-the-loop.mdx`, bundled in [workflow@5.8.0](https://registry.npmjs.org/workflow)
- **[Pricing]** Billed on Workflow Events ($0.02 per 1,000), data written ($0.50/GB) and data retained ($0.50/GB-month); Hobby includes 50,000 events a month; step compute is billed as normal Functions. **(S)** — [Vercel docs: workflow pricing](https://vercel.com/docs/workflows/pricing)
- **[Portable]** The SDK runs on other "worlds": local files, Postgres (`@workflow/world-postgres`), or Vercel. **(P)** — eve docs `concepts/execution-model-and-durability.mdx`, in [eve@1.5.0](https://registry.npmjs.org/eve)
- **[Beta]** **Vercel Queues**: public beta for all teams on 27 Feb 2026; max TTL and delay raised to 7 days on 1 Apr 2026; current docs still say "Vercel Queues are available in Beta on all plans" (trigger type `queue/v2beta`). Push consumers auto-acknowledge on success and retry on throw; default visibility timeout 300 s, auto-extended. **(P for docs; S for changelog dates)** — [Vercel docs: queues](https://vercel.com/docs/queues), [Vercel docs: queues SDK](https://vercel.com/docs/queues/sdk), [Vercel changelog: queues beta](https://vercel.com/changelog/vercel-queues-now-in-public-beta)
- **[Beta — replaces cron]** **Vercel Schedules**: a `schedules` block in `vercel.json` can target a private function, an HTTP path, or a Queue topic, with `timezone` and `jitter`. One-off schedules use `--at`. The `vercel schedules` CLI "is in beta." Vercel's docs state: "**Cron Jobs are a legacy feature and will be migrated to Schedules in the future.**" **(P)** — [Vercel docs: schedules configuration](https://vercel.com/docs/schedules/configuration), [Vercel docs: build output config](https://vercel.com/docs/build-output-api/configuration), [Vercel docs: CLI](https://vercel.com/docs/cli)
- **[Migration]** Moving a cron is a rename: replace `crons` with `schedules`, keep `path` and `schedule`, add `"requestMethod": "GET"`. **(P)** — [Vercel docs: migrate from cron jobs](https://vercel.com/docs/schedules/migrate-from-cron-jobs)
- **[Recommended chain]** Vercel's documented pattern is **Schedule → Queue topic → consumer calls `start(workflow)`**, with the schedule's `executionId` used as an idempotency token so a redelivered message cannot start a second run. **(P)** — [Vercel docs: schedules + workflows](https://vercel.com/docs/schedules/workflows)
- **[GA SDK v4 · 12 Nov 2026]** **Vercel Sandbox** (`@vercel/sandbox` `4.0.0`): microVMs with `networkPolicy: 'deny-all'`, automatic filesystem snapshots on stop, snapshot expiry (30 days after last use by default) and persistent **Drives** mountable read-only across sandboxes. **(P)** — [Vercel docs: sandbox SDK reference](https://vercel.com/docs/sandbox/sdk-reference), [Vercel docs: snapshots](https://vercel.com/docs/sandbox/concepts/snapshots), [npm registry](https://registry.npmjs.org/@vercel%2Fsandbox)
- **[Reported]** Sandbox sessions extended to 24 hours; Drives GA; Secure Compute (static egress IP, VPC peering) added Oct 2026. **(S)** — [Vercel community weekly](https://community.vercel.com/t/vercel-weekly-2026-09-07/48955), [Vercel Ship 2026 recap](https://vercel.com/blog/vercel-ship-2026-recap)
- **[GA]** **AI Gateway**: spend **budgets** per team, project, API key or user; model fallbacks through a `models` array; a zero-data-retention request flag; a `/v1/decisions` endpoint. Nov 2026 additions reported: canary ZDR audits, extraction models, provider-country restriction. **(P for docs; S for Nov items)** — [Vercel docs: AI Gateway budgets](https://vercel.com/docs/ai-gateway/observability-and-spend/budgets), [Vercel docs: model fallbacks](https://vercel.com/docs/ai-gateway/models-and-providers/model-fallbacks), [Vercel docs: decision](https://vercel.com/docs/ai-gateway/modalities/decision), [Vercel changelog](https://vercel.com/changelog)
- **[Background]** **Fluid compute** is the default for new projects, with a default execution limit of 300 seconds on all plans. **(S, older changelog entries)** — [Vercel changelog: Fluid defaults](https://vercel.com/changelog/higher-defaults-and-limits-for-vercel-functions-running-fluid-compute)
- **[New]** **Vercel Connect** hands agents scoped, short-lived tokens for third-party services (`getToken('slack/acme-slack', { scopes: ['chat:write'] })`); `@vercel/connect` first published 13 May 2026, `2.0.0` on 26 Aug 2026. Press coverage says GA with 1,000+ connectors. **(P for SDK; S for GA)** — [Vercel docs: Connect tokens](https://vercel.com/docs/connect/concepts/tokens), [npm registry](https://registry.npmjs.org/@vercel%2Fconnect)
- **[Positioning]** Vercel bundles AI SDK, AI Gateway, Sandbox, Workflow SDK and Chat SDK as an "Agent Stack." **(S)** — [Vercel Ship 2026 recap](https://vercel.com/blog/vercel-ship-2026-recap)

#### eve's take on scheduled agents (important nuance)

- **[GA]** A fire-and-forget schedule (markdown prompt + cron) has **no channel**: "it can't ask a person for input… **A tool that needs approval fails the session instead of waiting.**" To involve a human, the schedule must use a handler that sends to a channel. **(P)** — eve docs `schedules.mdx`, in [eve@1.5.0](https://registry.npmjs.org/eve)
- **[GA]** eve keeps secrets in the app runtime, never the sandbox: "The model sees only tool definitions and results." **(P)** — eve docs `concepts/security-model.md`, in [eve@1.5.0](https://registry.npmjs.org/eve)

#### Alternatives

- **[Shipped]** **Inngest** (SDK `4.0.0` on 16 Mar 2026; `4.27.0` on 23 Nov 2026): durable step functions triggered by events, cron or webhooks, with concurrency, throttling, debounce and priority; functions "can run for months." Experimental cloud sandboxes. **(P)** — [Inngest README](https://github.com/inngest/inngest), [npm registry](https://registry.npmjs.org/inngest)
- **[Shipped]** **Trigger.dev** (v4 GA Aug 2025, background; `4.8.10` on 23 Nov 2026): "Long-running without timeouts… unlike AWS Lambda, Vercel"; human-in-the-loop ("pause your tasks until a human can approve, reject or give feedback"); durable AI chat agents; versioned prompts; LLM observability for AI SDK calls; webhooks in public beta. Open source. **(P)** — [Trigger.dev README](https://github.com/triggerdotdev/trigger.dev), [npm registry](https://registry.npmjs.org/@trigger.dev%2Fsdk)
- **[Shipped]** **Temporal** TypeScript SDK `1.26.0` (17 Nov 2026); **Restate** TypeScript SDK `1.18.4` (17 Nov 2026), which lists "Durable AI Agents" first among use cases. **(P)** — [npm registry: temporal](https://registry.npmjs.org/@temporalio%2Fworkflow), [Restate README](https://github.com/restatedev/restate)
- **[Reported]** Inngest "Durable Endpoints" (Feb 2026); Temporal's OpenAI Agents SDK integration GA on 23 Mar 2026; Restate Cloud SOC 2 and HIPAA (Feb 2026). **(S — third-party comparison posts, exact attribution uncertain)** — [particula.tech comparison](https://particula.tech/blog/durable-execution-ai-agents-temporal-inngest-restate), [dev.to comparison](https://dev.to/alexcloudstar/temporal-vs-inngest-vs-vercel-workflow-in-2026-picking-a-durable-engine-2geo)
- **[Vendor view]** Inngest: human-in-the-loop "maps directly to durable execution's suspend/resume primitives." **(S)** — [Inngest blog](https://www.inngest.com/blog/durable-execution-key-to-harnessing-ai-agents)
- **[Hosted alternative]** Claude Managed Agents target "tasks that run for minutes or hours," with sessions that "resume cleanly after pauses," scheduled deployments, and session budgets. **(P)** — [Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)

#### Design lessons from people running long agents

- **[Lesson]** Treat compute as disposable and state as a log: a crashed harness is "woken with the session ID, reload[s] the event log, and resume[s] from the last event." **(P)** — [Anthropic: Scaling Managed Agents](https://www.anthropic.com/research/managed-agents)
- **[Lesson]** Harness scaffolding goes stale as models improve: context resets added for Sonnet 4.5 "had become dead weight" on Opus 4.5. **(P)** — [Anthropic: Scaling Managed Agents](https://www.anthropic.com/research/managed-agents)
- **[Lesson]** The memory-tool prompt Anthropic injects says "ASSUME INTERRUPTION: Your context window might be reset at any moment." **(P)** — [Claude docs: memory tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)

### Inferences

- **The recommended 2026 pattern for "runs for minutes to hours, pauses for approval, resumes":**
  1. A **schedule or event** enqueues a message (idempotent key).
  2. A consumer **starts a durable workflow**.
  3. The agent loop runs as **steps** (each model call and tool call checkpointed and retried).
  4. Before any outward action, the workflow **creates a hook / webhook and stops**. A link goes to the human by email or chat.
  5. The workflow **races the hook against a sleep** (for example 24–72 h) and takes a safe default on timeout.
  6. The resume endpoint **authenticates the reviewer and re-checks that the thing approved is still the thing that will be sent**.
  7. Approval and execution are **logged separately**.
- **This maps almost one-to-one onto a "cron drafts, human approves, system sends" design.** A database-backed approval queue is a hand-rolled version of the same idea. The new primitive mainly removes polling, the 300-second ceiling, and the need to split one job across several cron routes.
- **Vercel has signalled that Cron Jobs are legacy.** No removal date is given. Schedules add time zones, jitter and queue targets, and the migration is a config rename. Low urgency, low effort.
- **Queues and Schedules are still beta.** Workflows is the only GA piece of the chain. A cautious team can start a workflow directly from an existing cron route and adopt the other two later.
- **A scheduled agent with no human channel must not hold approval-gated tools.** eve fails such a session by design. That is the right default to copy: unattended runs draft; only attended runs act.
- **Stay on-platform unless there is a reason not to.** Inngest and Trigger.dev are credible, TypeScript-first and have longer production histories, but add a vendor. Temporal and Restate are heavier than a one-person team needs.
- **Proven:** Temporal, Inngest, Trigger.dev (years in production). **Newer but GA:** Vercel Workflows (7 months). **Beta:** Queues, Schedules, Managed Agents.

### Gaps

- **Vercel Workflows GA date, pricing and rate limits come from search summaries**; the docs search confirmed the API and patterns but not the price table. Search results showed two conflicting rate-limit tables.
- **Maximum function duration by plan under Fluid compute in Nov 2026** was not confirmed.
- **Vercel Queues GA**: no announcement found; treated as still beta on the strength of the current docs.
- No independent post-mortem of Vercel Workflows at scale was found.
- Inngest, Trigger.dev, Temporal and Restate 2026 feature dates are from third-party comparison posts; their own sites were unreachable.
- Cost comparison between Workflows, Inngest and Trigger.dev for a small workload was not possible.

---

## 4. Memory and context engineering: what actually works for a small-business knowledge base

### Takeaway

The strongest 2026 evidence favours **simple, inspectable memory**: files or notes the model writes and searches, plus compaction for long sessions — not a specialist vector or graph memory product. Anthropic's Nov 2026 study found **search plus a model-maintained wiki** beat search alone (61% vs 53%), and its older guidance still holds: under ~200k tokens of knowledge, **skip RAG and put it all in the prompt with caching**.

### Cited Findings

#### Built-in memory and context tools

- **[GA]** Anthropic's **memory tool** is **stable** on all platforms (`memory_20250818`). It is **client-side**: Claude asks for file operations under `/memories` (`view`, `create`, `str_replace`, `insert`, `delete`, `rename`) and your app runs them against storage you control (files, database rows). ZDR-eligible. **(P)** — [Claude docs: memory tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)
- **[Security duties]** You must validate every path ("`/memories/../../secrets.env`"), cap file sizes, expire stale files, and strip sensitive data before writing. **(P)** — [Claude docs: memory tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)
- **[Three primitives]** Anthropic frames long-running context as compaction, tool-result clearing (context editing) and the memory tool: "memory solves the cross-session problem; clearing and compaction solve the in-session one." **(S)** — [Claude cookbook: context engineering](https://platform.claude.com/cookbook/tool-use-context-engineering-context-engineering-tools)
- **[Beta]** **On-demand compaction** (header `compact-2026-09-04`, 14 Sep 2026) returns a signed compaction block; server-side compaction variants (threshold, background, keep-recent-turns) are documented. **(P)** — [Claude Platform release notes](https://platform.claude.com/docs/en/release-notes/overview), [Claude Platform docs index](https://platform.claude.com/llms.txt)
- **[Caveat]** Compaction is lossy: summarised content is "recoverable only if [it is] stored," which is why Managed Agents keep the full event log outside the context. **(P)** — [Anthropic: Scaling Managed Agents](https://www.anthropic.com/research/managed-agents)
- **[Shipped]** Claude Code has had **auto-memory** since v2.1.59 (25 Feb 2026) and loads "only the first 200 lines or 25 KB of its memory index." **(P)** — [Claude Code changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md), [Anthropic: components of agent memory](https://www.anthropic.com/research/components-of-agent-memory)
- **[AI SDK]** Three routes to memory: provider-defined tools (the Anthropic memory tool — "provider lock-in, since this tool only works with Claude"), memory providers (Letta, Mem0, Supermemory, Hindsight, MongoDB, Redis Agent Memory), or a custom tool ("High effort, high flexibility, no lock-in"). On providers: "the provider controls memory behavior, so you have less visibility into what gets stored." **(P)** — [AI SDK docs: memory](https://ai-sdk.dev/docs/agents/memory)

#### Anthropic's Nov 2026 memory study

- **[Model · 6 Nov 2026]** A memory hierarchy: raw **transcripts** (searchable log) → **memory notes** → **representations** such as wikis → a small **injected context**. "The top layer of the memory hierarchy has to stay relatively small." **(P)** — [Anthropic: components of agent memory](https://www.anthropic.com/research/components-of-agent-memory)
- **[Result]** On a 350,000-file codebase (~420M tokens), **wiki + search answered 61% of questions vs 53% for search alone**, and saved ~20,000 tokens per question. On multi-document legal questions: 87% vs 73%. **(P)** — [Anthropic: components of agent memory](https://www.anthropic.com/research/components-of-agent-memory)
- **[Result]** "**Dreaming**" (an offline pass that checks notes against transcripts and consolidates) fixed wrong notes and lifted wiki-only accuracy from 13% to 48% over 128 sessions. It is costly; focus it on information likely to change. **(P)** — [Anthropic: components of agent memory](https://www.anthropic.com/research/components-of-agent-memory)
- **[Result]** Giving each contract its own wiki page raised graded facts from 41/57 to 57/57. **(P)** — [Anthropic: components of agent memory](https://www.anthropic.com/research/components-of-agent-memory)
- **[Failure modes]** Wrong notes carried into every session; stale state; over-logging (an older model "wrote 413 files across 225 folders"); concurrent writes erasing lines; a wiki 1.77× larger than its source that "effectively abstracted nothing"; over-long instruction files reducing adherence. **(P)** — [Anthropic: components of agent memory](https://www.anthropic.com/research/components-of-agent-memory)
- **[Guidance]** "For stronger models, giving them freedom to judge salience was more effective than setting fixed rules in advance." Telling a model to "record only failures" cut its memory gain by 0.234. **(P)** — [Anthropic: components of agent memory](https://www.anthropic.com/research/components-of-agent-memory)
- **[Scope]** The article "does not evaluate vector stores or knowledge graphs." **(P)** — [Anthropic: components of agent memory](https://www.anthropic.com/research/components-of-agent-memory)

#### Memory products

- **[Shipped · vendor numbers]** **Mem0 v3** (`mem0ai` `3.0.0`, 16 Apr 2026). Its "new memory algorithm (April 2026)" claims LoCoMo 71.4 → 92.5 and LongMemEval 67.8 → 94.4, using single-pass add-only extraction, entity linking, and **multi-signal retrieval (semantic + BM25 keyword + entity)**. The README states scores "reflect Mem0's managed platform, which includes proprietary optimizations not available in the open-source SDK." **(P, vendor-reported)** — [Mem0 README](https://github.com/mem0ai/mem0), [npm registry](https://registry.npmjs.org/mem0ai)
- **[Shipped]** **Zep / Graphiti**: "temporal context graphs" where each fact has a validity window and traces back to source "episodes"; **hybrid retrieval (semantic + keyword + graph traversal)**. `@getzep/zep-cloud` `4.0.0` on 14 Oct 2026, described as "the context layer for AI agents." **(P)** — [Graphiti README](https://github.com/getzep/graphiti), [npm registry](https://registry.npmjs.org/@getzep%2Fzep-cloud)
- **[Shipped]** **Letta** TypeScript client `1.12.1`; its last npm publish was 2 Jun 2026. **(P)** — [npm registry](https://registry.npmjs.org/@letta-ai%2Fletta-client)
- **[Caution]** "Every LongMemEval and LoCoMo score here is a vendor measuring its own system. None are independent," and scores are not comparable across vendors. **(S)** — [Atlan: agent memory frameworks 2026](https://atlan.com/know/best-ai-agent-memory-frameworks-2026/)
- **[Hosted]** Managed Agents offer **memory stores** (API `agent-memory-2026-07-22`) and dreaming (research preview). **(P)** — [Claude Platform release notes](https://platform.claude.com/docs/en/release-notes/overview), [Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)

#### Retrieval (mostly background, still the reference points)

- **[Background · Sep 2024]** **Contextual retrieval**: prepending chunk-specific context before embedding cut top-20 retrieval failures by 35%; adding contextual BM25, 49%; adding reranking, 67% (5.7% → 1.9%). Passing the top 20 chunks beat 5 or 10. **(P)** — [Anthropic: contextual retrieval](https://www.anthropic.com/news/contextual-retrieval)
- **[Background · Sep 2024]** "For knowledge bases under about 200,000 tokens (roughly 500 pages), you can skip RAG and include the entire knowledge base in the prompt," with prompt caching. **(P)** — [Anthropic: contextual retrieval](https://www.anthropic.com/news/contextual-retrieval)
- **[Background · Sep 2025]** **Agentic ("just-in-time") search**: let the agent load data through tools at run time instead of pre-computing everything; because that is slower, use a **hybrid** — retrieve some up front, explore the rest — and "do the simplest thing that works." **(P)** — [Anthropic: effective context engineering](https://www.anthropic.com/research/effective-context-engineering-for-ai-agents)
- **[2026 cache economics]** Cache reads dropped to 0.025× base input on Fable 5.1 (1 Sep 2026) and to $0.10/MTok on Sonnet 5.5 (7 Oct 2026), making "stuff the whole knowledge base in a cached prompt" cheaper through the year. **(P)** — [Claude Platform release notes](https://platform.claude.com/docs/en/release-notes/overview)

### Inferences

- **For a small-business knowledge base, the order to try things is:**
  1. **Whole knowledge base in a cached prompt** if it fits (under ~200k tokens).
  2. **Agentic search over plain files or Postgres rows** (keyword + a handful of read tools).
  3. **Add a model-maintained index or wiki page per entity** (per deal, per solicitor, per area). This is the only step with fresh 2026 evidence behind it.
  4. Only then **hybrid vector + BM25 + rerank** with contextual chunking.
  5. A **temporal knowledge graph** last, and only if "what was true when" questions dominate.
- **"One page per entity" is the most transferable finding.** The contract-page result (72% → 100% of facts) suggests a per-deal or per-vendor memory page beats a pile of chunks.
- **Memory is an attack and error surface.** A wrong or injected note is replayed into every future run. For an agent that reads inbound email, memory writes derived from untrusted text should be reviewed or kept out of the always-injected layer.
- **Mem0 and Zep both converged on hybrid retrieval** (semantic + keyword + entity/graph). That agreement between competitors is better evidence than either benchmark.
- **Vendor memory benchmarks should be ignored for buying decisions.** They are self-measured and not comparable.
- **OpenRouter caveat:** the Anthropic memory tool, tool search and compaction are Anthropic API features. Whether they pass through an aggregator unchanged is unverified; a **custom memory tool** over Postgres is the provider-neutral route the AI SDK docs describe.
- **Proven:** prompt caching + full-context, hybrid retrieval with reranking, file-based agent memory. **Promising, single-source:** wiki + dreaming. **Unproven for small teams:** graph memory platforms.

### Gaps

- **pgvector on Neon / Postgres: no 2026 source gathered** (`neon.com` unreachable; search budget spent). Nothing here confirms or updates pgvector, HNSW, or hybrid-search guidance for Neon.
- **Late-interaction retrieval (ColBERT-style, multi-vector) and 2026 embedding / reranker model rankings: not researched.**
- No independent benchmark comparing Mem0, Zep, Letta and file-based memory was found.
- Anthropic's memory study uses Anthropic models and tasks (a game, a codebase, legal briefs). Transfer to CRM-style business memory is an inference.
- Whether Anthropic's memory tool and compaction work via OpenRouter was not checked.
- Context-editing status (GA or beta) was not confirmed from its own page.

---

## 5. Evals, observability and guardrails — including prompt-injection defence and human approval

### Takeaway

Best practice in 2026 is unglamorous: **20–50 real failure cases, binary rubrics, code graders first, LLM judges calibrated against a person, and read the transcripts**. For agents that read untrusted email or web content, the leading labs now say plainly that **model-level defences are not enough** — cap the blast radius with architecture (no credentials near untrusted content, restricted egress, a human gate on anything outward), because per-action approval prompts get rubber-stamped ~93% of the time.

### Cited Findings

#### Evals

- **[Guidance · 9 Jan 2026]** Start with "20-50 simple tasks drawn from real failures." Separate **capability evals** (start low, a hill to climb) from **regression evals** (should sit near 100%). **(P)** — [Anthropic: demystifying evals](https://www.anthropic.com/research/demystifying-evals-for-ai-agents)
- **[Guidance]** Prefer deterministic graders, use LLM graders where needed, humans to validate. **Grade the outcome** (what is in the database), not the agent's claim or a fixed tool sequence. **(P)** — [Anthropic: demystifying evals](https://www.anthropic.com/research/demystifying-evals-for-ai-agents)
- **[Guidance]** For consistency use **pass^k** (all k trials succeed): a 75% per-trial rate gives ~42% over three trials. **(P)** — [Anthropic: demystifying evals](https://www.anthropic.com/research/demystifying-evals-for-ai-agents)
- **[LLM-as-judge]** Calibrate against human experts; give the judge an "Unknown" escape hatch; use structured rubrics and "a separate isolated judge for each dimension." A near-0% pass rate "usually signals a broken task or grader." **(P)** — [Anthropic: demystifying evals](https://www.anthropic.com/research/demystifying-evals-for-ai-agents)
- **[LLM-as-judge · 13 Nov 2026]** "Make criteria atomic and binary." Use a different model from the one under test; check for length bias; "Validate against human labels" until grader-to-expert agreement approaches expert-to-expert; "Fail loudly" when the grader breaks. **(P)** — [Anthropic: building strong safety evaluations](https://www.anthropic.com/research/building-strong-safety-evaluations)
- **[Statistics]** Pre-register metrics; use at least 100 items for multi-turn evals; report confidence intervals. A 98% vs 94% difference in one comparison was **not statistically significant**; a system-prompt change alone moved a rate from 60% to 94%. **(P)** — [Anthropic: building strong safety evaluations](https://www.anthropic.com/research/building-strong-safety-evaluations)
- **[Tools named by Anthropic]** Harbor, Braintrust (`autoevals`), LangSmith, Langfuse ("self-hosted open-source alternative"), Arize Phoenix. **(P)** — [Anthropic: demystifying evals](https://www.anthropic.com/research/demystifying-evals-for-ai-agents)
- **[Infra noise]** Anthropic published "Quantifying infrastructure noise in agentic coding evals" (5 Feb 2026). Title and date only. **(P, title only)** — [Anthropic engineering index](https://www.anthropic.com/engineering)

#### Tooling landscape

- **[Ownership change]** **Langfuse**: "Since January 2026 we're part of ClickHouse." Still open source and self-hostable. Its OpenTelemetry-based JS SDK (`@langfuse/tracing`) reached `6.0.0` on 14 Oct 2026; the old `langfuse` v3 client is marked deprecated. **(P)** — [Langfuse README](https://github.com/langfuse/langfuse), [npm registry: @langfuse/tracing](https://registry.npmjs.org/@langfuse%2Ftracing), [npm registry: langfuse](https://registry.npmjs.org/langfuse)
- **[Ownership change]** **promptfoo**: "Promptfoo is now part of OpenAI. Promptfoo remains open source and MIT licensed." Evals run locally; includes red-teaming and CI. `0.126.0` on 18 Nov 2026. **(P)** — [promptfoo README](https://github.com/promptfoo/promptfoo), [npm registry](https://registry.npmjs.org/promptfoo)
- **[Shipped]** **Braintrust** SDK `3.0.0` (19 Feb 2026), `3.44.0` (11 Nov 2026), 4.0 release candidates in Nov 2026. **Arize Phoenix** client `8.0.0` (11 Nov 2026). **(P)** — [npm registry: braintrust](https://registry.npmjs.org/braintrust), [npm registry: phoenix-client](https://registry.npmjs.org/@arizeai%2Fphoenix-client)
- **[Not stable]** **OpenTelemetry GenAI semantic conventions** moved to their own repository (covering clients, MCP and provider conventions). Its README lists "Schema URL: TODO." Third-party trackers say every `gen_ai` attribute is still "Development" status with no stabilisation timeline. **(P for repo; S for status)** — [semantic-conventions-genai README](https://github.com/open-telemetry/semantic-conventions-genai), [dev.to status write-up](https://dev.to/azena-ai/opentelemetrys-genai-semantic-conventions-are-not-stable-yet-heres-what-actually-shipped-in-2026-3mke)
- **[GA]** AI SDK 7 made telemetry stable and added `@ai-sdk/otel`. **(P)** — [AI SDK changelog](https://github.com/vercel/ai/blob/main/packages/ai/CHANGELOG.md)
- **[Beta]** Anthropic API **OpenTelemetry export** (14 Oct 2026); a Usage and Cost Analytics API (29 Oct 2026). **(P)** — [Claude Platform release notes](https://platform.claude.com/docs/en/release-notes/overview)
- **[New]** **Vercel Agent Runs**: per-run traces (turns, tool calls, token usage) viewable with `vercel agent-runs trace <id>`; eve exports there by default in preview and production. **(P)** — [Vercel docs: agent-runs CLI](https://vercel.com/docs/cli/agent-runs), eve docs `concepts/security-model.md` in [eve@1.5.0](https://registry.npmjs.org/eve)
- **[Being removed]** OpenAI's hosted Evals product (with Agent Builder) reportedly ends 30 Nov 2026. **(S)** — [OpenAI AgentKit page](https://openai.com/index/introducing-agentkit/)

#### Prompt injection and containment

- **[Principle · 25 May 2026]** Anthropic: "The engineering question becomes how to cap the blast radius." Enforce what an agent *can* reach, not only what it *does*: "The deterministic boundary is what gets hit when everything probabilistic misses." **(P)** — [Anthropic: how we contain Claude](https://www.anthropic.com/research/how-we-contain-claude)
- **[Numbers]** On the Gray Swan agent red-teaming benchmark, attack success against Claude Opus 4.7 was "~0.1% per single attempt, ~5–6% after 100 adaptive attempts." **(P)** — [Anthropic: how we contain Claude](https://www.anthropic.com/research/how-we-contain-claude)
- **[What failed]** **Per-action approval prompts**: "Users approved about 93% of them"; experienced users auto-approve about twice as often. **Allowlists as destination filters**: an allowed API domain let an attacker upload files to their own account — "Every function reachable through any domain on an allowlist is now an attack surface." **Phishing the user**: a credential-exfiltration prompt succeeded 24 of 25 times because the instruction came from the user. **(P)** — [Anthropic: how we contain Claude](https://www.anthropic.com/research/how-we-contain-claude)
- **[What held]** Standard isolation (hypervisors, syscall filters) held; Anthropic's own custom proxy and allowlist code was what failed. "If credentials never enter the sandbox, they can't be exfiltrated." **(P)** — [Anthropic: how we contain Claude](https://www.anthropic.com/research/how-we-contain-claude)
- **[Persistence risk]** Injected instructions stored in memory, config or workspace files reload every session; sub-agent output can carry injections upward. **(P, summarised from the article)** — [Anthropic: how we contain Claude](https://www.anthropic.com/research/how-we-contain-claude)
- **[Classifier gate · 25 Mar 2026]** Claude Code **auto mode** uses an input probe on tool outputs plus an action classifier that sees user messages and tool calls but **not** the agent's prose or tool outputs. Measured: 0.4% false-positive rate on 10,000 real actions; **17% of real overeager actions missed** (n=52); 5.7% miss rate on synthetic exfiltration. Anthropic calls 17% the "honest number" and says auto mode is "not a drop-in replacement for careful human review on high-stakes infrastructure." **(P)** — [Anthropic: Claude Code auto mode](https://www.anthropic.com/research/claude-code-auto-mode)
- **[Design lessons]** Judge what the agent did, not what it says; evaluate whole command chains; read consent conservatively; after 3 consecutive or 20 total denials, escalate to a human. **(P)** — [Anthropic: Claude Code auto mode](https://www.anthropic.com/research/claude-code-auto-mode)
- **[Framing]** The "**lethal trifecta**": private-data access + exposure to untrusted content + the ability to act externally. Remove any one leg and exfiltration fails; Meta's "Rule of Two" makes the same point. **(S)** — [Sophos](https://www.sophos.com/blog/inside-the-lethal-trifecta-blast-radius-reduction-in-ai-agent-deployments), [HiddenLayer](https://hiddenlayer.com/research/the-lethal-trifecta-and-how-to-defend-against-it)
- **[Reported]** A study (Nasr et al.) tested 12 published defences and human red-teamers reportedly bypassed all of them. **(S — primary paper not read)** — [Sophos](https://www.sophos.com/blog/inside-the-lethal-trifecta-blast-radius-reduction-in-ai-agent-deployments)
- **[Reported]** A Cloud Security Alliance note claims 83% of defences that vendors said their agents had lacked independent verification. **(S, single assessment)** — [CSA research note](https://labs.cloudsecurityalliance.org/research/csa-research-note-ai-agent-lethal-trifecta-capability-securi)
- **[Trust labelling]** Redis's AI SDK memory integration injects recalled memories "as bounded, untrusted context." Claude Code tells a receiving agent that a peer message "came from another Claude session, not from you" and cannot serve as consent. **(P)** — [AI SDK docs: memory](https://ai-sdk.dev/docs/agents/memory), [Claude Code docs: agent teams](https://code.claude.com/docs/en/agent-teams)

#### Human-in-the-loop and agent permissions

- **[GA]** AI SDK `toolApproval` (per-tool, per-input, per-request) and `@ai-sdk/policy-opa` — see section 2. **(P)** — [AI SDK docs: tool approvals](https://ai-sdk.dev/docs/agents/tool-approvals)
- **[GA]** Durable approval through Workflow hooks, with reviewer authentication and timeout — see section 3. **(P)** — [Vercel docs: workflow concepts](https://vercel.com/docs/workflows/concepts)
- **[Vendor default]** eve: "Require human approval or other safeguards for sensitive, irreversible, regulated, financial, healthcare, employment, **housing**, legal, safety-impacting, user-impacting, or external side-effecting actions." **(P)** — eve docs `responsible-use.md`, in [eve@1.5.0](https://registry.npmjs.org/eve)
- **[Beta]** Managed Agents: permission policies including `auto` (10 Sep 2026), vaults that keep credentials out of the sandbox, session budgets. **(P)** — [Claude Platform release notes](https://platform.claude.com/docs/en/release-notes/overview)
- **[Scoped credentials]** Vercel Connect issues short-lived, scope-limited tokens per connector and installation. **(P)** — [Vercel docs: Connect tokens](https://vercel.com/docs/connect/concepts/tokens)
- **[Scheduled runs]** Claude Code cloud scheduled tasks note the stored prompt "is therefore not live user input and can't act as approval or consent for actions during the run." **(P)** — [Claude Code docs: scheduled tasks](https://code.claude.com/docs/en/routines)

### Inferences

- **An agent that only reads a mailbox, cannot send, and holds drafts for a person has already removed the "act externally" leg.** That is the single most effective defence in the sources. The remaining risks are quieter: a poisoned email steering *what gets drafted*, *which record it is filed against*, or *what gets written to memory*.
- **Approval fatigue is the real threat to a human-review rule.** At a ~93% rubber-stamp rate, a review queue protects only if volume is low and each item shows *what changed and why*. Fewer, richer approvals beat many thin ones.
- **Deciding on headers before fetching bodies is a containment pattern the sources would endorse**: untrusted content that never enters the context cannot inject.
- **Put deterministic gates where rules are deterministic** (recipient is on the deal, amount under a threshold, postcode matches exactly), and keep model judgement for display-only output. This mirrors the OPA guidance.
- **Minimum viable eval kit for one founder:** a spreadsheet of 20–50 past failures → a script that replays them (promptfoo or plain Vitest) → binary checks in code where possible → one LLM judge per criterion, spot-checked by hand → run on every prompt or model change. Any of Langfuse, Braintrust or Phoenix adds tracing later.
- **Instrument with OpenTelemetry via the AI SDK now, but pin versions.** The GenAI attribute names are not frozen.
- **Vendor independence shrank in 2026:** promptfoo belongs to OpenAI, Langfuse to ClickHouse. Both stay open source. Worth knowing; not a reason to avoid them.
- **Proven:** sandboxing, egress control, credential isolation, human gates on outward actions, failure-driven eval sets. **Not sufficient alone:** injection classifiers, system-prompt warnings, per-action prompts.

### Gaps

- **Hamel Husain, Simon Willison and other practitioner writing could not be read** (hosts unreachable; search budget spent). The eval and injection guidance here is Anthropic-heavy.
- The Nasr et al. and CSA claims are second-hand.
- **OpenAI's and Google's 2026 agent-security guidance was not gathered.**
- No 2026 source on **email-specific** injection incidents or defences was found.
- LangSmith's 2026 changes were not researched.
- Whether OpenRouter passes OpenTelemetry trace context or offers its own tracing was not checked.
- No pricing comparison of Langfuse, Braintrust and Phoenix was gathered.

---

## 6. Coding agents and agentic engineering for a solo founder

### Takeaway

By late 2026 every major coding agent runs **in the cloud, in the background, on a schedule, and in parallel**, and they have converged on the same extension points (skills, plugins, subagents, hooks, MCP, an `AGENTS.md`-style memory file). Claude Code is the best-documented example: cloud sessions, scheduled tasks with API and GitHub triggers, auto-fixing PRs, and script-driven fan-out to hundreds of subagents — but most of the multi-agent surfaces are still **preview or experimental**, and the bottleneck has moved from writing code to **verifying it**.

### Cited Findings

#### Claude Code in Nov 2026

- **[Version]** `@anthropic-ai/claude-code` `2.1.332` on 24 Nov 2026; 448 changelog versions since early 2025. **(P)** — [npm registry](https://registry.npmjs.org/@anthropic-ai%2Fclaude-code), [Claude Code changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)
- **[GA on paid plans]** **Cloud sessions** run on an Anthropic-managed VM, keep going "after you close your laptop," can be steered from browser, phone, desktop or terminal, and have "no separate charge for the cloud VM" (they draw on plan limits). Available on Pro, Max, Ultra, Team and qualifying Enterprise seats. Start with `claude --cloud "…"`; pull back with `--teleport`. **(P)** — [Claude Code docs: cloud sessions](https://code.claude.com/docs/en/claude-code-on-the-web)
- **[Security model]** GitHub credentials "never enter a session's VM"; a proxy attaches them server-side. Default network access is limited to an allowlist. Not available to ZDR, HIPAA-configured or CMEK organisations. **(P)** — [Claude Code docs: cloud sessions](https://code.claude.com/docs/en/claude-code-on-the-web)
- **[Research preview · launched 14 Apr 2026]** **Cloud scheduled tasks** (formerly "routines"): a saved prompt + repos + connectors, triggered by a **schedule**, an **API call** (own endpoint and bearer token) or **GitHub events**. "Scheduled tasks are in research preview." They belong to the individual account and act as you on GitHub and connectors. **(P; S for launch date)** — [Claude Code docs: scheduled tasks](https://code.claude.com/docs/en/routines), [Claude blog: introducing routines](https://claude.com/blog/introducing-routines-in-claude-code)
- **[Limits]** Cloud schedule minimum interval is 1 hour; desktop scheduled tasks can go to 1 minute; `/loop` is session-scoped. **(S)** — [Claude Code docs: scheduled tasks](https://code.claude.com/docs/en/routines)
- **[Permissions in unattended runs]** Scheduled runs start in **auto mode**; all connected connectors are included by default — "Remove any the task doesn't need: Claude can use an included connector during a run, including writes." **(P)** — [Claude Code docs: scheduled tasks](https://code.claude.com/docs/en/routines)
- **[GA]** **Auto-fix pull requests**: Claude subscribes to PR activity and pushes fixes for failing CI or review comments. Warning from the docs: replies post under your GitHub account and "can trigger" comment-driven automation such as deploy bots. **(P)** — [Claude Code docs: cloud sessions](https://code.claude.com/docs/en/claude-code-on-the-web)
- **[Shipped]** **Auto mode** (classifier-gated autonomy; engineering write-up 25 Mar 2026) sits between manual prompts and skipping permissions. **(P)** — [Anthropic: Claude Code auto mode](https://www.anthropic.com/research/claude-code-auto-mode)
- **[Five ways to parallelise]** Subagents; **agent view** (`claude agents`, research preview, added 11 May 2026); **agent teams** (experimental, off by default, added 5 Feb 2026); **Projects** (public beta on Pro, Max, Ultra; not yet Team or Enterprise); **dynamic workflows**. **(P)** — [Claude Code docs: run agents in parallel](https://code.claude.com/docs/en/agents), [Claude Code changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)
- **[Available on all paid plans]** **Dynamic workflows**: Claude writes a JavaScript script (`agent()`, `pipeline()`, `parallel()`) that a runtime executes in the background; up to 16 concurrent agents by default, 1,000 per run; resumable; saved scripts become slash commands. The bundled `/deep-research` workflow fans out searches and cross-checks claims. `ultracode` turns it on per task or per session. **(P)** — [Claude Code docs: dynamic workflows](https://code.claude.com/docs/en/workflows)
- **[Other 2026 additions, dated from the changelog]** MCP tool search by default (13 Jan); auto-memory (25 Feb); HTTP hooks and `/batch` (28 Feb); `/loop` (6 Mar); MCP elicitation (14 Mar); `/ultrareview` multi-agent cloud review (16 Apr); `/goal` — "keeps working across turns until it's met" (11 May); `/code-review` (21 May); MCP 2026-07-28 by default (16 Sep). **(P)** — [Claude Code changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)
- **[Background]** Plugins (9 Oct 2025), Skills (16 Oct 2025), sandboxed Bash (20 Oct 2025), background agents (5 Dec 2025), Claude in Chrome beta (17 Dec 2025). **(P)** — [Claude Code changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)
- **[Team features]** Code Review on every PR (Team and Enterprise), PR Steward, Claude Approvals policy files, self-hosted environments, Claude Tag for Slack. **(P)** — [Claude Code docs index](https://code.claude.com/docs/llms.txt)
- **[Models]** 2026 launches include Claude Fable 5 (9 Jun), Sonnet 5 (30 Jun), Opus 5 (24 Jul), Fable 5.1 (1 Sep), Opus 5.5 (22 Sep), Sonnet 5.5 (28 Sep), Haiku 5.5 (7 Oct), Fable 5.2 (9 Nov). Sonnet 4.5 retires 30 Nov 2026; Opus 4.5 on 22 Jan 2027. **(P)** — [Claude Platform release notes](https://platform.claude.com/docs/en/release-notes/overview)
- **[Reliability note]** Anthropic published "An update on recent Claude Code quality reports" (a post-mortem) on 23 Apr 2026. Title and date only. **(P, title only)** — [Anthropic engineering index](https://www.anthropic.com/engineering)

#### Other coding agents

- **[Shipped]** **OpenAI Codex**: CLI `0.172.0` (24 Nov 2026); surfaces are the CLI, IDE extensions, a desktop app (`codex app`) and the cloud agent "Codex Web." Usable with ChatGPT Plus, Pro, Business, Edu or Enterprise plans. **(P)** — [Codex README](https://github.com/openai/codex), [npm registry](https://registry.npmjs.org/@openai%2Fcodex)
- **[Reported · DevDay Sep 2026]** Cloud-based Codex environments, code-review tools, an "Agents view," voice control in the CLI, "Codex Security Cloud." **(S)** — [InfoQ](https://infoq.com/news/2026/10/openai-devday-2026)
- **[Shipped]** **GitHub Copilot CLI** hit `1.0.0` on 6 Mar 2026 (`1.0.115` on 23–24 Nov 2026). Dated additions: `/delegate` to the Copilot coding agent, which opens a PR and works in the background (28 Oct 2025, background); skills (Dec 2025); built-in subagents (2 Jan 2026); plan mode (20 Jan); plugins (22 Jan); hooks that can deny tool calls (27 Jan); experimental **autopilot** mode (30 Jan); MCP elicitation forms (3 Mar). **(P)** — [Copilot CLI changelog](https://github.com/github/copilot-cli/blob/main/changelog.md), [npm registry](https://registry.npmjs.org/@github%2Fcopilot)
- **[Shipped]** **Cursor** published a TypeScript SDK "for Cursor agents" (`@cursor/sdk`, first release 26 Apr 2026; `1.5.0` on 24 Nov 2026) that drives **cloud agents**, including "no-repo cloud agents" on an empty VM, with `run.steer()` to redirect a running run. **(P)** — [npm registry: @cursor/sdk](https://registry.npmjs.org/@cursor%2Fsdk)
- **[Shipped]** **Gemini CLI** `0.71.1` (24 Nov 2026), with nightly builds. Google's **Jules** terminal package (`@google/jules`) was last published 16 Dec 2025. **(P)** — [npm registry: gemini-cli](https://registry.npmjs.org/@google%2Fgemini-cli), [npm registry: jules](https://registry.npmjs.org/@google%2Fjules)

#### Spec-driven development and shared conventions

- **[Shipped]** **GitHub Spec Kit** now frames itself as "structured processes, reusable templates, and documented outcomes" for coding agents: Spec-Driven Development in core, plus bundled bug-fixing and idea-assessment processes, with integrations to switch between agents. **(P)** — [spec-kit README](https://github.com/github/spec-kit)
- **[Shipped]** **AGENTS.md**: "a README for agents." Claude Code's memory doc covers "CLAUDE.md or AGENTS.md." It sits in AAIF alongside MCP and A2A. **(P; S for AAIF membership)** — [agents.md README](https://github.com/agentsmd/agents.md), [Claude Code docs index](https://code.claude.com/docs/llms.txt), [AAIF builder's guide](https://aaif.io/blog/a2a-v1-0-a-builder-s-guide-part-1-discovery-tasks-and-clients)
- **[Pattern]** Libraries now ship agent-readable docs and skills inside their npm packages (`ai`, `eve`, `chat`, `workflow`); Trigger.dev and Vercel publish installable skills. **(P)** — [Chat SDK README](https://github.com/vercel/chat), [Trigger.dev README](https://github.com/triggerdotdev/trigger.dev)

#### What high-output teams report (Anthropic's own practice — not solo founders)

- **[Harness economics · 24 Mar 2026]** For the same app prompt, a solo agent took 20 min and $9 but produced a broken core feature; a planner–generator–evaluator harness took 6 h and $200 and produced a working app. With a newer model the sprint structure was removed and the evaluator ran once at the end. "Every harness component encodes an assumption about what the model cannot do alone." **(P)** — [Anthropic: harness design](https://www.anthropic.com/research/harness-design-long-running-apps)
- **[Evaluator weakness]** Out of the box the QA agent "found real issues, then talked itself into approving them." **(P)** — [Anthropic: harness design](https://www.anthropic.com/research/harness-design-long-running-apps)
- **[Scale demo · 5 Feb 2026]** 16 parallel agents, ~2,000 sessions, two weeks, just under $20,000 → a 100,000-line C compiler that builds Linux 6.9. No orchestrator; agents claimed tasks with lock files in git. The key enabler was **near-perfect tests**; the warning: it is easy to "see tests pass and assume the job is done." **(P)** — [Anthropic: building a C compiler](https://www.anthropic.com/research/building-c-compiler)
- **[Where the bottleneck went · 13 Oct 2026]** "The bottleneck, now, is all of the developer infrastructure built for human scale." Anthropic's merges rose from ~2,500 a day in May to 30,000+ a day by September; a seven-person team rebuilt source control and code review in five months; reviewers "examine the intent of the change"; "the role of the engineers was to tell Claude 'no.'" **(P)** — [Anthropic: redesigning source control](https://www.anthropic.com/research/redesigning-source-control)
- **[Multi-session memory pattern]** An initialiser session writes a progress log and feature checklist; each later session reads them first and updates them last; "Mark a feature complete only after end-to-end verification confirms it works, not when the code is written." **(P)** — [Claude docs: memory tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)

### Inferences

- **A solo founder can now run a "night shift."** The concrete, shipped pieces: a cloud session per task, a scheduled task per recurring chore (dependency updates, doc freshness checks, nightly review), and auto-fix on open PRs. All work from a phone.
- **Verification is the scarce resource, not generation.** Every Anthropic write-up lands on the same point: tests, an oracle, a pre-push build, and a human who reads intent. A strict pre-push build and a rule that the founder reviews every outward email are the same idea in two domains.
- **Use the stable surfaces; sample the experimental ones.** Stable enough: subagents, skills, hooks, plan mode, cloud sessions, `/code-review`. Preview: scheduled tasks, agent view, Projects. Experimental: agent teams.
- **Scheduled tasks are powerful and broadly scoped by default.** They run in auto mode with every connector attached unless trimmed. For an account connected to mail, calendar and ads tools, trimming connectors per task is the first hardening step.
- **Auto-fix can trigger deploys.** In a repo where a PR comment or push kicks off production automation, enable it deliberately.
- **Conventions are converging, which lowers switching cost.** `SKILL.md`, `AGENTS.md`, plugins, hooks and MCP now work across Claude Code, Codex, Copilot and Cursor. Investment in a good skills folder and repo instructions is portable.
- **Spec-driven development has become "process as a skill."** Spec Kit's shift from one methodology to a kit of processes matches what the harness research found: structure helps most at the edge of what the model can do alone, and should be removed when it stops helping.
- **Proven:** single-agent sessions with strong tests; cloud background sessions; PR-based review. **Hype risk:** "hundreds of agents" demos — real, but they cost thousands of dollars and depend on a perfect test oracle.

### Gaps

- **No reliable source on what high-output solo founders are doing in 2026 was gathered.** The search budget ran out before this question; the evidence above is Anthropic describing itself. This is the weakest part of these notes.
- **Devin: nothing gathered.** **Cursor and Jules: package metadata only.** Their sites were unreachable.
- **OpenAI Codex 2026 features are second-hand** apart from the README.
- GitHub Copilot coding agent (the cloud product, as opposed to the CLI) pricing and limits were not checked.
- Claude Code scheduled-task run caps and plan-level usage limits were not extracted.
- No independent productivity study of coding agents from 2026 was found or read.
- AI Engineer World's Fair / Summit, Vercel Ship and Next.js Conf talk content could not be accessed.

---

## 7. Multi-agent systems: what the 2026 evidence says

### Takeaway

The evidence is consistent: **multi-agent helps when work is wide, independent and checkable** (research, review, audits, large migrations, competing hypotheses) and **hurts when work is sequential, shares files, or leans on many tools** — at a token cost of several times to ~15× a single agent. The orchestrator-plus-workers shape beats free-for-all peers; "AI employees" are being productised as persistent, scheduled single agents rather than as autonomous teams.

### Cited Findings

- **[Vendor guidance]** Claude Code agent teams "add coordination overhead and use significantly more tokens than a single session. They work best when teammates can operate independently. For sequential tasks, same-file edits, or work with many dependencies, a single session or subagents are more effective." **(P)** — [Claude Code docs: agent teams](https://code.claude.com/docs/en/agent-teams)
- **[Vendor guidance]** Strongest team use cases: research and review; new modules with separate ownership; "debugging with competing hypotheses"; cross-layer work. "Start with 3-5 teammates… Three focused teammates often outperform five scattered ones." **(P)** — [Claude Code docs: agent teams](https://code.claude.com/docs/en/agent-teams)
- **[Status]** Agent teams remain **experimental** nine months after launch, with listed limits: no session resumption for teammates, task status that "can lag," no nested teams, one team per session. **(P)** — [Claude Code docs: agent teams](https://code.claude.com/docs/en/agent-teams)
- **[Why debate helps]** "Sequential investigation suffers from anchoring… With multiple independent investigators actively trying to disprove each other, the theory that survives is much more likely to be the actual root cause." **(P, vendor reasoning, not a measured result)** — [Claude Code docs: agent teams](https://code.claude.com/docs/en/agent-teams)
- **[Script beats chat for scale]** Dynamic workflows move "the plan into code": the script holds the loop and intermediate results, so the lead's context holds only the final answer, and can "have independent agents adversarially review each other's findings before they're reported." Scale: "dozens to hundreds of agents per run." **(P)** — [Claude Code docs: dynamic workflows](https://code.claude.com/docs/en/workflows)
- **[Cost]** Solo run: 20 min, $9, broken result. Planner–generator–evaluator harness: 6 h, $200, working result ("over 20x" the cost). **(P)** — [Anthropic: harness design](https://www.anthropic.com/research/harness-design-long-running-apps)
- **[Roles shrink as models improve]** With Opus 4.6 the sprint decomposition was dropped and the evaluator ran once; the planner was kept because without it "the generator under-scoped its apps." Evaluators are "worth their cost when a task sits beyond what the current model reliably does solo." **(P)** — [Anthropic: harness design](https://www.anthropic.com/research/harness-design-long-running-apps)
- **[Parallel without an orchestrator]** 16 agents, ~2,000 sessions, ~$20,000, coordinating only through git lock files, built a working C compiler. It needed near-perfect verifiers, and when all agents hit the same single large failing task, parallelism stalled until a known-good oracle let them split the problem. **(P)** — [Anthropic: building a C compiler](https://www.anthropic.com/research/building-c-compiler)
- **[Background · Jun 2025]** Anthropic's multi-agent research system reportedly beat a single agent by 90.2% on its internal research eval while using about 15× the tokens of a chat. **(S for the numbers; the post exists in Anthropic's index)** — [Anthropic: multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
- **[Independent research, second-hand]** A study by Kim et al., as reported by VentureBeat: under fixed compute, multi-agent systems suffer "context fragmentation"; a **2–6× efficiency penalty on tool-heavy tasks**; **independent parallel agents amplified errors 17.2×** versus a single agent, while **centralised (orchestrator) designs held it to 4.4×**. A related Google result is cited as a 39–70% drop on sequential reasoning tasks. **(S — primary papers not read)** — [VentureBeat](https://venturebeat.com/orchestration/research-shows-more-agents-isnt-a-reliable-path-to-better-enterprise-ai)
- **[Independent research, second-hand]** Fu et al. compared six multi-agent workflows with a single agent across ten benchmarks; only one beat the single agent (79.70% vs 76.65%), the other five trailed by 1.71–8.76 points. **(S — attribution to this article is uncertain)** — [Towards AI](https://pub.towardsai.net/one-agent-three-agents-or-a-workflow-what-the-evidence-says-works-better-1a16343a8171)
- **[Caveat on a popular stat]** The widely shared "41–86.7% failure rate" for multi-agent systems (Cemri et al., arXiv 2503.13657) has no single-agent baseline. **(S)** — [Towards AI](https://pub.towardsai.net/more-agents-smaller-gains-what-agensh-mast-and-the-google-study-say-about-your-orchestrator-411be9c77062)
- **[Security]** Auto mode checks delegation to a subagent (can deny) and its return (warns only); Anthropic's containment guidance says sub-agent output should not be trusted by default because it can carry injections upward. **(P)** — [Anthropic: Claude Code auto mode](https://www.anthropic.com/research/claude-code-auto-mode), [Anthropic: how we contain Claude](https://www.anthropic.com/research/how-we-contain-claude)
- **["AI employees" as products]** OpenAI announced "Dots," persistent always-on agents "with their own computers" (29 Sep 2026) **(S)**. Claude Code Projects run "a stream of related tasks as parallel cloud sessions that share repos, instructions, and memory" (public beta) **(P)**. Managed Agents add scheduled deployments and a multi-agent roster with advisors (beta) **(P)**. — [Axios](https://www.axios.com/2026/09/29/openai-dev-day-2026-dots-space-sol), [Claude Code docs index](https://code.claude.com/docs/llms.txt), [Claude Platform release notes](https://platform.claude.com/docs/en/release-notes/overview)
- **[Framework support]** Multi-agent is a standard feature in ADK (sequential, parallel, loop, routed), OpenAI Agents SDK (handoffs, agents-as-tools), Cloudflare Agents (sub-agents) and eve (subagents). **(P)** — [ADK-JS README](https://github.com/google/adk-js), [openai-agents-js README](https://github.com/openai/openai-agents-js), [Cloudflare Agents README](https://github.com/cloudflare/agents)

### Inferences

- **Decision rule drawn from the sources:**
  - **One agent** for anything sequential, stateful, or touching shared records.
  - **Subagents** (orchestrator–worker, results summarised back) to keep heavy reading out of the main context or to run independent look-ups in parallel.
  - **A scripted fan-out with a verifier** for wide, repetitive, checkable jobs (audit every route, re-score every lead, cross-check research).
  - **Peer "teams"** only for exploration and debate, and only while watching.
- **A pipeline of scheduled jobs — scrape, enrich, score, value, draft — is a deterministic workflow, not a multi-agent system, and the evidence says to keep it that way.** Each stage is sequential and writes shared records; that is exactly where multi-agent designs lose.
- **The useful multi-agent pattern for a small business is the cheap one: a second, independent pass that tries to refute the first** (a checker on a valuation's comparables, a reviewer on a draft's claims). It is parallel, checkable and bounded.
- **Error amplification is the reason to prefer a hub.** If the second-hand numbers hold (17.2× vs 4.4×), unsupervised peers are roughly four times worse than an orchestrated design at containing mistakes.
- **"AI employee" is mostly packaging.** What shipped is a persistent single agent with memory, a schedule, a sandbox and a chat channel. The autonomous-team version is still experimental at the vendor that documents it best.
- **Budget reality:** the headline demos cost $200 to $20,000 per outcome. Multi-agent is an occasional tool for a one-founder budget, not a default.

### Gaps

- **I could not read the primary papers** (Kim et al., Fu et al., Cemri et al.; `arxiv.org` unreachable). All independent-research numbers are via press and blog summaries and should be re-verified before being quoted as fact.
- The Anthropic multi-agent research post (Jun 2025) was not re-read this session; the 90.2% and 15× figures are from a search summary.
- No 2026 production post-mortem of a multi-agent system in a small business was found.
- Nothing was gathered on OpenAI's or Google's own multi-agent guidance in 2026.
- Whether "Dots" is available, its price, and what it can do are unverified.

---

## 8. Genuinely new tool categories from 2026 that a small company could adopt in a week

### Takeaway

Several categories either did not exist or were not usable a year ago: **first-party durable workflows on the hosting platform, cloud-scheduled coding agents, portable skills, policy-as-code tool approvals, scoped-credential brokers, and agent-run tracing**. The best one-week candidates for a small TypeScript-on-Vercel team are the ones that are GA and need no new vendor.

### Cited Findings

| # | Category (new or newly usable in 2026) | Concrete example | Status | Evidence |
|:--|:--|:--|:--|:--|
| 1 | **Durable workflow with pause-for-human, on the host platform** | Vercel Workflows: `'use workflow'`, hooks, `sleep` | GA (Apr 2026) | (S) [Vercel blog](https://vercel.com/blog/a-new-programming-model-for-durable-execution); (P) [Vercel docs](https://vercel.com/docs/workflows/concepts) |
| 2 | **Durable agent class** | AI SDK `WorkflowAgent` | GA (Jun 2026; v2 Aug 2026) | (P) [AI SDK docs](https://ai-sdk.dev/docs/agents/workflow-agent), [npm](https://registry.npmjs.org/@ai-sdk%2Fworkflow) |
| 3 | **Schedules that replace cron** (time zones, jitter, one-offs, queue targets) | Vercel Schedules | Beta | (P) [Vercel docs](https://vercel.com/docs/schedules/configuration) |
| 4 | **Cloud-scheduled coding agents** with schedule / API / GitHub triggers | Claude Code cloud scheduled tasks | Research preview (Apr 2026) | (P) [Claude Code docs](https://code.claude.com/docs/en/routines) |
| 5 | **Self-healing pull requests** | Claude Code auto-fix | GA | (P) [Claude Code docs](https://code.claude.com/docs/en/claude-code-on-the-web) |
| 6 | **Portable skills + a skills package manager** | `SKILL.md`; `npx skills add` | Open standard (Dec 2025; AAIF Oct 2026) | (P) [Anthropic](https://www.anthropic.com/news/donating-agent-skills-to-the-agentic-ai-foundation), [skills CLI](https://github.com/vercel-labs/skills) |
| 7 | **Libraries that ship docs for coding agents inside the package** | `node_modules/ai/docs`, `node_modules/eve/docs` | Shipped | (P) [eve README](https://github.com/vercel/eve) |
| 8 | **Tool-approval policy as code** | AI SDK `toolApproval`; `@ai-sdk/policy-opa` | GA | (P) [AI SDK docs](https://ai-sdk.dev/docs/agents/policy-tool-approvals) |
| 9 | **Classifier-gated autonomy** | Claude Code auto mode; Managed Agents `auto` policy | Shipped / Beta | (P) [Anthropic](https://www.anthropic.com/research/claude-code-auto-mode) |
| 10 | **Scoped, short-lived credential brokers for agents** | Vercel Connect; Managed Agents vaults; MCP Enterprise-Managed Authorization | New 2026; EMA stable | (P) [Vercel docs](https://vercel.com/docs/connect/concepts/tokens), [MCP blog](https://blog.modelcontextprotocol.io/posts/enterprise-managed-auth/) |
| 11 | **Per-key and per-user LLM spend budgets** | AI Gateway budgets; Managed Agents session budgets | GA / Beta | (P) [Vercel docs](https://vercel.com/docs/ai-gateway/observability-and-spend/budgets), [release notes](https://platform.claude.com/docs/en/release-notes/overview) |
| 12 | **Agent-run tracing as a platform feature** | Vercel Agent Runs (`vercel agent-runs trace`) | Shipped | (P) [Vercel docs](https://vercel.com/docs/cli/agent-runs) |
| 13 | **Interactive UI inside chat clients from your own server** | MCP Apps | GA extension (Jan 2026) | (P) [MCP blog](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) |
| 14 | **Server-to-agent push** (webhooks into an agent) | MCP Events; Claude Code channels | Beta / Experimental | (P) [MCP turns two](https://blog.modelcontextprotocol.io/posts/mcp-turns-two/) |
| 15 | **Hosted agent harness you rent** | Claude Managed Agents; OpenAI Agents API | Beta | (P) [Anthropic docs](https://platform.claude.com/docs/en/managed-agents/overview); (S) [OpenAI](https://developers.openai.com/api/docs/guides/agents) |
| 16 | **Filesystem-first agent framework** | eve | GA (15 Nov 2026) | (P) [npm](https://registry.npmjs.org/eve), [README](https://github.com/vercel/eve) |
| 17 | **Model-maintained wiki + offline "dreaming"** for memory | Anthropic memory research; Managed Agents dreaming | Research / preview | (P) [Anthropic](https://www.anthropic.com/research/components-of-agent-memory) |
| 18 | **Cheap executor + strong advisor in one call** | Anthropic advisor tool | Beta | (P) [Claude docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/advisor-tool) |
| 19 | **Decision models** (typed yes/no/choice answers; model routing) | AI SDK decision API; AI Gateway `/v1/decisions`; OpenAI Decisions API | Experimental / limited preview | (P) eve docs in [eve@1.5.0](https://registry.npmjs.org/eve), [Vercel docs](https://vercel.com/docs/ai-gateway/modalities/decision) |
| 20 | **One bot codebase for every chat surface** | Vercel Chat SDK (Slack, Teams, Google Chat, Discord, Telegram, GitHub, Linear, WhatsApp) with JSX approval cards | Shipped (v4 since Jan 2026) | (P) [Chat SDK README](https://github.com/vercel/chat) |
| 21 | **Email inboxes built for agents** | `agentmail` — "The email inbox API for AI agents" | Shipped, pre-1.0 (`0.5.54`, Nov 2026) | (P) [npm registry](https://registry.npmjs.org/agentmail) |
| 22 | **Agent sandboxes with snapshots and persistent drives** | Vercel Sandbox v4 | GA SDK (Nov 2026) | (P) [Vercel docs](https://vercel.com/docs/sandbox/sdk-reference) |
| 23 | **Script-driven fan-out to hundreds of subagents with cross-checking** | Claude Code dynamic workflows, `/deep-research` | Available on paid plans | (P) [Claude Code docs](https://code.claude.com/docs/en/workflows) |
| 24 | **Agent payments** | ACP, AP2, x402, card-network agent pay | Beta / pilots | (P) [ACP README](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol) |

- **[Vendor pitch, noted for balance]** Vercel publishes a ready-made coding-agent prompt to migrate apps *from* "OpenRouter, LiteLLM, Portkey, Cloudflare AI Gateway, Helicone" *to* its AI Gateway. This is marketing; it does show that gateway features (budgets, ZDR, fallbacks) are now a competitive front. **(P)** — [Vercel docs: migrate to AI Gateway](https://vercel.com/docs/ai-gateway/getting-started/migrate-to-ai-gateway)

### Inferences

- **Adoptable in about a week, low risk, no new vendor** (ranked by fit for a cron-driven, human-reviewed TypeScript app on Vercel):
  1. **Skills folder + repo instructions** (#6, #7). Hours, not days. Portable across coding agents.
  2. **Tool approvals in code** (#8). Encode "outward actions need a person" as a typed policy rather than convention.
  3. **One durable workflow** (#1, #2) for the single job that most needs to pause for a human or outrun the function limit.
  4. **A failure-driven eval file** run in CI (section 5). Not new, but newly well-specified.
  5. **Scheduled coding-agent chores** (#4) with connectors trimmed: doc-freshness checks, dependency bumps, nightly review.
  6. **Deterministic `tools/list` and CIMD readiness** on the MCP server (section 1).
- **Worth a spike, not a commitment:** eve (#16), Schedules (#3, beta), Agent Runs tracing (#12), advisor tool (#18), per-entity wiki memory (#17).
- **Watch only:** agent payments (#24), decision models (#19), MCP Events (#14), hosted harnesses (#15) unless a job truly needs a sandboxed computer.
- **Category that needs a decision rather than a build:** an agent-owned inbox (#21) is a different trust model from reading a company mailbox with a human gate. It is listed because it is new, not because it fits a business that has chosen not to auto-send.
- **A pattern across the list:** the new categories are mostly **controls** (approvals, budgets, scoped tokens, tracing, sandboxes), not new capabilities. 2026 was the year the tooling caught up with the risk.

### Gaps

- **This list is skewed towards Anthropic and Vercel** because those were the readable primary sources. Comparable 2026 categories from OpenAI, Google, Microsoft, AWS (for example Bedrock AgentCore) and start-ups are under-represented.
- "Adoptable in a week" is my judgement from documentation, not from a trial.
- `agentmail` is cited from its npm record only; its maturity, pricing and UK data handling are unknown.
- No pricing was verified for Vercel Schedules, Queues, Connect, Agent Runs or Sandbox.
- Browser-agent, voice-agent and document-AI tooling were out of scope here and are not covered.
- I found no source ranking new 2026 tools by real small-business adoption.
