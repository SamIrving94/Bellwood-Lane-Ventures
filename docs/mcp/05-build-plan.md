# Phase 5 — Build plan

_Written: 2026-10-01. ✅ = built and tested on this branch. 👤 = needs you (an account, a click, a secret)._

Platform facts come from `00-platform-notes.md`. The OpenAI docs site is blocked from the build sandbox, so re-check the 👤 steps against developers.openai.com/plugins when you do them.

---

## Step by step

### 1. MCP server setup ✅

- New Next.js app `apps/plugin` (port 3006).
- `mcp-handler` 2.2 and MCP SDK v2. Serves the 2026-07-28 spec and 2025-era clients from one handler.
- zod 4 lives in this app only. The other apps stay on zod 3.
- Two endpoints:
  - `/mcp`: public, no login.
  - `/pro/mcp`: agents and investors, OAuth.

### 2. Tools ✅

- Logic in `@repo/kept-tools`.
- Thin MCP wrappers in `apps/plugin/lib/public-tools.ts` and `pro-tools.ts`.
- Every tool sets `readOnlyHint`, `destructiveHint` and `openWorldHint` explicitly.
- Details are in `03-improvements.md`.

### 3. Widget UI ✅

- One MCP Apps card, `ui://kept/card-v1.html`, type `text/html;profile=mcp-app`.
- Works with the standard `ui/*` bridge and with ChatGPT's `window.openai`.
- Empty CSP: it makes no network calls.
- Light and dark mode. Rendered and clicked in Chromium.

### 4. Auth ✅ (Pro only)

- OAuth 2.1 with PKCE, CIMD and DCR, and a 6-digit emailed code.
- No new tables. Uses existing agent accounts and investor links.
- The public plugin needs no auth.

### 5. Hosting on Vercel 👤

Create a **4th Vercel project**, `kept-plugin`:

1. Import the repo and set the root directory to `apps/plugin`.
2. Use the same build settings as the other apps (pnpm, Node 20+).
3. Add a domain, e.g. `chatgpt.wearekept.co.uk`.
4. Set these env vars:

| Var | Needed for | Value |
|:--|:--|:--|
| `PLUGIN_PUBLIC_URL` | Pro | `https://chatgpt.wearekept.co.uk` |
| `PLUGIN_AUTH_SECRET` | Pro | 48+ random characters, this project only |
| `DATABASE_URL` | Pro | Same Neon URL as the other projects |
| `RESEND_TOKEN`, `RESEND_FROM` | Pro sign-in codes | Same as the other projects |
| `EPC_API_TOKEN` | Public (EPC lookups) | Same as web |
| `PLUGIN_WIDGET_DOMAIN` | Submission | The unique widget domain OpenAI asks for |
| `KEPT_WEB_URL` | Optional | Defaults to `https://wearekept.co.uk` |
| `PLUGIN_CIMD_HOSTS` | Optional | Only if ChatGPT's client-metadata host isn't on the default list |

- **Before go-live:** deploy this branch's **P0 fix to the website** first. The handoff points at those forms.

### 6. Testing in ChatGPT developer mode 👤

1. ChatGPT, then **Settings → Security and login → Developer mode** (Plus/Pro/Business, on web).
2. **Plugins → + →** paste `https://<domain>/mcp`. Name it "Kept".
3. Do the same for `https://<domain>/pro/mcp` ("Kept Pro"). ChatGPT will run the sign-in.
4. In a chat: **+ → Developer mode →** pick the plugin.
5. Run the **30 prompts** below. Note which tool fired, or none.
6. After changing tools: **Refresh** on the plugin page.
7. **Ship-dark gate:** one real executor and one real agent use it with you watching. Read the transcripts.

### 7. Submission to OpenAI 👤

Redesigned at DevDay (29 Sep 2026); details are from search summaries, so check the live page.

1. **Verify the organisation** in the OpenAI Platform dashboard. Use the name you'll publish under: "Bellwoods Lane Ventures Ltd, trading as Kept".
2. **Privacy policy:** update `/legal/privacy`.
   - Add a plugin section: what the tools receive, that public tools store nothing, what Pro stores.
   - **Add the missing ICO number.** The page is still marked DRAFT.
3. **Package the plugin** with the **Plugin Creator** (inside ChatGPT) or by uploading the package. Include the name, short description, icon, MCP URL and auth setting.
4. **Scan tools** in the dashboard. It imports names, descriptions, schemas, annotations and `_meta`. **Justify each annotation:**
   - Public tools are read-only. Two of them read public registers, hence open-world.
   - The Pro write tools create records a person reviews.
