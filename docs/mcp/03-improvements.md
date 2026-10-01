# Phase 3 — Improvements: making the tools fit to expose

_Written: 2026-10-01. Code is on branch `claude/bellwoods-chatgpt-mcp-app-nval4l`._

## What was approved

- **Public plugin:** compare ways to sell, inherited-home plan, renovation cost. Property facts is a support tool.
- **Pro plugin:** the agent and investor tools.
- **Founder OK:** tools may use the user's own numbers and tax rules.
- **Letting:** out.

---

## 1. Code changes, in plain words

| # | Change | Why | Where |
|:-:|:--|:--|:--|
| 1 | **New shared package `@repo/kept-tools`.** The tool logic, with no network code. | One set of rules for the website and the plugin. Easy to test. | `packages/kept-tools/` |
| 2 | **Keyhole report builder moved into it.** The Keyhole page re-exports it. | The plugin and Keyhole share one builder. Keyhole behaviour is unchanged. | `kept-tools/src/property-facts.ts`, `apps/web/lib/keyhole/report.ts` |
| 3 | **Every fact has a source.** gov.uk or the live site, with the date checked. | "Verify before asserting" (KEPT.md). | `kept-tools/src/sources.ts` |
| 4 | **P0 fixed: no figure before a person sends the offer.** | Every quote emailed the seller "Your binding cash offer · £X". | `apps/web/app/api/quote/route.ts`, `packages/deal-updates`, `apps/web/app/track/[token]/page.tsx`, `packages/quote-ops` |
| 5 | **New app `apps/plugin`.** Both plugins, separate from the other apps. | It uses the MCP SDK v2 and zod 4, which the other apps don't. A plugin problem can't take the site down. | `apps/plugin/` |
| 6 | **Small OAuth 2.1 server** for the Pro plugin. | ChatGPT needs OAuth for private tools. It reuses existing agent and investor accounts. | `apps/plugin/lib/oauth/` |

### The P0 fix in detail

- **Before:**
  - `/api/quote` recorded `offer_sent` and emailed the seller a £ figure on **every** submission, even ones flagged for review.
  - The track page showed the figure as well.
- **After:**
  - `/api/quote` records `quote_requested` and sends a plain acknowledgement, using the live-site promise wording.
  - Update emails show a figure **only** for `offer_sent` or `offer_accepted`.
  - The track page shows the offer **only** after the human "approve and send" step. A new shared marker, `SIGNED_OFFER_NOTIFIER`, tracks that step.
- **Not changed:** the `/api/quote` JSON still returns the quote. Only the agent quick form uses it. That agent-surface conflict is flagged in `02-ranking.md`.

---

## 2. Each tool does one job

### Public plugin (`/mcp`, no login)

| Tool | One job | Inputs | Output | Hints (read / destroy / open world) |
|:--|:--|:--|:--|:--|
| `compare_sale_routes` | Agent vs auction vs cash buyer, on **your** figures | Expected price (required). Agent fee, auction price and fees, a cash offer you hold, legal fees, monthly holding costs, inherited-home CGT details (all optional). | Per route: costs, money left, time, certainty, suits / wrong for, assumptions. No verdict. | ✅ / ✖ / ✖ |
| `plan_inherited_home` | A dated plan for an inherited home | Date of death, grant date (optional), home empty?, nation | Dated steps with status (past / due soon / upcoming / when you sell), empty-home checklist, sources | ✅ / ✖ / ✖ |
| `estimate_renovation_cost` | Light / full / heavy budget bands | Floor area, **or** address + postcode (reads EPC). Known issues. | Three bands, issue lines, notes | ✅ / ✖ / ✔ (EPC register) |
| `get_property_facts` | What's on public record | Address line + postcode | EPC facts, recorded sales in the postcode, Land Registry attribution. **Never a value.** | ✅ / ✖ / ✔ |

