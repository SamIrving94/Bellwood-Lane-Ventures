# 09. Claude's directory: will it bring sellers?

_Written: 2026-11-28, prompted by the "Claude brought us 24,000+ users in 5 weeks" post (SlickTrip, r/mcp)._
_Last verified against the live site: 2026-11-28._

## The short answer

- **As built today: no.** The plugin is not live, not listed anywhere, and sends people out of the chat to convert.
- **With six changes: maybe, and cheap to test.** Claude's directory is how SlickTrip got found. Every listed connector can be suggested in chat when it fits what the user is doing.
- **Expect far smaller numbers than SlickTrip.** But Kept's base is tiny, so a few enquiries a month would matter.

## What our own data says

PostHog, 5 Oct (when tracking starts) to 28 Nov 2026. Sessions by where the visit came from.

| Came from | Visits | Enquiries sent |
|:--|--:|--:|
| Direct (no referrer) | 222 | 6 |
| Facebook and Instagram | 60 | 2 |
| Google | 6 | 0 |
| **AI assistants** (ChatGPT, Claude, Perplexity, Gemini, Copilot) | **0** | **0** |

- The whole site gets **about 20 to 90 visits a week** and **0 to 3 enquiries a week** (8 in total).
- No visit carried an AI referrer or an AI `utm_source`. So **no AI assistant sends us anyone today**.
- **Caveat:** PostHog recorded almost nothing from 2 to 15 Nov (2 visits a week, against 40 to 60 before). Worth checking tracking didn't break then.

## How the SlickTrip effect works

From Claude's own docs (sources at the end):

- **Every directory connector is eligible for "Suggested Connectors":** "in-chat recommendations shown when relevant to the user's task." This is what put SlickTrip next to Expedia.
- **Listing is self-serve and fast.** Submit on a paid Claude plan. An automated scan follows, and the connector is listed as **Community** by default. Anthropic may later escalate it to a slower **Verified** review.
- **A no-login server is allowed** ("no authentication for public data"). Ours needs no login.
- **ChatGPT is slower.** Approval takes about a month, and until then its search doesn't find you. After approval you press Publish yourself.

## Why Kept is not SlickTrip

- **Volume.** People ask about flights every day, and again next month. Inheriting a home happens once.
- **The metric.** SlickTrip counts free sign-ups. We count sellers handing over a home.
- **It fades.** Their peak of 1,500 a day settled at 250.
- **Our edge.** A dated plan for an inherited home is genuinely useful. And there are likely few UK property connectors to compete with (not verified).

## What would make it move the metric

1. **Go live.** Create the Vercel project (checklist steps 1 to 10).
2. **List on Claude first.** It needs:
   - a finished privacy page (it still needs the **ICO number**) that covers the plugin;
   - a documentation page, a support email and an icon;
   - at least 3 working example prompts (we have 30);
   - 3 to 5 screenshots, at least 1000 px wide (ours are 760 px, so regenerate them);
   - a test in Claude as a custom connector.
3. **Submit to ChatGPT now.** Approval takes about a month, and nothing is public until you press Publish.
4. **Let a seller ask for a call inside the chat.** Today the only next step is a link out to the website form, and every step out loses people. A new tool would take name, phone or email, postcode and situation, with the seller's say-so. It would save a draft quote and an Action Centre card. It sends nothing to the seller and shows no figure.
5. **Count it.** Log which assistant each use came from (Claude or ChatGPT), and tag in-chat requests the same way. The dashboard's "Where enquiries came from" card then shows the answer.
6. **Match the listing to how sellers ask:** "inherited a house", "probate", "house won't sell", "chain fell through". Keep it factual, because Anthropic rejects descriptions that promote.

## The case against (challenge before building)

- **Strongest case against:** it's a rare, one-off, emotional event, not a daily habit like travel. People ask an AI about probate months before they want to sell. So expect tens of uses a month, not thousands.
- **The assumption that kills it:** that Claude suggests a small UK property connector for "what do I do with mum's house?". If it only suggests connectors in big consumer categories, nobody finds us.
  - **Test it cheaply:** after listing, ask Claude 10 natural questions from a fresh account, and watch the plugin's logs for 4 weeks.
- **Who hates it:**
  - A grieving executor who gets a cash buyer's tool suggested mid-conversation. Cash buyers have a poor name in probate. Our tools soften this: they give no valuation and say when an agent will get more.
  - Anthropic's reviewers, if it reads like lead generation. Their policy bans software that "exists primarily as an advertising or promotional vehicle". The contact tool must stay one user-asked action beside genuinely useful tools.

## Kill criteria

- After **6 weeks listed**: fewer than **10 tool uses a week**, or **no enquiry**, means stop investing.

## Rules it must follow (Anthropic Software Directory Policy)

- No ads, sponsored content, or "advertising or promotional vehicle" (4C). Tool descriptions must not "promote products and services".
- "Must not collect extraneous conversation data, even for logging purposes" (1E). The contact tool takes only the fields it needs, and our logs never store inputs.
- High-risk areas, which include finance, need "human-in-the-loop measures and ... direct disclosure to consumers" (1B). We have both: a person reviews every offer, and the tools say "general information, not advice".
- Descriptions must match what the tools do (2B) and must not steer Claude to call them (2D, 2E). Two lines in our tool output tell Claude how to behave ("Do not recommend selling or a buyer"). Reword them as plain statements before submitting.

## Sources

- [Claude connector directory](https://claude.com/docs/connectors/directory.md) (Suggested Connectors)
- [Submitting a connector](https://claude.com/docs/connectors/building/submission.md)
- [Review criteria](https://claude.com/docs/connectors/building/review-criteria.md) (Community and Verified)
- [Anthropic Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy)
- [Remote MCP server submission guide](https://support.claude.com/en/articles/12922490-remote-mcp-server-submission-guide)
- Kept PostHog project, queries run 28 Nov 2026 (sessions by entry referrer and entry `utm_source`).
