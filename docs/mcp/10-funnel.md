# 10. The funnel: from a question in ChatGPT or Claude to a Kept enquiry

_Written: 2026-11-28. Follows `09-claude-directory.md`._
_Last verified against the live site: 2026-11-28._ (Read from the site's source in `apps/web` on master. The live pages could not be fetched from Claude's sandbox that day.)

## The short answer

- **Built for every Kept situation**, not just probate: inherited home, sale fell through, separation, moving away, care or health, problem property.
- **Value first.** A free answer on the seller's own figures: which ways to sell can finish by their date, what they keep after fees and the mortgage, and a checklist for this week. No sign-up.
- **Honest exits.** Each answer says when an estate agent will get more, in that situation page's own words. If the debt is bigger than the home, it stops and points to free debt advice.
- **The ask happens in the chat.** A seller can ask Kept to get in touch without leaving ChatGPT or Claude. It becomes a draft enquiry and an Action Centre card. Nothing is sent to the seller automatically.
- **Counted.** Every use and every enquiry is tagged **ChatGPT** or **Claude**.
- **Still not live.** None of this reaches anyone until the Vercel project exists and the listings are in.

---

## ChatGPT: what changed, and what it means for us

> OpenAI's docs are blocked from Claude's sandbox. These come from search summaries of OpenAI's pages (details and links in `00-platform-notes.md`). Check the submission form itself when you get there.

| What | What we found | What it means for Kept |
|:--|:--|:--|
| **Adding a plugin** | The Developer mode switch is gone. Settings → Plugins → **+** → Add custom MCP server. | Go-live steps updated. |
| **Who can add an unlisted plugin** | Full read-and-write MCP: Business, Enterprise, Edu. Pro may be read-only. Plus: unclear. Personal accounts have no share button. | Unlisted, almost no sellers can use it. **The directory is the only real route to sellers.** |
| **Write tools** | ChatGPT asks the user to confirm before a write tool runs. Some plans may only get read-only tools. | The "ask Kept to get in touch" tool may not show for everyone. So every answer also links to the right Kept page. Nobody is stuck. |
| **Being found** | Only directory plugins can be searched for or **recommended in conversation** (since 9 Jul; better ranking since DevDay, 29 Sep). Ranking is by usefulness and satisfaction. | Submit now. A useful answer is the ranking strategy. |
| **Review time** | About a month. After approval **you** press Publish. | Start this week, so it lands in January. |
| **What submission needs** | A verified organisation, a domain token at `/.well-known/openai-apps-challenge`, a privacy policy, screenshots, test prompts, tool annotations. | Domain-token route built. Screenshots, prompts and annotations ready (below). Org verification is yours. |
| **UK** | Very likely available (Rightmove and Zoopla have ChatGPT apps). One source says otherwise. | Your first test from a UK account settles it. |

## ChatGPT or Claude: where to put the effort

| | Claude | ChatGPT |
|:--|:--|:--|
| **Time to listed** | Fast: self-serve, an automated scan, then a Community listing | About a month of review |
| **How sellers find it** | Every directory connector can be **suggested in chat** when it fits | Directory search, and in-conversation recommendations after approval |
| **Size** | Smaller | Far bigger |
| **Login needed** | None | None |
| **The ask tool** | Allowed, marked as a write tool | Needs the user's confirmation; may be missing on some plans |
| **Do what** | **List first, this week** | **Submit the same week**, then wait |

**Verdict: do both.** Claude gives us the first reading within weeks. ChatGPT is the bigger prize, and slower.

---

## The funnel

1. **Found.** A seller asks a question in their own words. The assistant suggests Kept, because it is listed and fits.
2. **Value.** A free answer on their own figures: a plan, the money, the dates, a checklist.
3. **Honest exit.** When an agent will get more, it says so. When the debt is bigger than the home, it stops (StepChange, Citizens Advice).
4. **Ask.** "Ask Kept for a written offer": the in-chat request, or a link to the right situation page.
5. **A person.** A draft enquiry and an Action Centre card. A person replies within 24 hours, Monday to Friday, views the home first, and sends a written offer within two working days of the viewing.
6. **Counted.** Every step is tagged ChatGPT or Claude.

