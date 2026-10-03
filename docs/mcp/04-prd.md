# Phase 4 — PRD: Kept for ChatGPT

_Written: 2026-10-01. The brief called this "Sell or let?". Letting is out (founder, 1 Oct), so the product is now **selling an inherited or hard-to-sell home**, plus a Pro plugin for partner agents and investors._

---

## 1. Problem

- People who inherit a home have to make big money decisions in their worst weeks.
- They ask ChatGPT in private: "Mum left me the house. What now?"
- Today they get general answers, with no dates for their own case and no maths on their own numbers.
- The cash-buyer tools that do exist are funnels. They push one answer.
- Executors carry **personal liability** for selling below the best price they could reasonably get (devastavit). A tool that nudges them toward a cash buyer is exactly what they must avoid.

## 2. Target users

| User | Need | Plugin |
|:--|:--|:--|
| **Executors and beneficiaries** (primary) | What to do when, and what each sale route leaves them | Public |
| **Owners of hard-to-sell homes** (problem property, needs work) | What the work costs, and whether to sell as it is | Public |
| **Partner estate agents** | Rescue a fall-through fast; see where it's up to | Pro |
| **Syndicate investors** | See released deals; register interest | Pro |

**Who it's wrong for (said in the tool):** anyone who can wait for the open market. An agent will usually get them more.

---

## 3. What gives Kept an edge

**Honest answer:** anyone can build an MCP server. The edge isn't the tech. It's these:

1. **Honesty is built in, and ChatGPT now rewards it.**
   - The tools show no Kept figure, give no verdict, and say "an agent will usually get you more".
   - Competitors' tools exist to capture leads, so they can't copy this without breaking their own funnel.
   - Since DevDay, ChatGPT ranks plugins by usefulness and satisfaction. A funnel gets demoted. An honest tool gets suggested.
2. **Executor-specific, dated, sourced.**
   - It gives a plan built on **their** dates: IHT due, council tax exemption and premium, the insurance cliff, CGT 60 days.
   - Every rule links to gov.uk.
   - Portals and generic chat don't do this. It's Kept's #1 segment, and it matches Keyhole's "evidence for the decision file" framing.
3. **A real person and a written offer behind the button.**
   - The handoff is credible: we view first, then send a written offer within two working days of the viewing, binding upon Kept for a week.
   - Most cash buyers lead with a number. We lead with a visit.
4. **The agent channel, inside ChatGPT.**
   - An agent can refer a fall-through in one sentence and track it.
   - I have not checked whether any competitor offers this. Check before saying it in public.
   - Agents are **repeat users**, so the one-click install hurts less. This is Bet 1 (own the fall-through moment).
5. **Open data, done properly.**
   - EPC plus Land Registry, licence-clean, and "no record found" when there isn't one. Never invented.

**Not an edge:**
- **Data volume:** the portals have more.
- **Our AVM:** we can't show it, and it has no backtest yet.
- **Being first:** others will follow.

The moat is **trust plus agent relationships**, so speed matters. DevDay has just reset discovery.

---

## 4. User journey inside ChatGPT

### Executor (public plugin)

1. Asks: "My mum died in June and left me her house. We're waiting for probate. What do we need to do?"
2. ChatGPT suggests **Kept** with a one-click Connect, or the user @mentions it. No account is needed.
3. ChatGPT asks for the date of death and whether the house is empty.
4. `plan_inherited_home` returns **the card**: a dated plan and the empty-home checklist.
5. Later: "Agent says £250k, we've had a cash offer of £210k. What would we actually get?"
6. `compare_sale_routes` returns **the card**: the three routes on their figures, with costs, time, certainty and who each route is wrong for.
7. Maybe: "Should we do it up first?" `estimate_renovation_cost` gives budget bands, reading the EPC floor area.
8. **Handoff:** "Ask Kept for a written offer" opens `/probate` on our site. They fill in our existing form, with our consent wording.

### Partner agent (Pro plugin)

1. Connects once: email, then a 6-digit code.
2. "Buyer's mortgage fell through on 12 Oak Road, M20. Can Kept look?"
3. ChatGPT confirms the vendor is happy to share, then calls `refer_sale_to_kept`.
4. A card appears in **your Action Centre**. Reply the same working day.
5. Later: "Where are my Kept referrals up to?" calls `my_kept_referrals`.

### Investor (Pro plugin)

1. Connects once with the email on their investor link.
2. "Any new Kept deals in Manchester under £200k?" calls `kept_released_deals`.
3. "Register my interest in that one" calls `register_interest_in_deal`. You get a card.