All four:
- render the same inline card;
- end with one handoff button to the live site (`/sell`, `/probate` or `/problem-property`, UTM-tagged);
- collect nothing inside ChatGPT.

### Pro plugin (`/pro/mcp`, sign-in required)

| Tool | Who | One job | Writes? |
|:--|:--|:--|:--|
| `refer_sale_to_kept` | Agents | Refer a sale. Creates a draft quote request plus an Action Centre card. The agent must confirm the vendor agreed. Never takes vendor contact details. Repeats within 24h are ignored. | Yes, reviewed by a person |
| `my_kept_referrals` | Agents | Status, latest update and timeline link for each referral. **No figures.** | No |
| `kept_released_deals` | Investors | Released deals: postcode, type, beds, Kept's resale price. **No address, no AVM value.** | No |
| `register_interest_in_deal` | Investors | Registers interest and subscribes the investor to updates. Creates a card. | Yes |

---

## 3. Tool names and descriptions

Descriptions are written from the **user phrases in `02-ranking.md`**. ChatGPT picks a tool by matching what the user typed. Each description:

1. Starts with **when to use it**.
2. Quotes **3–5 real phrases**.
3. Says **what it never does**: "never values the home", "never says which route to pick".
4. Tells the model **not to invent inputs**: "ask for a price; never guess a cash offer".

Example (`compare_sale_routes`):

> Use when someone in the UK asks whether to sell through an estate agent, at auction or to a cash buyer, or what they would actually be left with each way. Examples: "estate agent or cash buyer?", "we have a cash offer of £210k, the agent says £250k, what do we end up with?" … It never values the home and never says which route to pick.

---

## 4. Safety rails built in

| Rule | How it's enforced |
|:--|:--|
| No Kept figure | No tool calls the AVM or the offer engine. The cash row stays blank without the user's offer. Tested. |
| No PropertyData in public | Only EPC and Land Registry (open data). Investor feed drops the AVM value. Tested. |
| No personal data stored (public) | Public tools write nothing. Pro tools write only referral and interest rows. |
| No vendor emails | Pro writes go to the Action Centre. The only emails sent are the user's own sign-in code and an investor's own update subscription. |
| Revoke works at once | Identity is re-read on every Pro call and every token refresh. Tested. |
| Sign-in can't be guessed | 6-digit code, 10 minutes, 5 tries, single use. No "this email isn't registered" message. Tested. |
| Tokens can't be forged or replayed | HMAC-signed, purpose-bound, PKCE S256, codes and refresh tokens single-use. Tested. |
| Card can't leak data | Empty CSP (no network), text only (no HTML injection). |

---

## 5. Tests

| Suite | Tests | Covers |
|:--|:-:|:--|
| `@repo/kept-tools` | 26 | Maths, dates, tax, refurb bands, property facts (mocked registers) |
| `@repo/deal-updates` | 3 | The P0 email gate |
| `apps/plugin` | 27 | Both MCP endpoints end to end, the whole OAuth flow, every Pro tool |

Also checked:
- **Production build** of `apps/plugin` passes.
- **Live server smoke test** passes (tools/list, tools/call, 401 + discovery, CORS preflight).
- **Card rendered in Chromium**, light and dark. Each handoff button opens the right link. Screenshots are in `docs/mcp/screenshots/`.

---

## 6. Not done, and why

| Item | Why |
|:--|:--|
| Real ChatGPT test | Needs the app deployed to a public URL, and your ChatGPT account in developer mode. See `05-build-plan.md`. |
| Real EPC / Land Registry calls from here | The sandbox blocks the internet. Tested with mocks. The live EPC needs `EPC_API_TOKEN` on the plugin project. |
| Old `packages/mcp-server` | Left alone. It still crashes and exposes lead PII. Recommend deleting it in a separate PR. |
| Agent quick form still shows a figure | Existing agent surface, flagged in `02-ranking.md`. Your call. |