## Every Kept situation

| Situation | How they ask | Tool | What they get | When it says "not us" | Next step |
|:--|:--|:--|:--|:--|:--|
| **Inherited home** | "Mum died in June and left me her house. What now?" | `plan_inherited_home` | Dated plan from the date of death and the grant; empty-home checklist | No time pressure, good condition, beneficiaries want every pound | `/probate` |
| **Sale fell through** | "Our buyer pulled out and we complete in six weeks." | `plan_my_sale` | Which ways can finish by the date; money after fees and the mortgage; this week's checklist | Onward purchase safe and can wait; sale still progressing normally | `/chain-break` |
| **Separation** | "We sell for £300k with £180k on the mortgage. What's my share?" | `plan_my_sale` | After fees, after the mortgage, your share | Both want every pound and can wait; an active legal dispute goes to a solicitor first | `/separation` |
| **Moving away** | "I move abroad in March and need the flat sold." | `plan_my_sale` | Dates against the move; empty-home insurance; signing from abroad | Excellent condition, high demand, the move can absorb chain risk | `/relocation` |
| **Problem property** | "Short lease, and it needs work. What are my options?" | `plan_my_sale`, `estimate_renovation_cost` | Will lenders lend; fix or sell as it is; budget bands | The issue is cosmetic and they have the money and the time | `/problem-property` |
| **Care or health** | "Dad is moving into care. How do we sell his house?" | `plan_my_sale` | Authority to sell (power of attorney); how care funding counts the home; discretion | They can wait and the house is in good shape | `/your-situation` |
| **Debt bigger than the home** | "We owe more than it's worth." | `plan_my_sale` (mortgage above price) | A stop: free debt advice first | Always | StepChange. **No Kept link is shown.** |
| **Any** | "Agent, auction or cash buyer?" | `compare_sale_routes` | Money and time for each route, on their figures | Per situation | The situation page |
| **Any** | "What did homes nearby sell for?" | `get_property_facts` | Public records. Not a valuation | | `/sell` |

## Why it gives value, not just a lead form

- **Their figures, never ours.** It never values the home and never shows an offer (founder rule).
- **Sourced.** Every fact links to its source (`packages/kept-tools/src/sources.ts`).
- **Says who we're wrong for, unprompted.** The Beth Sims bar (`docs/brand/KEPT.md`).
- **One ask, only when asked.** Five read-only tools, and one tool the user calls to ask Kept to get in touch, with their agreement.
- **Fits both directories' rules.** No promotion in tool text. No instructions to the model. Only the data the ask needs. A person reviews every offer.

---

## What's built (PR #174)

**`@repo/kept-tools`**
- `situations.ts`: the six situations, each page's path and its honest line (from `apps/web/lib/situation-content.ts`), and the debt stop.
- `sale-plan.ts` (`planSale`): dates against a deadline, money after fees and the mortgage, your share, a checklist, the honest line, who Kept is wrong for, and sources. 7 tests.

**`apps/plugin`**
- **`plan_my_sale`** (new, read-only, shows a card).
- **`ask_kept_to_call`** (new, the one write tool):
  - Needs the user's agreement (`consent: true`).
  - Saves a **draft** quote (`source: plugin_public`) and its source (`ai_assistant`, ChatGPT or Claude).
  - Adds an Action Centre card: "Seller asked via Claude to be contacted: M20 2AB".
  - Same email and postcode within a day: recorded once.
  - Ceilings: 10 an hour, 30 a day. Past them, the seller gets the site's form.
  - No database: the seller gets the site's form.
  - Never emails the seller. Never logs what was typed.