5. **Test prompts:** give the positive ones from the list below, plus **at least 3 negatives** (#26–30).
6. **Video walkthrough:** record one anyway. It was required before DevDay; unverified whether it still is.
7. **Pro plugin reviewers need a login.**
   - Create a test agent account and a test investor link on a mailbox the reviewers can read.
   - Or keep **Pro private** (developer mode or workspace) and submit **only the public plugin** first. ← **My recommendation.**
8. Track it under **Review status** on the Plugins page. Feedback arrives by email.
9. After launch, changes to tool metadata go through **continuous review** once the automated checks pass.

### 8. Order of release

1. Merge. The website P0 fix goes live first.
2. Deploy `kept-plugin`. Run the developer-mode tests.
3. Ship-dark gate: 1 executor + 1 agent.
4. Submit the **public** plugin.
5. Give the **Pro** plugin to friendly agents through developer mode. Decide on a directory listing later.

---

## Extensions (sidebar / panels / settings): not in v1

- **Decision: inline card only.**
- **Why not:**
  - Every tool is a one-shot answer. Nothing needs to stay open.
  - Extensions aren't on Free or Go yet, and executors are likely on Free.
  - More surface means more review.
- **When to revisit:**
  - **Pro plugin, v2:** a **sidebar app** listing an agent's live referrals could earn its place, because agents come back repeatedly.
  - Only build it if agents actually use `my_kept_referrals`.

---

## 30 test prompts

Expected tool per prompt. "—" means the plugin should **not** fire.

### Public plugin

| # | Prompt | Expected |
|--:|:--|:--|
| 1 | My mum died in June and left me her house. What do we need to do? | `plan_inherited_home` |
| 2 | We're waiting for probate. What about dad's empty house? | `plan_inherited_home` |
| 3 | Can we sell my nan's house before probate is granted? | `plan_inherited_home` |
| 4 | Do we pay council tax on an empty house during probate? | `plan_inherited_home` |
| 5 | When is inheritance tax due? Dad died on 3 March. | `plan_inherited_home` |
| 6 | Give me a timeline for sorting out my late father's house | `plan_inherited_home` |
| 7 | Should I sell through an estate agent or a cash buyer? | `compare_sale_routes` |
| 8 | Cash offer £210k, agent says £250k. What do we actually end up with? | `compare_sale_routes` |
| 9 | Is auction a good idea for my dad's house? It needs work. | `compare_sale_routes` |
| 10 | Agent wants 1.5% plus VAT. How does that compare to selling for cash? | `compare_sale_routes` |
| 11 | We inherited a house worth £230k at probate and might sell for £260k. How much tax? | `compare_sale_routes` (CGT) |
| 12 | How much to renovate a 3 bed semi untouched since the 80s? | `estimate_renovation_cost` |
| 13 | Should we do up mum's house before selling, or sell as it is? | `estimate_renovation_cost` |
| 14 | The EPC is F. How much work does it need? 14 Elm Road M14 5AB | `estimate_renovation_cost` |
| 15 | Rough cost of a full refurb on an 85 square metre bungalow with damp | `estimate_renovation_cost` |
| 16 | What's the EPC rating for 14 Elm Road, M14 5AB? | `get_property_facts` |
| 17 | When did 22 Victoria Street, LS6 1AA last sell? | `get_property_facts` |
| 18 | What's on public record about my mum's house? | `get_property_facts` (asks for the address) |
| 19 | What have houses sold for on this street? | `get_property_facts` |
| 20 | We're executors and the beneficiaries disagree about selling. Lay out the options with numbers. | `compare_sale_routes` |

### Pro plugin (signed in)

| # | Prompt | Expected |
|--:|:--|:--|
| 21 | My buyer's mortgage fell through on 12 Oak Road, M20 2AB. Can Kept look at it? | `refer_sale_to_kept` (after a consent check) |
| 22 | Where are my Kept referrals up to? | `my_kept_referrals` |
| 23 | Has the offer for 12 Oak Road been sent? | `my_kept_referrals` |
| 24 | Any new Kept deals in Manchester under £200k? | `kept_released_deals` |
| 25 | Register my interest in that Salford one | `register_interest_in_deal` |

### Negatives: must NOT fire, or must refuse to value

| # | Prompt | Expected |
|--:|:--|:--|
| 26 | How much is my house worth? | — or a tool that **explicitly refuses to value** |
| 27 | Should I rent out my inherited house? | — (letting is out of scope) |
| 28 | Find me a 2 bed flat to buy in Leeds | — |
| 29 | What's the stamp duty on a £350k house? | — |
| 30 | My house in Ohio has a cracked foundation, what do I do? | — (UK only) |

**Pass mark:** 18 of 20 public prompts fire correctly, all 5 Pro prompts fire correctly, and **0 of 5 negatives** produce a value or a wrong tool.