---

## 5. Tools and the card

| Tool | Card shows |
|:--|:--|
| `compare_sale_routes` | Three columns: money left (big), each cost line, time, certainty, suits / wrong for, assumptions |
| `plan_inherited_home` | Dated timeline with status chips, then the empty-home checklist |
| `estimate_renovation_cost` | Three budget bands, the EPC rating and age if found, issue lines |
| `get_property_facts` | EPC facts, the postcode's recorded sales table (this home in bold), "not a valuation" |

Every card ends with:
- the honest handoff box and button;
- notes;
- source links (gov.uk, the live site, OGL attribution).

Screenshots are in `docs/mcp/screenshots/`. The Pro tools return text only; no card is needed.

---

## 6. Handoff: how someone becomes a Kept lead

| Path | How | Where it lands |
|:--|:--|:--|
| Public user | Button opens the live page with `utm_source=chatgpt&utm_medium=plugin&utm_campaign=<tool>` | Existing form, then `QuoteRequest`, then your review. **No figure** (P0 fixed). |
| Partner agent | `refer_sale_to_kept` | `QuoteRequest` (`source: plugin_agent`) + Action Centre card |
| Investor | `register_interest_in_deal` | `InvestorInterest` + Action Centre card |

- **No booking link and no account creation** in v1.
- The site form is the consent point for sellers.

---

## 7. Success metrics

Ship-dark gate first: **one real executor and one real agent** use it, and we read the transcripts with them.

| Metric | Target (first 90 days after directory listing) | Source |
|:--|:--|:--|
| Plugin-sourced site visits | Measured; no target until the baseline | UTM in site analytics |
| Plugin-sourced quote requests | **5** | `QuoteRequest` arriving after a `utm_source=chatgpt` visit |
| Agent referrals via Pro | **3 agents, 5 referrals** | `QuoteRequest.source = plugin_agent` |
| Completed deal from either | **1** | Pipeline |
| Wrong-answer reports | **0** tax or date errors | Founder review of reported issues |
| Kill gate | Fewer than 2 quote requests **and** 0 agent referrals after 90 days: stop investing, keep it running | Founders |

---

## 8. Risks

| Risk | What could go wrong | Mitigation |
|:--|:--|:--|
| **Data accuracy: tax** | A wrong rate or date in a family's plan | Every rule sourced to gov.uk with a check date. Estimate wording. Tests pin the maths. Re-check each 6 April. |
| **Data accuracy: refurb** | Bands are rule-of-thumb | Labelled "budget bands, not quotes". Same tables as the internal model. |
| **Data accuracy: open data** | EPC missing or stale | "No record found" shown honestly. Never synthetic. |
| **UK regulation: advice** | Reads as financial or legal advice (we're not FCA authorised) | No verdicts. "General information, not legal or tax advice." Never the word "advice" for what we give. |
| **UK regulation: executor duty** | Seen as nudging executors to undersell | Neutral comparator. Says an agent usually gets more. User's own figures only. |
| **UK regulation: compliance opinion** | The SRA/RICS/FCA opinion isn't commissioned yet | No legal claims (devastavit, best price) in tool copy until it is. |
| **Privacy** | Personal data inside ChatGPT | Public tools store nothing. Pro collects no vendor contact details. Sign-in emails only to known accounts. **The privacy page needs a plugin section and the ICO number** (page is marked DRAFT). |
| **OpenAI review** | Rejected as lead-gen or for missing items | Standalone value without the handoff. One button only. Explicit annotations. Unique widget domain. Test prompts. |
| **UK availability** | Third-party plugins not available to UK users | **Unverified.** Check before spending on promotion. |
| **Discovery** | ChatGPT never suggests us | Can't be bought. The site pages still work. Agents can @mention the Pro plugin. |
| **Security** | Hand-built OAuth server | Small, tested end to end (PKCE, single use, lockout, forgery). Recommend an outside review before the Pro listing. |

---

## 9. Out of scope (v1)

- Letting, rent or yield. Founder decision.
- Any valuation or offer figure.
- PropertyData anywhere in the plugin.
- Collecting seller details or booking viewings inside ChatGPT.
- Extensions (sidebar, panels, settings). See `05-build-plan.md`.
- MCP Events and automations.
- Scotland and Northern Ireland council tax rules. The tool says they differ.
- The old `packages/mcp-server` (founder ops). Separate track.
