# 10. The funnel: from a question in ChatGPT or Claude to a Kept enquiry

_Written: 2026-11-28. Follows `09-claude-directory.md`. Updated the same day: **link only** (founder decision, #177)._
_Last verified against the live site: 2026-11-28._ (Read from the site's source in `apps/web` on master. The live pages could not be fetched from Claude's sandbox that day.)

## The short answer

- **Built for every Kept situation**, not just probate: inherited home, sale fell through, separation, moving away, care or health, problem property.
- **Value first.** A free answer on the seller's own figures: which ways to sell can finish by their date, what they keep after fees and the mortgage, and a checklist for this week. No sign-up.
- **Honest exits.** Each answer says when an estate agent will get more, in that situation page's own words. If the debt is bigger than the home, it stops and points to free debt advice.
- **The ask is a link** (founder decision, 28 Nov, #177). When a seller wants Kept, the assistant gives them the right Kept page, and they fill in the form themselves. The plugin never takes their details.
- **Counted.** Every use, and every visit from a link, is tagged with the assistant (**ChatGPT** or **Claude**).
- **Still not live.** None of this reaches anyone until the Vercel project exists and the listings are in.

---

## ChatGPT: what changed, and what it means for us

> OpenAI's docs are blocked from Claude's sandbox. These come from search summaries of OpenAI's pages (details and links in `00-platform-notes.md`). Check the submission form itself when you get there.

| What | What we found | What it means for Kept |
|:--|:--|:--|
| **Adding a plugin** | The Developer mode switch is gone. Settings → Plugins → **+** → Add custom MCP server. | Go-live steps updated. |
| **Who can add an unlisted plugin** | Full read-and-write MCP: Business, Enterprise, Edu. Pro may be read-only. Plus: unclear. Personal accounts have no share button. | Unlisted, almost no sellers can use it. **The directory is the only real route to sellers.** |
| **Write tools** | ChatGPT asks the user to confirm before a write tool runs. Some plans may only get read-only tools. | No issue: every Kept tool is read-only, the link tool included. |
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
| **Every tool read-only** | Yes | Yes, so plans limited to read-only tools still get everything |
| **Do what** | **List first, this week** | **Submit the same week**, then wait |

**Verdict: do both.** Claude gives us the first reading within weeks. ChatGPT is the bigger prize, and slower.

---

## The funnel

1. **Found.** A seller asks a question in their own words. The assistant suggests Kept, because it is listed and fits.
2. **Value.** A free answer on their own figures: a plan, the money, the dates, a checklist.
3. **Honest exit.** When an agent will get more, it says so. When the debt is bigger than the home, it stops (StepChange, Citizens Advice).
4. **Ask.** "Ask Kept for a written offer": a link to the right situation page, on every answer, and from `get_enquiry_link` when the seller says they want Kept.
5. **A person.** The seller fills in Kept's own form, with Kept's consent wording. A person replies within 24 hours, Monday to Friday, views the home first, and sends a written offer within two working days of the viewing.
6. **Counted.** The link names the assistant, and the form saves it as the enquiry's source.

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
| **Any** | "How do I get an offer from Kept?" | `get_enquiry_link` | A link to their situation page. No details taken | Per situation | The situation page |

## Why it gives value, not just a lead form

- **Their figures, never ours.** It never values the home and never shows an offer (founder rule).
- **Sourced.** Every fact links to its source (`packages/kept-tools/src/sources.ts`).
- **Says who we're wrong for, unprompted.** The Beth Sims bar (`docs/brand/KEPT.md`).
- **The ask is a link.** Six read-only tools. When a seller wants Kept, they get a link and fill in Kept's own form themselves.
- **Fits both directories' rules.** No promotion in tool text. No personal data taken at all. A person reviews every offer.
- **One watch item for Claude's review:** the link tool's text tells the assistant not to collect details or state a price (the founder's guard, from #177). Claude's criteria prefer plain statements. If review flags it, reword as facts: "This tool takes no personal details; the user fills in Kept's form themselves. No price is given before a viewing." The guard stays either way.

---

## What's built (PR #174)

**`@repo/kept-tools`**
- `situations.ts`: the six situations, each page's path and its honest line (from `apps/web/lib/situation-content.ts`), and the debt stop.
- `sale-plan.ts` (`planSale`): dates against a deadline, money after fees and the mortgage, your share, a checklist, the honest line, who Kept is wrong for, and sources. 7 tests.

**`apps/plugin`**
- **`plan_my_sale`** (new, read-only, shows a card).
- **`get_enquiry_link`** (from #177, now merged into this PR): a link to the right situation page. It takes no personal details and writes nothing. This PR sends it to the situation's own page, with that page's honest line.
- **`compare_sale_routes`** takes a situation. Every next step goes to the right situation page, with that page's honest line.
- **Tagged by assistant:** links carry the assistant's name in `utm_source` (`chatgpt`, `claude`, another client's name, or `agent` if unknown). Read from the MCP client's name (#176), else the User-Agent. Usage logs carry the same `source`.
- **Tool text** rewritten as plain statements. "Do not recommend selling or a buyer" is gone.
- **Directory basics:** server title, website and icon; a documentation page at the plugin's home address; the OpenAI domain-token route. The link card no longer says "Nothing to show".
- **Removed:** `ask_kept_to_call`, an in-chat enquiry tool this PR first added. It broke the founder's link-only decision.
- **Tests:** 52 plugin, 35 kept-tools.

**Website:** privacy notice **v1.7**: the plugin's tools store nothing a user types and never ask for contact details.

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
> Kept is a cash buyer. If you want Kept to look at your home, you get a link to Kept's own form.

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
| `get_enquiry_link` | Yes | No | No |

**Test cases for reviewers** (OpenAI asks for these):

| Prompt | Expected |
|:--|:--|
| Prompt 1 above | A table: cash buyer makes the date; agent and auction miss it |
| Prompt 3 above | After fees, after the mortgage, a 50% share |
| "How much is my house worth?" | No value given. That is correct |
| "We owe £200,000 and the house would sell for £150,000." | A stop, pointing to StepChange. No Kept link |
| "How do I get an offer from Kept? My mum left me her house." | A link to Kept's probate page. It asks for no details |

---

## What you need to do, in order

1. **Merge PR #174.**
2. **Create the Vercel project** `kept-plugin` (`06-go-live.md`, step 1). Add `EPC_API_TOKEN`. No other key is needed.
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
- **Vercel → kept-plugin → Logs**, search `kept_plugin_tool`. Each line has the tool, `source` (chatgpt or claude), the outcome and the time.
- **Dashboard → "Where enquiries came from":** the AI assistant row.
- **PostHog:** visits with `utm_source=chatgpt` or `claude`, and the forms they send.

**One check after your first test:** the assistant is read from its MCP client name, else the User-Agent header. We haven't seen real ChatGPT or Claude traffic yet. If the logs say `source: "agent"` after a test from ChatGPT or Claude, tell Claude: it's a one-line fix in `apps/plugin/lib/links.ts`.

**The baseline:** AI assistants send us **nothing** today. The whole site gets **0 to 3 enquiries a week**. So **one enquiry a month** from AI is a real gain.

**Kill criteria** (per assistant, from its listing date):
- After **6 weeks**: fewer than **10 tool uses a week**, or **no enquiry** → stop investing in it.

## The case against

- **Strongest case against: volume.** These are one-off life events, not daily habits. The assistants may never suggest a small UK property tool. Expect tens of uses a month, not thousands.
- **The assumption that kills it:** that ChatGPT and Claude surface Kept when someone says "our buyer pulled out".
  - **Test it cheaply:** after listing, ask each assistant 10 natural questions from a fresh account.
- **Who hates it:**
  - **A stressed seller who feels sold to.** Answer: value first, honest exits, and the ask only when they ask.
  - **Directory reviewers, if it reads like lead generation.** Answer: six useful read-only tools, factual descriptions, and the ask is only a link.
- **The cost of link only:** every step out of the chat loses some sellers. That's the founder's trade: no seller data in the chat, and consent on our own form. Measure it: tool uses, then visits from plugin links, then forms sent.

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