- **`compare_sale_routes`** takes a situation. Every next step goes to the right situation page, with that page's honest line.
- **Tagged by assistant:** links carry `utm_source=chatgpt` or `claude`; usage logs carry `host`.
- **Tool text** rewritten as plain statements. "Do not recommend selling or a buyer" is gone.
- **Directory basics:** server title, website and icon; a documentation page at the plugin's home address; the OpenAI domain-token route.
- **Tests:** 45 plugin, 35 kept-tools.

**Website:** privacy notice **v1.7** covers Kept in ChatGPT and Claude.

---

## Listing pack (paste into both forms)

**Name:** Kept

**Short description:** Plan the sale of a UK home that is hard to sell or on a deadline.

**Long description:**

> Kept helps people in the UK who need to sell a home that is hard to sell or on a deadline: an inherited home, a sale that fell through, a separation, a move away, a move into care, or a property with a problem.
>
> - Check which ways of selling can finish by your date.
> - See what you would be left with after fees and the mortgage, and your share.
> - Get a dated plan for an inherited home, from the date of death and the grant of probate.
> - Estimate renovation budgets from the floor area.
> - Look up a home's energy certificate and recorded sale prices nearby.
>
> It never values your home or shows an offer: any price comes from you. It says when an estate agent is likely to get you more. General information, not legal, tax or financial advice.
>
> Kept is a cash buyer. If you want Kept to look at your home, you can ask it to get in touch from the chat.

**Example prompts:**
1. Our buyer pulled out and we complete on our new house in six weeks. What can we do?
2. My mum died in June and left me her house. What do we need to do, and when?
3. We're separating. If we sell for £300,000 with £180,000 left on the mortgage, what is my share?
4. Estate agent, auction or cash buyer? The agent says £250,000.
5. How much would it cost to renovate an 85 square metre house with damp?

**Screenshots** (1200 px wide, in `docs/mcp/screenshots/listing/`):
1. `01-sale-plan.png`: sale fell through, six weeks to go
2. `02-sale-routes.png`: agent, auction or cash buyer
3. `03-inherited-plan.png`: inherited home, dated plan
4. `04-renovation.png`: renovation bands
5. `05-separation.png`: separation, your share

**Addresses:**
- MCP server: `https://<plugin domain>/mcp` (no sign-in)
- Documentation: `https://<plugin domain>/`
- Privacy policy: https://wearekept.co.uk/legal/privacy
- Support: sam@wearekept.co.uk
- Website: https://wearekept.co.uk
- Icon: https://wearekept.co.uk/apple-icon.png (180 × 180). If a form wants bigger, export the monogram at 512 × 512.

**Tools and their labels:**

| Tool | Read-only | Destructive | Reaches outside |
|:--|:--|:--|:--|
| `plan_my_sale` | Yes | No | No |
| `compare_sale_routes` | Yes | No | No |
| `plan_inherited_home` | Yes | No | No |
| `estimate_renovation_cost` | Yes | No | Yes (EPC register) |
| `get_property_facts` | Yes | No | Yes (EPC, Land Registry) |
| `ask_kept_to_call` | **No** | No | Yes (sends Kept the details) |

**Test cases for reviewers** (OpenAI asks for these):

| Prompt | Expected |
|:--|:--|
| Prompt 1 above | A table: cash buyer makes the date; agent and auction miss it |
| Prompt 3 above | After fees, after the mortgage, a 50% share |
| "How much is my house worth?" | No value given. That is correct |
| "We owe £200,000 and the house would sell for £150,000." | A stop, pointing to StepChange. No Kept link |
| "Yes, ask Kept to call me." (with test details) | A reference number. Tell reviewers to use the name "Test Reviewer"; dismiss those cards |

---

## What you need to do, in order

1. **Merge PR #174.**
2. **Create the Vercel project** `kept-plugin` (`06-go-live.md`, step 1). Add `EPC_API_TOKEN`, and now also **`DATABASE_URL`** (copy from bellwood-api). Without it, "ask Kept to get in touch" sends sellers to the website form instead.
3. **Finish the privacy page:**
   - add the **ICO number** (it is still marked DRAFT);
   - fix the AI line: it names **Anthropic**, but the code has used **OpenRouter** since 3 Oct. Confirm which models handle enquiry summaries, then reword.
4. **Test it yourself** in Claude and ChatGPT as a custom connector (`06-go-live.md`, steps 2 and 3).
5. **Claude:** on a paid plan, go to **claude.ai/directory/manage** and submit with the listing pack.
6. **ChatGPT:**
   - verify the organisation (**Bellwoods Lane Ventures Ltd**) on the OpenAI platform;
   - start the plugin submission. It gives you a **domain token**;
   - add it on kept-plugin as **`OPENAI_APPS_CHALLENGE`**, then redeploy;
   - finish the submission. When it's approved, **press Publish**.
7. **Watch** (see below).

## How we'll know it works

**Where to look:**
- **Vercel → kept-plugin → Logs**, search `kept_plugin_tool`. Each line has the tool, `host` (chatgpt or claude), the outcome and the time.
- **Action Centre:** cards titled "Seller asked via ChatGPT…" or "…via Claude…".
- **Dashboard → "Where enquiries came from":** the AI assistant row.
- **PostHog:** visits with `utm_source=chatgpt` or `claude`, and the forms they send.

**One check after your first test:** the assistant is read from the request's User-Agent header. We haven't seen real ChatGPT or Claude traffic yet. If the logs say `host: "other"` after a test from ChatGPT or Claude, tell Claude: it's a one-line fix in `apps/plugin/lib/host.ts`.

**The baseline:** AI assistants send us **nothing** today. The whole site gets **0 to 3 enquiries a week**. So **one enquiry a month** from AI is a real gain.

**Kill criteria** (per assistant, from its listing date):
- After **6 weeks**: fewer than **10 tool uses a week**, or **no enquiry** → stop investing in it.

## The case against

- **Strongest case against: volume.** These are one-off life events, not daily habits. The assistants may never suggest a small UK property tool. Expect tens of uses a month, not thousands.
- **The assumption that kills it:** that ChatGPT and Claude surface Kept when someone says "our buyer pulled out".
  - **Test it cheaply:** after listing, ask each assistant 10 natural questions from a fresh account.
- **Who hates it:**
  - **A stressed seller who feels sold to.** Answer: value first, honest exits, and the ask only when they ask.
  - **Directory reviewers, if it reads like lead generation.** Answer: five useful read-only tools, one user-asked write tool, factual descriptions.
- **New risks this adds:**
  - **Junk enquiries.** Agreement required, one per email and postcode a day, 10 an hour, 30 a day. No email goes to anyone.
  - **Personal data through the plugin.** Covered by privacy notice v1.7. Logs never store what was typed.

---

## Also found (not fixed here)

- **Stale figure on the live site.** `/why-we-wont-buy-any-home` says "IHT clock at 8.75% interest". HMRC's late-payment interest is the Bank Rate plus 4%; search results say **8.00% from 24 Nov 2026**. Check HMRC's rates page, then fix or drop the number.
- **Privacy notice names Anthropic** as the AI processor (step 3 above).
- **"Indicative offer"** in the privacy notice: fixed in v1.7 ("ask us for an offer").
- **No "What's new" entry yet.** Add one when the plugin goes live, not before.
- **Plugin enquiries skip the quote-ops automation**, which only picks up `agent_quick_form`. That's intended: a person makes the call.

## Sources

- `00-platform-notes.md`: ChatGPT facts, marked [snippet] where they come from search summaries.
- `09-claude-directory.md`: Claude's directory, review criteria and policy.
- The site's own copy, read 28 Nov 2026: `apps/web/lib/situation-content.ts` (each situation page) and `/why-we-wont-buy-any-home`.
- Kept PostHog project, queries run 28 Nov 2026.
