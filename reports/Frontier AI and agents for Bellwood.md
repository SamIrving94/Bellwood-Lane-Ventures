# The frontier moved towards Kept's rails

_Research report for the founder. Written 25 Nov 2026._
_Built from the seven note files in `research_notes/Frontier AI and agents for Bellwood/`._

---

## The short version

**The one-line answer**

- In 2026 AI got **cheaper**, **able to work for hours**, and **better controlled**.
- The best new tools are built around one idea: **the machine drafts, a person approves**.
- That is how Kept already works. So the win is not a new robot. It is **faster, safer review**, plus **switching on things already half-built**.

**What is new (Part A)**

- **Prices fell hard at the bottom.** Small models that read and sort text now cost about **$0.10 in / $0.50 out** per million tokens. Kept's code default for that work is listed at ten times that.
- **Agents can work for hours.** An agent is a model that uses tools in a loop until a job is done. One independent lab now measures tasks of **up to 27 hours**. Most of the proof is in coding, not business work.
- **"Pause for a human" is now a standard part.** Vercel, where Kept runs, has a built-in way for a job to stop, wait days for approval, then carry on.
- **Models still make things up.** On a plain "summarise this document" test, leading models invent details about **3% to 12%** of the time. Numbers are the danger zone.
- **UK rules bite on contact, not on "AI".** There is no UK AI Act. The risk sits in calls, texts and emails to people. Fines for those now go up to **£17.5m**.

**What Kept could do (Part B)**

- **Now:** build small test sets for each AI feature. Add automatic checks to every draft. Draft replies to sellers who write in (always held for you). Grow the valuation test set.
- **Next:** upgrade the AI plumbing. Run one job as a "pause for approval" workflow. Give the appraisal real looked-up evidence. Measure honest value ranges.
- **Blue sky:** a standing desk agent for every deal. An "upfront pack" that makes Kept the fastest-prepared buyer. Kept's free tools living inside ChatGPT and Claude.

**What this report will not propose**

- AI voices talking to sellers. Auto-sent emails. A price on screen. A model that guesses a value. Portal scraping.
- All of these exist at the frontier. All of them break your standing rules. Section B3 says so plainly.

**One date to act on**

- The default model in `packages/ai/routing.ts` is reported to be **retired by its maker on 30 Nov 2026**. That is five days away.
- Whether OpenRouter keeps serving it after that was **not confirmed**.

**How far to trust this**

- Most web pages **could not be opened** in this research session. The web-search allowance **ran out part-way**.
- So many findings rest on **search-result summaries**, not a full read of the source page.
- Every key claim below carries a **confidence tag**. Section D lists what could not be checked.

**If you only read three things**

- This page.
- **Section E:** the ranked list of what to do first.
- **Section C:** housekeeping, which has the one dated item.

**Map of the report**

| Part | What is in it |
|:--|:--|
| **A** | What is new at the frontier. Eleven short sections. |
| **B** | What Kept could apply. Rules first, then Now, Next and Blue sky. |
| **C** | Housekeeping: things the research found in the current system. |
| **D** | What could not be verified, and thin topics. |
| **E** | What to do first. |

---

## How to read the tags

| Tag | What it means |
|:--|:--|
| **[Strong]** | The source page was opened and read in full. Mostly Anthropic, the MCP blog, the npm registry, GitHub and Vercel's docs. |
| **[Medium]** | An official page seen only as a search summary. Or two independent price lists that agree. |
| **[Weak]** | Second-hand: trade press, blogs, a seller's own claim, or a single source. |
| **[Our reasoning]** | A conclusion drawn in the notes. Not a sourced fact. |
| **[Code]** | Read from this repository. Not checked against the live database. |

## Words used in this report

| Word | Plain meaning |
|:--|:--|
| **Model / LLM** | The AI that reads and writes text. |
| **Token** | A small chunk of a word. Prices are quoted per million tokens, "in" (what you send) and "out" (what comes back). |
| **Agent** | A model that calls tools in a loop until a job is done. |
| **Tool** | A function the model may call, such as "look up flood risk". |
| **OpenRouter** | The one service Kept uses to reach every model. One bill. |
| **SDK** | The code library Kept uses to call models. |
| **MCP** | A standard plug that lets assistants such as ChatGPT call your tools. Kept's plugin uses it. |
| **AVM** | Kept's valuation engine. |
| **Hold-out** | A set of real sales kept aside to test the valuation engine. |
| **Median error** | Half of estimates miss by less than this, half by more. Written "MdAPE" in the docs. |
| **Eval / test set** | A fixed list of real cases with known right answers, replayed to check quality. |
| **Backtest** | Checking past estimates against what later happened. |
| **Shadow run** | The same prompt re-run on a second model, logged and thrown away, to compare. |
| **Fallback chain** | The next models tried, in order, when the first one fails. |
| **Cron** | A job that runs on a timer. |
| **Dark launch** | Live but hidden. No promotion, not indexed. |
| **Hallucination** | The model stating something that is not in its source. |
| **Prompt injection** | Text hidden in an email or web page that tries to give the model orders. |
| **Zero retention** | The model host keeps no copy of what you send. |
| **PECR** | The UK rules on marketing calls, texts and emails. |
| **ICO / CMA / ASA** | UK regulators for data, consumer law and advertising. |

---

# Part A: what is genuinely new

## A1. Top models cost $8 in. Small ones cost 10 cents

**Three labs hold the lead.** All three shipped a new top model in November 2026.

| Tier | Example (release date) | Price per 1M tokens, in / out | Tag |
|:--|:--|:--|:--|
| **Top** | Claude Fable 5.2 (9 Nov). GPT-6.2 Astra (17 Nov). | $8 / $40 | Strong for Claude. Medium for GPT. |
| **Daily driver** | Claude Opus 5.5 (22 Sep) | $4 / $20 | Strong |
| **Strong middle** | Claude Sonnet 5.5 (28 Sep). GPT-6.2 Sol. | $2 / $10 | Strong / Medium |
| **Small** | Claude Haiku 5.5 (7 Oct). GPT-6 Luna. | $0.10 / $0.50 | Strong / Medium |
| **Open-weight, cheap** | DeepSeek V4 Flash | $0.09 / $0.18 on OpenRouter | Medium |

Sources: ([Anthropic models](https://platform.claude.com/docs/en/about-claude/models/overview)), ([Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)), ([OpenAI price list](https://github.com/simonw/llm-prices/blob/main/data/openai.json)), ([LiteLLM price map](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json)).

**What matters for Kept**

- **The small tier fell about 90% in a year.** Claude Haiku 4.5 is still listed at $1 / $5. Haiku 5.5 is $0.10 / $0.50. **[Strong]** ([Haiku 5.5](https://platform.claude.com/docs/en/models/haiku-5-5/overview))
- **A catch.** Haiku 5.5 costs five times more once a single request passes 100,000 tokens. Long documents should be split. **[Strong]** ([Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing))
- **A second catch.** Newer Claude models count about 30% more tokens for the same text. The real saving is a bit smaller than the list price says. **[Strong]** ([Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing))
- **The middle tier got cheaper too.** Sonnet 5.5 is $2 / $10. Kept's default Sonnet 4.5 is $3 / $15. **[Strong]**
- **The maker's own advice:** start with Opus 5.5. Move to the top model only when your own tests fall short. **[Strong]** ([Choosing a model](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model))
- **The top three are level within noise.** Each wins some tests. Most scores are run by the maker. **[Our reasoning]**
- **Model names now change every two to three months.** Old ones retire about a year later. Each 2026 Claude generation brought at least one breaking change. **[Our reasoning, from Strong dates]** ([Deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations))
- **Prices move without warning.** Google's Gemini 4 Carbon doubles from $2 / $10 to $4 / $20 on 1 Dec 2026. **[Medium]** ([Google price list](https://github.com/simonw/llm-prices/blob/main/data/google.json))

**On OpenRouter**

- The newest models are **listed there at the makers' prices**. Same-day listing was not proven. **[Medium]** ([LiteLLM price map](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json))
- OpenRouter added a lot in 2026: spend limits, workspaces, audio, and a new alpha "**Extractions**" service (12 Nov 2026) that pulls typed fields out of text, images and PDFs. Its docs warn the shape is not stable. **[Medium]** ([OpenRouter Extractions](https://openrouter.ai/blog/announcements/extractions-api/))
- **A warning sign.** On 22 Nov 2026 OpenRouter's blog said researchers found "some inference providers did not uphold their data policies". The detail could not be read. **[Medium]** ([OpenRouter announcements](https://openrouter.ai/blog/announcements/))
- **The very top Claude models cannot run with zero retention.** Fable 5.x needs 30-day retention everywhere. Opus, Sonnet and Haiku 5.5 can still run with zero retention. **[Strong]** ([Anthropic data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention))
- OpenRouter can keep data in the EU or the US. **No UK region** was mentioned anywhere. **[Medium]** ([OpenRouter docs index](https://openrouter.ai/docs/llms.txt))

## A2. Models now work for hours, but still invent 3% to 12% of details

**What got better**

- **Long jobs.** METR, an independent lab, reports tasks of "up to 27 hours" and says that length is "doubling roughly every 3.6 months" (20 Nov 2026). **[Medium]** ([METR update](https://metr.org/blog/2026-11-20-q4-2026-capability-update/))
- The makers publish customer stories of 10 to 18 hour unattended runs. **These are mostly coding jobs**, where tests give a clear pass or fail. Proof for long, unsupervised business work is thinner. **[Strong that the maker says it]** ([Fable 5.2 launch](https://www.anthropic.com/claude-fable-and-mythos-5-2))
- **Driving a computer.** Claude's "computer use" tool left beta on 19 Aug 2026. A browser tool launched the same day. The small Claude model jumped from 15.7% to 72.4% on one desktop test between versions (maker's own test). **[Strong]** ([Haiku 5.5 launch](https://www.anthropic.com/claude-haiku-5-5))
- **Reliable shape.** "Structured outputs" now guarantee the answer fits your form. They do **not** check that numbers are in range. Your code must. **[Strong]** ([Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs))
- **Cheap repeats.** A stored prompt ("caching") can cost as little as 2.5% to 5% of the normal price on newer Claude models. Agent jobs cost 3 to 7 times more with caching off. **[Strong]** ([Cost guide](https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence))
- **Huge inputs.** About 1 million tokens of context is now standard. **[Strong]**

**What is still broken**

- **Making things up.** On an independent "summarise this document" test (24 Nov 2026), the best small models invent details 3% to 6% of the time. Claude Opus 5.5 scores 9.9%. Some models score 12% or worse. **[Medium]** ([Vectara leaderboard](https://github.com/vectara/hallucination-leaderboard))
- **A surprise.** On that test the **cheap models are more faithful** than the flagship ones. Bigger models add "helpful" detail that is not in the source.
- **The maker's own words:** "Always validate critical information, especially for high-stakes decisions." **[Strong]** ([Reduce hallucinations](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations))
- **Stopping early.** The top Claude model "sometimes ends a turn with a list of what remains". Models also still sometimes claim a job is finished when it is not. **[Strong]** ([What's new in Fable 5.2](https://platform.claude.com/docs/en/models/fable-5-2/whats-new-fable-5-2))
- **Charts and scans.** The best score for reading figures off charts is about 73%. **[Strong, maker's test]** ([Fable 5.2 launch](https://www.anthropic.com/claude-fable-and-mythos-5-2))

**Still do not trust a model alone with** **[Our reasoning]**

- Any number that drives money or reaches a customer.
- Any fact that is not in a document you gave it.
- Any claim that a multi-step job is "done".
- Anything with legal or privacy weight.

## A3. The tooling now assumes a human approval step

**The big shift of 2026: the new tools are mostly controls.** Approvals, budgets, short-lived keys, tracing, sandboxes. The tooling caught up with the risk. **[Our reasoning]**

**Things that changed under Kept's feet**

- **Kept's code library moved on three major versions.** The Vercel AI SDK is on version 7 (25 Jun 2026). It now has a built-in tool loop, a durable agent that can wait for a person, and **tool approvals** you write as code. **[Strong]** ([npm: ai](https://registry.npmjs.org/ai)), ([Tool approvals](https://ai-sdk.dev/docs/agents/tool-approvals))
- **Vercel has a built-in "pause and resume".** Vercel Workflows went live for everyone in April 2026. A job can stop, wait for a person, sleep for days at no compute cost, and carry on, even across new deployments. **[Strong for how it works. Weak for the launch date and price.]** ([Workflow concepts](https://vercel.com/docs/workflows/concepts)), ([Vercel blog](https://vercel.com/blog/a-new-programming-model-for-durable-execution))
- **Vercel calls its cron feature "legacy".** A replacement called Schedules is in beta. **[Strong]** ([Schedules](https://vercel.com/docs/schedules/configuration))
- **MCP had its biggest rewrite.** On 28 Jul 2026 the standard dropped sessions and the opening handshake, and changed its sign-in rules. Old behaviour has at least 12 months to live. **[Strong]** ([MCP 2026-07-28](https://blog.modelcontextprotocol.io/posts/2026-07-28/))
- **One build now reaches every assistant.** "MCP Apps" (26 Jan 2026) let a server show a small interactive screen inside ChatGPT, Claude, VS Code and Goose. **[Strong]** ([MCP Apps](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/))
- **"Skills" became a shared standard.** A skill is a folder with a plain-text how-to file. Coding agents from every major maker now read them. **[Strong]** ([Agent Skills donation](https://www.anthropic.com/news/donating-agent-skills-to-the-agentic-ai-foundation))
- **Coding agents run in the cloud, on a schedule.** Claude Code can run a saved task on a timer and auto-fix failing pull requests. Scheduled tasks are still a "research preview". **[Strong]** ([Scheduled tasks](https://code.claude.com/docs/en/routines))

**What the best evidence says about doing it well**

| Topic | Finding | Tag |
|:--|:--|:--|
| **Approval fatigue** | People approved about **93%** of per-action prompts. A review rule only protects if each item is worth reading. ([Containment study](https://www.anthropic.com/research/how-we-contain-claude)) | Strong, but measured on coding tools |
| **Prompt injection** | Model defences are not enough. Cap the damage by design: no secrets near untrusted text, and a human gate on anything outward. ([Containment study](https://www.anthropic.com/research/how-we-contain-claude)) | Strong |
| **Automatic gates** | A classifier that polices an agent missed **17%** of real over-eager actions in the maker's own test. ([Auto mode](https://www.anthropic.com/research/claude-code-auto-mode)) | Strong |
| **Testing** | Start with 20 to 50 real failures. Yes/no checks. Code checks first. Read the transcripts. ([Evals guide](https://www.anthropic.com/research/demystifying-evals-for-ai-agents)) | Strong |
| **Memory** | Search plus a model-kept "wiki" beat search alone: 61% vs 53%. One page per contract lifted graded facts from 41 of 57 to 57 of 57. ([Memory study](https://www.anthropic.com/research/components-of-agent-memory)) | Strong, one study, not on business data |
| **Small knowledge bases** | Under about 200,000 tokens, skip the search layer. Put it all in a stored prompt. ([Contextual retrieval](https://www.anthropic.com/news/contextual-retrieval)) | Strong, from 2024 |
| **Many agents** | Helps when work is wide, independent and checkable. Hurts when work is step-by-step or shares records. Costs several times more. ([Agent teams](https://code.claude.com/docs/en/agent-teams)) | Strong for the guidance. Weak for the outside studies. |

**What this means for Kept** **[Our reasoning]**

- A mailbox reader that **cannot send** and **holds drafts for a person** has already removed the most dangerous leg. That is Kept's design.
- Deciding on **email headers before fetching bodies** is a pattern the sources would back. Text that never reaches the model cannot give it orders.
- Kept's scrape, enrich, score, value, draft pipeline is a **fixed workflow**. The evidence says keep it that way. Do not turn it into a team of chatting agents.
- **Not for a small UK buyer yet:** agent payments, agent identity, agent-to-agent protocols. Real, but early.

## A4. Voice is cheap. The limits are legal and human

_Nothing in sections A4 to A7 was checked against a full source page. Treat every figure as "reported"._

- **Live voice models got cheap.** OpenAI's GPT-Live-1 is priced at **$0.05 a minute** (10 Sep 2026). Google's Gemini 3.8 Live works out near $0.023 a minute. **[Medium]** ([OpenAI model page](https://developers.openai.com/api/docs/models/gpt-live-1)), ([Google blog](https://blog.google/innovation-and-ai/technology/developers-tools/build-real-time-voice-applications-gemini-audio/))
- **Turning speech into text is almost free.** About $0.008 to $0.017 a minute. **[Weak to Medium]** ([The Next Web](https://thenextweb.com/news/openai-gpt-realtime-2-voice-models)), ([Deepgram pricing](https://deepgram.com/pricing))
- **Pauses are still felt.** One independent tester measured 1.1 to 2.1 seconds at the slow end. Makers quote far less. **[Weak]** ([Coval ranking](https://www.coval.ai/blog/voice-ai-models-2026/))
- **UK regional accents trip some engines.** One small study on Newcastle English saw error rates of 40% to 60% for two engines. **[Weak]** ([arXiv 2506.16558](https://arxiv.org/html/2506.16558v1))
- **For the person running the business,** dictation apps are mature at about $8 to $12 a month. All three big assistants gained full voice modes in mid-2026. Claude's can reach tools such as Gmail. **[Weak]** ([Dictation comparison](https://www.digitalapplied.com/blog/ai-dictation-tools-2026-wispr-superwhisper-compared)), ([The Decoder](https://the-decoder.com/claudes-voice-mode-now-runs-on-anthropics-most-capable-models-across-all-platforms/))
- **UK consumers are wary.** 61% say they would be less inclined to engage if they knew they were talking to an AI assistant. Trust in AI to fix a problem doubles (26% to 55%) when a human option exists. **[Medium for the first, Weak for the second]** ([Deloitte UK](https://www.deloitte.com/uk/en/about/press-room/digital-consumer-trends-over-a-third-of-consumers-believe-gen-ai-health-advice-is-always-accurate.html)), ([Five9 survey](https://itbrief.co.uk/story/uk-consumers-more-frustrated-by-ai-customer-service))
- **The safe pattern in the sources:** people make and take the calls. AI listens with notice, writes the note, drafts the follow-up. **[Our reasoning]**

## A5. Vision can describe a home. It cannot measure one

- **Good for:** sorting photos, a rough condition band, flagging obvious defects.
- **Bad for measuring.** General models misjudged room area by about **43%** in one test. They count doors and windows right only 40% to 55% of the time. **[Weak]** ([Room-area study](https://pp.bme.hu/ci/article/view/44138)), ([AECV-Bench](https://arxiv.org/abs/2601.04819))
- **Street photos.** One 2026 paper found a model agreed well with experts on building condition. The test used **only 25 images**. **[Weak]** ([arXiv 2604.21102](https://arxiv.org/pdf/2604.21102))
- **Photos may add little.** A 200-listing study found text alone did about as well as text plus photos. **[Weak]** ([Listing benchmark](https://sol.sbc.org.br/index.php/erigo/article/download/39521/39293))
- **Phones measure well.** iPhone LiDAR (a depth sensor) is reported as accurate to about an inch indoors. Plans made from plain video ran about 10% out in one review. **[Weak, second-hand]** ([illustrarch](https://illustrarch.com/?p=110334)), ([Open Homes](https://www.open-homes.com/faqs/are-cubicasa-or-matterport-floor-plans-accurate/))
- **Every commercial "condition score" figure found is the seller's own**, and US-trained.
- **Rule of thumb:** let models **describe and flag**. Let tools **measure**. **[Our reasoning]**

## A6. Document readers swing 50 points depending on the test

- **Three price tiers now exist.** Cheap text reading at about $1.50 to $4 per 1,000 pages. Smart readers that cite the page and box for each fact at about $10 to $12.50. Free open-source models. **[Weak to Medium]** ([Mistral OCR 4](https://mistral.ai/news/ocr-4/)), ([Cost comparison](https://openbenchmarks.com/document-processing/best-pdf-data-extraction-apis-by-cost))
- **The test decides the winner.** One tool scores 85 on its maker's own test. A newer version of it scored **36.9%** on a contract question test where two rivals scored about 84%. **[Weak]** ([Contract benchmark](https://openbenchmarks.com/document-processing/best-pdf-data-extraction-apis-by-cost))
- **Cost is not the limit.** A 300-page legal pack costs roughly $1 to $7 to read. **[Our reasoning]**
- **The lease risk is "overreach".** Models add a term that is not there, or pull the right-looking value from the wrong clause. **[Weak, vendor sources]** ([Harvey benchmark](https://www.harvey.ai/blog/contract-intelligence-benchmark)), ([Basking](https://basking.io/blog/resources/how-accurate-is-lease-abstraction/))
- **Fix that the sources agree on:** demand a **word-for-word quote** for every field. No quote, no field.
- **Handwriting** still needs a person to confirm.
- **UK conveyancers already buy this.** Orbital reviews titles and leases and flags risks. **[Weak, vendor claim]** ([Orbital](https://orbital.tech/residential-uk))

## A7. Browser agents finish hard jobs less than half the time

_This topic is thin. Most planned searches did not run._

- On an older desktop test, the best agents now beat the human score of 72%. **[Weak]**
- On a newer test of long jobs, strict success is only about **13% to 44%**. One model hit 77.9% "partly done" but 41.7% "fully done". **[Weak]** ([OSWorld tracker](https://presenc.ai/research/osworld-computer-use-leaderboard-2026))
- **Reading:** short, bounded web tasks are likely fine. Long ones fail more often than they succeed. **[Our reasoning]**
- **Not researched:** which products exist, what they cost, how sites block them, and the UK legal position.

## A8. New valuation models top the benchmarks, with no house-price proof

_Every finding here comes from search summaries. Re-check any number before it drives a decision._

**New model families**

- **"Tabular foundation models"** are models that predict from a spreadsheet of examples with no training step. In 2026 they sit above tuned classic methods on the main public benchmark. They are reported strongest on **small data**, which is Kept's size. **[Weak to Medium, mostly the makers' own reports]** ([TabPFN-3.5 report](https://priorlabs.ai/technical-reports/tabpfn-3-5)), ([TabArena](https://arxiv.org/html/2506.16791v4))
- **No study was found that tests them on house prices.** That is a gap in the research.
- **Licence catch.** The best-known family (TabPFN) releases its weights for research and evaluation only. Business use means its paid service or a licence. NVIDIA's Kumo Tabular (late Sep 2026) has a permissive licence. **[Medium]** ([Prior Labs docs](https://docs.priorlabs.ai/models.md)), ([Kumo Tabular](https://huggingface.co/nvidia/kumo-tabular))

**What the valuation research says**

- **Blends win.** A 2025 Oslo study got its best result (5.17% median error) by stacking a comparable-sales method with a machine-learning model. Not UK. One city. Flats only. **[Medium]** ([Oslo study](https://link.springer.com/article/10.1007/s11146-025-10030-x))
- **Learned comparable selection.** A March 2026 paper learns which comparables to pick, instead of using fixed distance rules. No UK data. **[Weak]** ([arXiv 2603.12986](https://arxiv.org/abs/2603.12986))
- **Models as feature readers, not valuers.** A Nov 2026 paper uses a language model to turn listing text into features and a vision model to sort photos. Both helped. Numbers not retrieved. **[Weak]** ([arXiv 2611.01615](https://arxiv.org/pdf/2611.01615))
- **Language models give ranges that are too narrow.** They understate their own doubt on house prices. **[Weak]** ([arXiv 2506.11812](https://arxiv.org/html/2506.11812v1))

**Where Kept's 12.3% sits**

- The best published off-market figure is Zillow's in the US: about **7.2%** median error, built on far richer data than UK open data. With an asking price known, it drops to about 1.8%. **[Weak]** ([Boston Globe](https://www.bostonglobe.com/2026/10/23/real-estate/home-value-estimates-zillow-redfin/))
- Two UK hobby projects on open data report about 19.9% and 15.7%. Not peer reviewed. **[Weak]** ([Project one](https://github.com/Pulak-PSR/uk-house-price-prediction)), ([Project two](https://github.com/adilh333/uk-house-price-analysis))
- **No independent UK accuracy study against sold prices was found.** UK vendors publish their own figures, often against a surveyor's value, not the sale price.
- The notes' own guess at a UK open-data floor is **high single digits to about 10%**. That is reasoning, not a sourced number. **[Our reasoning]**

**Honest ranges and saying no**

- **"Conformal prediction"** is a way to set a value range that truly contains the answer as often as it claims. Property papers show it works, if tuned by area or property group. **[Medium, not UK]** ([J. Property Research](https://ideas.repec.org/a/taf/jpropr/v42y2025i1p1-19.html)), ([Oslo spatial study](https://arxiv.org/html/2312.06531v2))
- **Refusing is normal practice.** Industry sources say a valuation model "should not" answer when it lacks confidence. Always report how often it refuses next to how accurate it is. **[Weak]** ([Clear Capital](https://www.clearcapital.com/blog-avm-testing-glossary/))

**New free UK data**

- **From 28 Aug 2026, Land Registry publishes a property ID (UPRN) with each new sale.** That makes exact matching to energy certificates free going forward. Older sales are not back-filled. **[Medium]** ([gov.uk](https://www.gov.uk/government/news/hm-land-registry-to-provide-property-identifiers-for-price-paid-data-from-28-august))

**Lead scoring**

- **No study was found on which probate or distressed homes sell, or how fast.** Only US marketing write-ups. The searches on few-label methods did not run.

**How sharp is the 209-sale test?** _(The notes' own simulation. Not a published source. The script was not saved.)_

- A reading of 12.3% on 209 sales really means "about **10% to 15%**".
- Only gains of about **1.5 to 2.5 points** can be detected reliably.
- A test set of about 800 sales would halve that blur.

## A9. AI search rewards being talked about, not special files

_No source page was opened for this section. Figures are "reported by"._

- **Google's own line (15 May 2026):** getting into AI answers "is ordinary SEO". Same index. Same ranking. No special files needed. **[Medium]** ([Google guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide))
- **The `llms.txt` file does nothing measurable.** In one study, 97% of sites with the file got zero requests for it. **[Weak, vendor study]** ([Ahrefs](https://ahrefs.com/blog/llmstxt-study/))
- **Being named elsewhere is the signal.** Across 75,000 brands, YouTube mentions tracked AI visibility most closely (0.74). Web mentions 0.66. Backlinks only 0.22. This is correlation, not proof of cause. **[Weak, vendor study]** ([Ahrefs via Business Wire](https://www.businesswire.com/news/home/20260526119691/en/Across-75000-Brands-YouTube-Mentions-Are-the-Strongest-Signal-of-AI-Visibility-New-Ahrefs-Report-Reveals))
- **Fake mentions and mass pages are now spam** under Google's rules. One researched guide a week is on the right side of that line. **[Weak to Medium]** ([PPC Land](https://ppc.land/google-spam-policies-now-officially-cover-ai-overviews-and-ai-mode-in-search))
- **UK habits.** 54% of adults use AI tools. 79% of 16 to 24s. Older adults mostly meet AI through Google's AI summaries, which show on about 30% of searches. **[Medium]** ([Ofcom media use](https://www.ofcom.org.uk/media-use-and-attitudes/media-habits-adults/passive-social-media-use-ai-companionship-and-online-side-hustles-uk-adults-media-and-online-lives-revealed)), ([Ofcom Online Nation](https://www.ofcom.org.uk/media-use-and-attitudes/online-habits/from-apps-to-ai-search-how-the-uk-goes-online-in-2025))
- **The traffic is tiny so far.** ChatGPT sent about 0.32% of site traffic in May 2026. **[Weak]** ([Traffic roundup](https://www.digitalapplied.com/blog/ai-referral-traffic-share-2026-gemini-chatgpt-geo-analysis))
- **Free measurement exists.** Bing's webmaster tools show how often your site is cited in its AI answers. **[Medium]** ([Bing blog](https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview))
- **Apps inside assistants.** ChatGPT's app list became a "Plugin directory" on 9 Jul 2026. One tracker counts about 15,000 listings. The model picks an app from its **tool descriptions**. In Claude, only directory-listed connectors can be suggested in chat. **[Medium / Weak]** ([OpenAI help](https://help.openai.com/en/articles/11487775-apps-in-chatgpt)), ([Apps SDK](https://developers.openai.com/apps-sdk/plan/tools)), ([Claude docs](https://claude.com/docs/connectors/building/directory-vs-custom))
- **No lead-generation case study for a service business was found.**
- **Ads inside ChatGPT are live in the UK** with a self-serve tool. Six months in, advertisers have no benchmarks. One agency reported clicks and zero buyers. **[Weak]** ([Search Engine Land](https://searchengineland.com/openai-opens-chatgpt-ads-manager-beta-to-uk-advertisers-480679)), ([Search Engine Journal](https://www.searchenginejournal.com/6-months-into-chatgpt-ads-advertisers-still-dont-know-what-good-looks-like/587583/))
- **Auto-written outreach does badly.** In one study of 100,000 emails, AI-written ones reached the inbox 71% of the time against 86% for human ones. All business-to-business, all US. **[Weak, vendor study]** ([AI SDR analysis](https://www.digitalapplied.com/blog/ai-sdr-real-performance-100k-email-analysis-2026))
- **Post has the best-measured numbers.** Cold addressed mail: 0.9% response. Warm mail: 7.2%. **[Medium, industry research]** ([DMA on JICMAIL](https://dma.org.uk/article/jicmails-2025-response-rate-tracker-update-reveals-growing-performance-of-customer-acquisition-mail-campaigns))

## A10. US buyers cut handling cost with AI, and still lost money

- **Opendoor (US)** rebuilt itself around AI. Its cost to handle each home fell **57%**. In the same quarter it wrote down **$53m** of stock and its loss more than doubled to **$218m**. **[Weak to Medium, company release via search summary]** ([Opendoor Q3 2026](https://finviz.com/news/417669/opendoor-reports-third-quarter-2026-financial-results))
- **Lesson:** AI lowers handling cost. It does **not** stop a buyer paying too much. **[Our reasoning]**
- **Offerpad (US)** launched AI for seller intake and for tracking each home (18 Mar 2026). Results were "anticipated", not reported. **[Medium]** ([Business Wire](https://www.businesswire.com/news/home/20260318633162/en))
- **UK portals** put search inside chat. Rightmove and Zoopla both have ChatGPT apps. Rightmove says under 0.5% of its traffic comes from ChatGPT. Its chief first claimed a big uplift, then cast doubt on it. **[Weak]** ([City AM](https://www.cityam.com/?p=2403517))
- **Portals now collect seller intent directly.** Rightmove's instant estimate drove valuation leads to agents up 50% in a year. That competes with anyone who sources sellers. **[Weak]** ([Property Industry Eye](https://propertyindustryeye.com/rightmove-reports-surge-in-property-valuation-leads-to-agents/))
- **One UK cash buyer** (Upstix) launched an "instant cash offer" from an AI valuation. Date not confirmed. **[Weak]** ([Property Industry Eye](https://s2.propertyindustryeye.com/?p=141084))
- **No UK quick-sale firm was found publishing measured results from AI.** A small firm with a measured valuation engine and a human-reviewed process is not behind UK peers on evidence. **[Our reasoning]**
- **Photos are the live UK scandal.** Trade press reported listings with AI-added floors and a door with no handle. No enforcement action was found. **[Weak]** ([The Negotiator](https://thenegotiator.co.uk/news/regulation-law-news/trouble-brewing-over-estate-agents-use-of-ai-photography/))

## A11. UK rules: no AI Act, heavy fines on contact

_This section is research, not legal advice. No regulator page could be opened. Everything here was read through search summaries or law-firm notes._

| Area | What the notes found | Tag |
|:--|:--|:--|
| **AI law** | The UK has **no AI Act** and no government AI bill. Existing regulators apply existing law. ([RPC guide](https://www.rpclegal.com/thinking/artificial-intelligence/ai-guide/part-1-uk-ai-regulation/)) | Weak to Medium |
| **Your AI's words are your words** | CMA guidance (9 Mar 2026): the business answers for what its AI agent says. Not telling people they are dealing with AI can be a misleading omission. ([CMA guidance](https://www.gov.uk/government/publications/complying-with-consumer-law-when-using-ai-agents/complying-with-consumer-law-when-using-ai-agents)) | Medium |
| **Consumer fines** | The CMA can fine up to 10% of turnover without going to court. Its first big fine (£4.2m, Apr 2026) was for fees revealed late. ([DLA Piper](https://www.dlapiper.com/insights/publications/2026/04/the-aa-agrees-a-fine-in-the-first-cma-consumer-protection-enforcement-under-the-dmcca)) | Weak to Medium |
| **Marketing calls, texts, emails** | Since 5 Feb 2026 the top fine is **£17.5m or 4% of turnover**. Every 2026 fine found was for mass calls or texts, several "targeting vulnerable people". ([Weightmans](https://www.weightmans.com/media-centre/news/blink-and-you-ll-miss-it-important-data-protection-law-changes-brought-into-force-under-the-radar/)), ([ICO, Jul 2026](https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/2026/07/two-home-improvement-companies-fined-370-000-for-nuisance-calls-targeting-vulnerable-people/)) | Medium |
| **Post** | The ICO says marketing by post does not need consent. Other duties still apply. ([ICO FAQ](https://ico.org.uk/for-organisations/advice-for-small-organisations/frequently-asked-questions/marketing/)) | Medium |
| **Human review must be real** | The ICO's draft guidance says human involvement must be "meaningful and active" to count. A rubber stamp would not. ([ICO consultation](https://ico.org.uk/about-the-ico/ico-and-stakeholder-consultations/2026/03/ico-consultation-on-the-draft-guidance-about-automated-decision-making-including-profiling/)) | Medium, draft only |
| **AI agents and data** | The ICO closed a call for evidence on "agentic AI" on 20 Nov 2026. A statutory code is coming. ([Pinsent Masons](https://www.pinsentmasons.com/out-law/news/agentic-ai-ico-signals-its-data-protection-priorities)) | Weak to Medium |
| **AI voice calls** | No ICO or Ofcom rule on AI voice agents was found. Lawyers disagree on whether they count as "automated calls". ([SMB London](https://www.smb.london/insights/hello-is-it-generative-voice-ai-youre-looking-for/)) | Weak |
| **Adverts** | No duty to label AI-made ads. But a label does not rescue a misleading image. ([ASA](https://www.asa.org.uk/news/disclosure-of-ai-in-advertising-striking-the-balance-between-creativity-and-responsibility.html)) | Medium |
| **Valuations** | RICS says a bare model output with no valuer's judgement is not a compliant valuation. ([RICS](https://community.rics.org/viewdocument/ai-or-automated-valuation-model)) | Medium |
| **Reviews** | Fake or staff-written reviews are banned. The CMA opened cases in 2026, one on a funeral provider. ([CMA case page](https://www.gov.uk/cma-cases/online-consumer-reviews)) | Medium |
| **Home-buying reform** | A roadmap (19 Jun 2026) points to upfront "sales packs" and later binding contracts. Only guidance in 2026. Law has no date. ([gov.uk roadmap](https://www.gov.uk/government/consultations/home-buying-and-selling-reform/outcome/home-buying-and-selling-reform-roadmap)) | Medium |
| **Short leases** | Cheaper lease extensions are on the statute book but **not in force**. Today's rules still apply. ([LEASE](https://www.lease-advice.org/lease-extension/leasehold-reforms/)) | Medium |
| **Quick-sale sector** | Reference points are a 2013 market study (sellers typically gave up 10% to 25% of value) and a voluntary 2019 ombudsman code. No 2025 to 2026 action aimed at the sector was found. ([CMA case page](https://www.gov.uk/cma-cases/providers-in-the-quick-house-sales-sector-investigation)) | Weak to Medium |

**What follows for Kept** **[Our reasoning]**

- "No figure before viewing", a written offer held for a week, and no fees remove most of the failure modes the 2013 study found. No regulator source says this for the sector. It is the notes' reading.
- Calling a model output a "valuation" or "market value" to a seller would be risky, given the RICS line.
- Any copy that assumes cheaper lease extensions assumes law that is not in force.
- **Open question:** whether a firm buying on its own account must join a redress scheme or register for anti-money-laundering checks was **not answered** by any source found. It needs a legal check.

---

# Part B: what Kept could apply

## B1. Where Kept stands today

_From `current_ai_use_in_codebase.md`, a read-only study of the repo on 25 Nov 2026. Nothing was run against the live database._

**What exists** **[Code]**

- **26 AI features**, all through one shared client: `@repo/ai/claude` (`packages/ai/claude.ts`).
- Every call is **one shot**: text in, answer out. There are **no tool loops, no streaming, no memory, no agent talking to another agent**.
- Almost every output lands as a **`FounderAction`** card for a person to review. Nothing seller-facing is sent by a model.
- The client has good bones: per-feature model routing from the dashboard, a fallback chain, shadow runs, and a privacy-safe log (`LlmCallLog` holds numbers only, never text).
- The valuation engine has a **serious measurement regime**: frozen `AvmSnapshot` rows, a monthly backtest, and a hold-out script. First hold-out reading, 23 Oct 2026, on 209 sales: 15.6% to 12.3% (`docs/AVM-BACKTEST.md:98-111`).

**The gaps** **[Code]**

- **The bottleneck is decisions, not drafts.** "Generation is not the bottleneck. Decision throughput is." (`docs/LLM-LEVERAGE-REVIEW.md:84-90`)
- **AI quality is barely measured.** No test set of AI outputs. No record of prompt versions. Shadow runs compare speed and cost, not correctness.
- **Much is built but dark:** probate PDF reading, the knowledge base, two rationale helpers, the old MCP server.
- **Whole abilities are absent:** tool-using agents, voice, browser automation, durable workflows, memory.

**The assets** **[Code]**

| Already stored | Where | What it could teach |
|:--|:--|:--|
| Estimate, then later sale price | `AvmSnapshot` | Honest value ranges |
| Draft, then what you sent | `OutreachHold.renderedBody` / `editedBody` | Your voice |
| Desk suggestion, then what you did | `FounderAction.metadata.desk` / `status` | Whether the desk helps |
| Photo score, then on-site score | Lead payload / `Viewing.conditionScores` | Whether photo reads are right |
| Lead score, then triage and conversion | `ScoutLead` | Whether the score ranks well |
| Pasted message, parse, and whether it needed fixing | `WhatsAppIntake` | Parse quality |

- **The scarce thing is volume, not structure.** Loops with frequent outcomes (triage, edits, photo vs viewing) will mature long before loops that need completed deals. **[Our reasoning]**
- Row counts are unknown. The live database was not read.

## B2. The rules every idea must pass

| # | Standing rule | Where it lives |
|:--|:--|:--|
| 1 | **All AI calls go through OpenRouter.** | `CLAUDE.md`, `docs/LLM-ROUTING.md` |
| 2 | **Seller-facing emails are never auto-sent.** Always held for you. | `OutreachHold`, `apps/api/app/cron/_lib/contact-routing.ts` |
| 3 | **People do seller calls, negotiation and final judgment.** Automate steps, protect thoughts. | `docs/DECISION-STACK.md:55-59` |
| 4 | **No price on screen. No figure before a viewing.** | `apps/web/app/instant-offer/components/chat-flow.tsx:205` |
| 5 | **The valuation method is frozen.** New ideas are measured on the hold-out first. Never value without a sale. | `CLAUDE.md`, `docs/AVM-BACKTEST.md` |
| 6 | **No unofficial WhatsApp client.** | `CLAUDE.md` § Services |
| 7 | **No portal scraping.** | `docs/SOURCING-PLAYBOOK.md:37` |
| 8 | **The email log's deal-matching must not be widened.** | `CLAUDE.md`, `docs/GOOGLE-WORKSPACE.md` |
| 9 | **Public copy never says "AI".** | `docs/brand/KEPT.md`, `packages/ai/brand-voice.ts` |
| 10 | **Strategy-shaped builds ship dark,** after a challenge and a second yes. | `CLAUDE.md` § Working in this repo |

## B3. Frontier abilities that break the rules

These exist. They work, more or less. **They are not proposed here.**

| Frontier ability | Rule it breaks | Plain verdict |
|:--|:--|:--|
| **AI voice agents phoning or answering sellers** | 3 | Conflict. Also the riskiest legal zone found, and the audience least comfortable with it. |
| **An out-of-hours AI receptionist** that takes a message and books a call-back | 3 | Still a conflict. The sources call it the safest voice pattern. Only you can relax the rule. |
| **Auto-sent AI emails ("AI sales reps")** | 2 | Conflict. The evidence is poor anyway. |
| **Instant on-screen AI offers** | 4 | Conflict. This is what one UK rival launched. |
| **A language model as the valuer** | 5 | Conflict. Models understate their own doubt. |
| **Shipping a new valuation model directly** | 5 | Conflict. Measure on the hold-out first. |
| **An inbox owned by an agent** | 2, 8 | Conflict with "read-only, drafts only". |
| **Browser agents on Rightmove or Zoopla**, or community tools that return "Rightmove" data | 7 | Conflict. The notes judge those tools are "almost certainly scraping". |
| **A WhatsApp bot** | 6, 3 | Unofficial clients: no. The official platform allows narrow bots, but it needs your decision and is AI talking to sellers. |
| **Letting a model guess which deal an email belongs to** | 8 | Conflict. |
| **Rented agent platforms tied to one lab** (Claude Managed Agents, OpenAI Agents API) | 1 | Conflict unless OpenRouter passes them through. Not verified. |
| **The top Claude model on seller data** | Privacy pinning | It cannot run with zero retention. Use the tier below. |
| **AI-staged or AI-edited photos when reselling** | Consumer law | A label does not cure a misleading picture. |
| **"AI-powered" in marketing** | 9 | Conflict. Opendoor and Rightmove both paid for leading with AI claims. |
| **Seeding Reddit to win AI mentions** | Exclusion list | Conflict with "no Reddit posting". Fake mentions are also Google spam now. |
| **Mass-made local pages** | One guide a week | Conflict, and Google now treats them as spam. |

---

## B4. Now: days to a few weeks, low risk

| # | Idea | Evidence |
|:--|:--|:--|
| N1 | Test sets for each AI feature | Strong (method) |
| N2 | Automatic checks on every draft | Strong (code) |
| N3 | Draft replies to sellers who write in | Strong (code gap) |
| N4 | Fewer, richer approval cards | Strong, with a caveat |
| N5 | Bring probate PDF reading back | Medium |
| N6 | A bigger, stricter valuation test set | Medium |
| N7 | A voice kit for the founder | Weak |
| N8 | A night shift for the codebase | Strong (tools), none (results) |
| N9 | Measure AI visibility for free | Medium |

### N1. Test sets for each AI feature

- **What it is:** 20 to 50 real cases per feature, each with the right answer. A script replays them whenever a prompt or model changes. Also stamp every draft with the model and a prompt version.
- **Why now:** Model names change every two to three months. Public benchmarks no longer carry over from year to year. Your own test set is the only stable yardstick. Anthropic published a clear recipe in Jan and Nov 2026. ([Evals guide](https://www.anthropic.com/research/demystifying-evals-for-ai-agents)), ([Grader guide](https://www.anthropic.com/research/building-strong-safety-evaluations))
- **Where it fits:** `scripts/llm-bakeoff.mts` already replays real prompt shapes. Draw cases from `WhatsAppIntake` (the parse, and whether it needed fixing), `ScoutLead.rawPayload` (motivation reads) and `DealEmail` digests. Put the stamp in `FounderAction.metadata`.
- **Evidence:** **Strong** for the method. The fit to Kept is our reasoning.
- **Case against:** Labelling costs your hours. The repo itself says "a labelled sheet is hours of work". Real cases hold personal data, and `LlmCallLog` stores no text on purpose. A test set needs a privacy decision first. **Kills it if:** nobody labels the cases.
- **Rules:** Keep `LlmCallLog` free of text. Run tests on the privacy-pinned route.

### N2. Automatic checks on every draft

- **What it is:** Code checks that run before a draft reaches you. Banned phrases. Any pound figure. The word "AI". A missing StepChange signpost on distress copy. The results show on the card.
- **Why now:** This is not new technology. It is newly important. The CMA said in March 2026 that a firm answers for what its AI writes.
- **Where it fits:** `findBannedPhrases` in `packages/ai/brand-voice.ts:109-121` already exists. Only its own test calls it. Wire it into the marketer crons, `agent-prospecting`, `draft-blog`, and `offer_narrative` in `packages/instant-offer/src/index.ts`.
- **Evidence:** **Strong** for the code fact (checked today). **Medium** for the CMA guidance (read through law-firm notes).
- **Case against:** The phrase list is wrong today. It bans "24-hour", which is now your public promise. Fix that first (Housekeeping 3). Checks catch words, not meaning. A green tick can tempt you to read less carefully.
- **Rules:** Supports rules 4 and 9.

### N3. Draft replies to sellers who write in

- **What it is:** When a seller replies on the tracking page or by email, the system reads it, sorts it, and drafts a reply. The draft is **held**. You edit and send.
- **Why now:** Small models at $0.10 / $0.50 do this sorting and drafting well. And the audit found a gap: inbound replies seem to reach you with no triage at all.
- **Where it fits:** `apps/web/app/api/track/[token]/reply/route.ts:96-127` tags a card `workflow: 'vendor_reply_triage'`. No code reads that tag (checked today). `DealEmail.needsReply` is detected but nothing drafts against it. Reuse the `approve_outreach_draft` card and `OutreachHold`. Push to Gmail with `draftInGmail`.
- **Evidence:** **Strong** for the gap. **Medium** for model skill (makers' own tests).
- **Case against:** A seller's message is untrusted text. It could steer what gets drafted. A wrong-tone draft to a bereaved person is worse than a slower human reply. Volume may be too low to repay the build. **Kills it if:** you rewrite most drafts from scratch.
- **Rules:** Never auto-sent (rule 2). No figure in any draft (rule 4). Only for mail already filed to one deal. Matching is not widened (rule 8).

### N4. Fewer, richer approval cards

- **What it is:** Group look-alike cards. Make each card show what changed, why, the source quote, and the check results from N2. Record whether you followed the desk's suggestion.
- **Why now:** A May 2026 study found people approved about 93% of per-action prompts. Review only protects when each item is worth reading. ([Containment study](https://www.anthropic.com/research/how-we-contain-claude))
- **Where it fits:** `founder_desk` in `apps/api/app/cron/pipeline-summary/route.ts:335-345` writes its call to `metadata.desk`. It keeps no history of what you then did. `FounderAction.status` and `resolvedAt` already exist to compare against.
- **Evidence:** **Strong** for the 93% figure. But it was measured on coding-tool prompts. Carrying it over to email approvals is our reasoning.
- **Case against:** More on each card means more to read. Grouping can hide one bad item inside a good batch. The repo's "24 pending, 0 resolved" figure is undated and may be stale. **Kills it if:** your queue is already short.

### N5. Bring probate PDF reading back, through OpenRouter

- **What it is:** Route the dark probate-grant reader through the shared client. Every field must carry a word-for-word quote from the document. Code rejects any field whose quote is not in the text.
- **Why now:** Current models read PDFs as text plus a picture of each page. Quote-first reading is the maker's own advice for long documents. ([Reduce hallucinations](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations))
- **Where it fits:** `packages/document-pipeline/src/probate-extract.ts` calls Anthropic directly and returns `no_api_key` while that account is unfunded. Mistral text reading is already an option inside it. Output goes to `DocumentExtract`.
- **Evidence:** **Medium.** Whether PDFs pass through OpenRouter unchanged was not verified.
- **Case against:** `docs/LLM-ROUTING.md` calls moving it "a product decision". A home-made quote check is weaker than the citations feature it replaces. Handwriting still needs a person. Probate papers are personal data, and Mistral is one more company handling them. With the court probate feed a placeholder, few PDFs may arrive.
- **Rules:** Mends a breach of rule 1. The file still calls Anthropic directly.

### N6. A bigger, stricter valuation test set

- **What it is:** Grow the hold-out from 209 sales towards about 800. Write the test rules down before testing anything: same sales for both methods, one main measure, report how often the engine refuses, report bias, and keep one untouched slice for confirmation.
- **Why now:** Since 28 Aug 2026 each new Land Registry sale comes with a property ID. Exact matching is now free for new sales.
- **Where it fits:** `scripts/avm-holdout.mts`, `docs/AVM-BACKTEST.md`, `AvmSnapshot`.
- **Evidence:** **Medium** for the data change. The precision figures in A8 are the notes' own simulation, not a published source.
- **Case against:** Older sales are not back-filled, so they still need address matching. A bigger test set costs build time and proves nothing by itself. The simulation assumes errors are independent. Real ones cluster by area and month.
- **Rules:** Measurement only. The method stays frozen (rule 5).

### N7. A voice kit for the founder (buy, don't build)

- **What it is:** Three bought tools. A dictation app for every text box. An assistant voice mode for "talk to my inbox". Read-aloud for long text. Then one small build: dictate deal notes straight into the dashboard.
- **Why now:** Dictation apps cost about $8 to $12 a month. All three big assistants gained full voice modes in mid-2026. Speech-to-text costs about a penny a minute.
- **Where it fits:** `apps/app/app/api/transcribe/route.ts` already turns your feedback voice notes into text. Extend the same path to notes on `DealActivity`.
- **Evidence:** **Weak.** Accuracy claims are written by the sellers. The dyslexia evidence came from vendor guides, not studies that were read.
- **Case against:** Cloud dictation sends everything you say to another company, seller details included. One app runs fully on your own machine. Some engines struggle with UK regional accents. Your phone's built-in tools may already do enough. **Kills it if:** the free tools you have are good enough.
- **Note:** The transcribe route calls OpenAI directly, outside the OpenRouter path.

### N8. A night shift for the codebase

- **What it is:** Two things. A **skills folder**: plain-text how-to files that coding agents load when needed ("how to add a cron", "the copy rules"). And **scheduled chores** for a coding agent: a weekly check that the derived docs still match the live site, dependency updates, and a watch for retiring models.
- **Why now:** Skills became a shared standard across makers (Dec 2025; handed to a foundation 22 Oct 2026). Claude Code gained cloud scheduled tasks in 2026. ([Agent Skills](https://www.anthropic.com/news/donating-agent-skills-to-the-agentic-ai-foundation)), ([Scheduled tasks](https://code.claude.com/docs/en/routines))
- **Where it fits:** The "Keeping the derived docs evergreen" rule in `CLAUDE.md`. The docs it names: `docs/brand/KEPT.md`, `docs/marketing/PLAN.md`, `docs/templates/binding-offer-letter.md`.
- **Evidence:** **Strong** that the tools exist. **None** on results for solo founders. That was the thinnest part of the research.
- **Case against:** Scheduled runs start in an automatic mode with every connected service attached unless you trim them. That can include mail, calendar and ads. Auto-fixing pull requests can trigger deploys. Scheduled tasks are a research preview. And every source says the real bottleneck is checking the work, not producing it.

### N9. Measure AI visibility for free, and sharpen the plugin's tool descriptions

- **What it is:** Verify the site in Bing's webmaster tools to see real AI citations. Add a filter for AI assistants in site analytics. Rewrite the four public tool descriptions around the person's situation ("use when someone asks what to do with an inherited house").
- **Why now:** Bing launched free AI citation reports in Feb 2026. OpenAI says the model picks an app from its tool descriptions.
- **Where it fits:** `apps/web` for the verification tag and analytics. `apps/plugin/lib/public-tools.ts:63-66` for the four tools.
- **Evidence:** **Medium.** Official pages, seen as search summaries.
- **Case against:** AI assistants send well under 1% of site traffic. The plugin is reachable only in developer mode, so nobody sees the descriptions yet. You may be measuring a channel that is not there. No rule stops assistants ignoring a listed app.
- **Rules:** No "AI" in public copy (rule 9). The plugin never returns a value (rule 4).

---

## B5. Next: one to three months

| # | Idea | Evidence |
|:--|:--|:--|
| X1 | Upgrade the AI plumbing | Strong (versions) |
| X2 | One job as a "pause for approval" workflow | Medium |
| X3 | An appraisal that looks things up | Medium |
| X4 | Honest value ranges and a measurable "refuse" rule | Medium / Weak |
| X5 | Backtest the lead score with a free label | Weak |
| X6 | One memory page per deal | Medium |
| X7 | Learn from the founder's edits | Weak |
| X8 | A viewing kit that measures and compares | Weak |
| X9 | A legal-pack and lease reader with quoted sources | Weak to Medium |
| X10 | Founder on video, and real mentions | Weak |
| X11 | Letters by post, drafted by AI, approved by you | Medium |

### X1. Upgrade the AI plumbing

- **What it is:** Move `@repo/ai` from AI SDK version 4 to version 7, and the OpenRouter connector from 0.4 to 3.x.
- **Why now:** Version 7 (25 Jun 2026) adds tool loops, tool approvals and stable tracing. The new connector returns the **real cost** of each call. ([npm: ai](https://registry.npmjs.org/ai)), ([OpenRouter connector](https://github.com/OpenRouterTeam/ai-sdk-provider))
- **Where it fits:** `packages/ai/claude.ts`, `packages/ai/package.json`, both apps' `instrumentation.ts`. It would replace the hand-typed price table in `apps/app/app/(authenticated)/admin/llm-usage/page.tsx`.
- **Evidence:** **Strong** for the versions. The notes call OpenRouter working with version 7 "likely but not proven".
- **Case against:** Three major versions in one jump. Version 7 drops an older module format. The new connector needs Node 22 or newer. This client already had one library-shape failure that broke every long marketer call from 12 Sep to 3 Oct 2026 (`docs/LEARNINGS.md:9-45`). Everything works today. **Kills it if:** the newer models run fine on the old library.
- **Rules:** Keeps rule 1. It unlocks X2 and X3.

### X2. One job as a "pause for approval" workflow

- **What it is:** Pick one job. Run it as a durable workflow. Each step saves its progress. The job stops before anything outward, waits for your click, and takes a safe default if you do not answer in time.
- **Why now:** Vercel Workflows became generally available in April 2026. Waiting costs no compute. The job survives new deployments. ([Workflow concepts](https://vercel.com/docs/workflows/concepts))
- **Where it fits:** Best candidates: `apps/api/app/cron/quote-ops/route.ts` (offer PDF, then an `approve_offer` card with a 4-hour expiry), or `lead-appraise`, which timed out from July 2026 (`docs/LEARNINGS.md:333-337`).
- **Evidence:** **Medium.** The mechanics were read in Vercel's docs. The launch date and price came from search summaries. No outside report of it at scale was found.
- **Case against:** `FounderAction` plus `dedupKey` plus heartbeats is a hand-rolled version of the same thing, and it works. The feature is seven months old. Its sister parts (Queues, Schedules) are still beta. Your bottleneck is decisions, not job length. **Kills it if:** the watchdog cards show jobs rarely fail.
- **Rules:** Unattended runs only draft. The approval step must re-check that what you approved is what gets sent.

### X3. An appraisal that looks things up

- **What it is:** Kept's first tool-using agent. Read-only. Before the deep appraisal gives its view, it fetches flood data, planning records, company charges and public notices. Each claim carries its source.
- **Why now:** Tool loops are standard in AI SDK 7. England's flood data has been free and open since 2025. Small models jumped in tool use this year.
- **Where it fits:** `packages/valuation/src/deep-appraisal.ts:232` tells the model to judge six risks "from postcode + known geological knowledge". Tools would wrap the open-data adapters in `@repo/property-data`, plus the Gazette and Companies House sources. Output stays a `review_appraisal` card. Needs X1.
- **Evidence:** **Medium** for the tooling. That it would change your decisions is our reasoning.
- **Case against:** Agents sometimes stop early or say "done" when they are not. Cost per appraisal rises from about £0.06. If any tool touches PropertyData, spend and licence limits apply. **Kills it if:** looked-up facts rarely change a bid-or-walk call.
- **Rules:** The agent challenges the valuation. It never produces or changes the number (rule 5). OpenRouter only (rule 1).

### X4. Honest value ranges and a measurable "refuse" rule

- **What it is:** Two measurements. **First:** use past frozen estimates and later sale prices to set ranges that truly hit their stated coverage, tuned by evidence path (radius, postcode, sector). Refuse when the range is too wide. **Second:** a queue of method candidates, each tested alone: a stacked blend, a tabular foundation model, learned comparable selection, ID-matched comparables.
- **Why now:** Property-specific range papers appeared in 2025 and 2026. Tabular foundation models topped the main benchmark in 2026. Land Registry now publishes property IDs.
- **Where it fits:** `AvmSnapshot`, `apps/api/app/cron/avm-backtest`, `scripts/avm-holdout.mts`, `packages/valuation/src/sqft-comps.ts`.
- **Evidence:** **Medium** for the range method (peer-reviewed, not UK, read as summaries). **Weak** for the rest. No house-price test of the new tabular models was found.
- **Case against:** Ranges need a few hundred matched pairs. The backtest had no reading as of 1 Oct. By your own rule, under 30 matches gives no verdict. Every extra candidate tried on the same 209 sales raises the odds of a lucky win. The best-known tabular model needs a licence, and Python with a graphics card, which this stack lacks. Opendoor shows better tooling does not remove pricing risk.
- **Rules:** Measure on the hold-out. Nothing ships directly. No value without a sale. A language model never gives the number or the range (rule 5).

### X5. Backtest the lead score with a free label

- **What it is:** Freeze each lead's score and inputs at the moment of scoring. Later, read from Land Registry whether that home sold within a set number of months. Then test whether any new scorer beats today's at the top of the list.
- **Why now:** Property IDs on new sales make the match exact from Aug 2026. Small-data models are reported strong on a few hundred rows.
- **Where it fits:** `packages/scouting/src/scorer.ts`, `ScoutLead` (`evalConfigVersion`, `rawPayload`), `packages/scouting/src/calibration-suggestions.ts`.
- **Evidence:** **Weak.** No study of which probate or distressed homes sell was found. The few-label searches never ran. This idea is the notes' reasoning from general practice.
- **Case against:** "Sold to anyone" is not "would sell to Kept". Your own review says every score point must be traceable by a person. A learned score is not. Labels are few. Lead scoring counts as profiling under data law. **Kills it if:** too few leads have aged long enough to show an outcome.
- **Rules:** Measure only. Any learned score sits beside the rule score as advice, never in place of it.

### X6. One memory page per deal

- **What it is:** A short page per deal that the system keeps current. Who is involved. What was said. What is outstanding. What changed. Shown as a "call prep" card before you ring.
- **Why now:** A Nov 2026 study found search plus a model-kept wiki beat search alone (61% vs 53%). Giving each contract its own page lifted graded facts from 41 of 57 to 57 of 57. ([Memory study](https://www.anthropic.com/research/components-of-agent-memory))
- **Where it fits:** Built from `DealActivity`, `DealUpdate`, `Viewing`, `DealEmail` digests and `FounderAction.metadata`. Stored in Postgres with Kept's own read and write tool, so it does not depend on one model maker.
- **Evidence:** **Medium.** One study, by a model maker, on code and legal tasks. Carrying it over to deals is our reasoning.
- **Case against:** A wrong note is replayed into every later run. Notes built from inbound email carry any planted instruction with them. Stale pages mislead. It keeps more personal data for longer, and no retention rules were found in the repo.
- **Rules:** Display-only, like the email digest. Never used to file an email to a deal (rule 8).

### X7. Learn from the founder's edits

- **What it is:** Compare each draft with what you actually sent. Feed a few of your best edits back into the prompt as examples. Track the edit rate per feature as a quality score.
- **Why now:** Stored prompts are now cheap, so long prompts with examples cost little.
- **Where it fits:** `OutreachHold.renderedBody` vs `editedBody`. Guide edits in `apps/app/app/actions/guides/edit.ts`. `FounderFeedback.markedAsTemplate` is written today but nothing reads it.
- **Evidence:** **Weak.** The data exists. No source measured this loop.
- **Case against:** Few edits make a thin signal. An edit made for one seller must not carry that seller's details into other drafts. The saving from stored prompts only applies on Claude routes. **Kills it if:** you rarely edit, or edit differently each time.
- **Rules:** Examples must be stripped of personal detail first.

### X8. A viewing kit that measures and compares

- **What it is:** A phone depth scan at each viewing for a measured plan. Run the viewing photos through the photo screener. Compare its condition score with your partner's on-site score.
- **Why now:** Phone depth sensors are reported as roughly inch-accurate indoors. General vision models describe well and measure badly.
- **Where it fits:** `Viewing.photos` is never passed to a model today. `packages/auctions/src/lot-screener.ts` runs the `property_vision` read. `Viewing.conditionScores` is the human label to compare against.
- **Evidence:** **Weak.** Papers were seen as snippets. No independent test of phone plan apps was found.
- **Case against:** Models misjudged room area by about 43% in one test. One study found photos added little beyond text. Photos inside a seller's home are personal data. It adds work for field partners. **Kills it if:** the photo score rarely matches the partner's.
- **Rules:** A measured area is a record. It does not feed the valuation engine without a hold-out test (rule 5).

### X9. A legal-pack and lease reader with quoted sources

- **What it is:** Read auction legal packs and leases into typed fields. Lease years left. Ground rent. Special conditions. Each field comes with a quoted line and a page. No quote, no field.
- **Why now:** Reading a 300-page pack now costs roughly $1 to $7. Field-level source links are a standard feature of document readers.
- **Where it fits:** `@repo/document-pipeline` (`DocumentExtract`), `AuctionLot`, and the pre-auction checklist in the deep appraisal. It would fill a known hole: short-lease screening has no data source (`docs/LEARNINGS.md:100-104`).
- **Evidence:** **Weak to Medium.** Benchmarks clash by 50 points depending on the test.
- **Case against:** Models add terms that are not there, or take the right-looking value from the wrong clause. Nobody independently checks the source links. The specialist readers sit outside OpenRouter. A solicitor still has to read the pack before any bid. Whether packs can be fetched automatically and lawfully was not researched.
- **Rules:** Rule 1 points to a general model reading the PDF through OpenRouter. That route was not verified.

### X10. Founder on video, and real mentions

- **What it is:** One plain video per weekly guide. You, on camera, answering the question. Plus honest press and honest reviews.
- **Why now:** A May 2026 study of 75,000 brands found YouTube mentions tracked AI visibility more closely than anything else measured.
- **Where it fits:** `GuidePost` (the weekly guide) and `apps/web/lib/site-map.ts`.
- **Evidence:** **Weak.** One vendor study. Correlation, not cause.
- **Case against:** The link may only show that well-known brands are everywhere. Older sellers mostly meet AI through Google, not YouTube. It costs your time. Reddit was the other strong signal, and posting there is on your exclusion list.
- **Rules:** A new channel is strategy-shaped: challenge first, then a second yes (rule 10). No "AI" in copy (rule 9). Distress topics must signpost StepChange and Citizens Advice.

### X11. Letters by post, drafted by AI, approved by you

- **What it is:** A sequence of letters to leads found in public notices. AI drafts and matches the data. You approve every letter.
- **Why now:** Not new technology. It is newly the lowest-risk first contact. Every 2026 fine found hit calls and texts. Post sits outside those rules.
- **Where it fits:** `OutreachCampaign`, `OutreachTemplate`, `OutreachHold`. Letter sequencing is already a planned item in `docs/SOURCING-PLAYBOOK.md:91-94`.
- **Evidence:** **Medium.** ICO pages and industry research, seen as summaries. Cold mail: 0.9% response.
- **Case against:** A letter to a bereaved household can hurt people and the brand. No ICO guidance on marketing from probate or Gazette records was found. The duty to say where you got someone's details was not verified. 0.9% is a low return. **Kills it if:** a legal check says the data source cannot be used this way.
- **Rules:** Held for review (rule 2). No figure (rule 4). The house voice bar applies.

---

## B6. Blue sky: bold, speculative, could change the shape of the business

_These are ideas to argue with, not plans. Each one is strategy-shaped. Under your own rule each needs the case against, a second yes, and a dark launch._

| # | Idea | Evidence |
|:--|:--|:--|
| S1 | A desk agent for every live deal | Weak |
| S2 | Kept's tools inside ChatGPT and Claude | Medium (channel), Weak (leads) |
| S3 | The upfront pack: the fastest-prepared buyer | Weak to Medium |
| S4 | An earned-autonomy ladder, business contacts only | Weak |
| S5 | A valuation lab that knows when to say no | Medium (data), Weak (accuracy) |
| S6 | A flight simulator for hard calls | None gathered |
| S7 | A machine channel for solicitors | Weak |
| S8 | Remote first look | Weak |

### S1. A desk agent for every live deal

- **What it is:** Each live deal gets a standing agent. It has its own memory page, a daily schedule, and read-only tools. By morning it has re-checked charges and notices, read newly filed mail, spotted what is stuck, and laid out your next three moves as cards.
- **How it changes the business:** One person runs a deal flow that normally needs a team. That is "Bet 3" in `docs/DECISION-STACK.md:77-80`.
- **Why now:** The length of task an agent can carry is reported to double about every 3.6 months. The "AI employee" products launched in 2026 are, in practice, one persistent agent with memory and a schedule. **[Medium / Our reasoning]**
- **Where it fits:** It grows out of X2 (pause for approval), X3 (look-up tools) and X6 (memory page). It hands over through `FounderAction` cards, as crons do today.
- **Evidence:** **Weak** for business work. The long-run proof is published by the makers and is mostly coding, where tests say pass or fail.
- **Case against:** Deals stall on decisions and relationships, not legwork. More cards could bury you. Agents stop early and sometimes claim work is done. A wrong memory note repeats every day. Headline multi-agent demos cost $200 to $20,000 per result. **Kills it if:** your queue is already too long to clear.
- **Rules:** Drafts and cards only. It never contacts anyone (rules 2 and 3).

### S2. Kept's tools inside ChatGPT and Claude

- **What it is:** Turn the dark plugin into listed, interactive apps. The inherited-home planner appears as a small screen inside the chat. An adult child asks their assistant "what do we do with mum's house?", and the assistant opens Kept's planner.
- **How it changes the business:** Kept is found at the moment of the question, before any search or any portal.
- **Why now:** One server can now show interactive screens in ChatGPT, Claude, VS Code and Goose. Both ChatGPT and Claude accept submissions. Rightmove, Zoopla and Zillow are already inside ChatGPT.
- **Where it fits:** `apps/plugin` (`lib/public-tools.ts`) and `@repo/kept-tools`.
- **Evidence:** **Medium** that the channel exists. **Weak** that it brings leads. No case study for a service business was found.
- **Case against:** About 15,000 listings exist. Being listed is not being found. Rightmove gets under 0.5% of its traffic from ChatGPT. Kept's planner gives no value figure, which is right, but that makes its hook weaker than a portal's instant estimate. The accepted risks in `docs/mcp/06-go-live.md:136-141` still stand: a draft privacy page, no compliance opinion, and a home-built sign-in with no outside review. A listing ends the dark stage. **Kills it if:** assistants rarely pick small apps without being asked by name.
- **Rules:** No valuation, ever (rule 4). No "AI" in copy (rule 9). Dark until one real user proves the premise (rule 10).

### S3. The upfront pack: the fastest-prepared buyer

- **What it is:** Before the viewing, an agent assembles a sourced file on the home. Title. Charges. Lease terms. Energy certificate. Flood. Planning. Kept hands it to the seller's solicitor on day one.
- **How it changes the business:** "Completion in weeks" becomes built into the process, not dependent on effort.
- **Why now:** The June 2026 reform roadmap points to upfront "sales packs". Voluntary first. Law later, with no date. Reading documents now costs a few dollars. The notes judge that a buyer who builds its own pack "gains speed now". **[Our reasoning]**
- **Where it fits:** X3's look-up tools plus X9's reader. Stored against `LegalStep` and `LegalDocument`, with files in the deal folders that `@repo/google` creates.
- **Evidence:** **Weak to Medium.** The roadmap was read through summaries only.
- **Case against:** Title review is a buy-not-build category now. The solicitor who signs stays liable, and may ignore a pack from a non-lawyer. Official copies cost money, and the Land Registry's access terms were not checked. If binding contracts arrive, every buyer becomes more certain and Kept's edge narrows. **Kills it if:** solicitors will not use it.
- **Rules:** Never "advice". Anything sent to a solicitor is reviewed by you first.

### S4. An earned-autonomy ladder, business contacts only

- **What it is:** The system tracks how often you approve one template unchanged. After a long clean run, it proposes moving that one template, for that one type of business contact, to auto-send. You decide. Sellers are never on the ladder.
- **How it changes the business:** Your review time goes where it matters. Routine trade mail stops queueing.
- **Why now:** Approval rules can now be written as code and tested (AI SDK 7). ([Policy approvals](https://ai-sdk.dev/docs/agents/policy-tool-approvals))
- **Where it fits:** `apps/api/app/cron/_lib/contact-routing.ts` holds the allow-list of business contact types. `OutreachHold` holds the approval history.
- **Evidence:** **Weak.** The tooling is real. No evidence was found that a streak of approvals predicts quality.
- **Case against:** A 93% approval rate can mean tiredness, not quality. This is how a safety rail wears away, one sensible step at a time. An automatic gate missed 17% of over-eager actions in its maker's own test. **Kills it if:** unchanged approval does not mean the draft was right.
- **Rules:** Seller-facing mail stays held, always (rule 2). This idea must never reach individuals.

### S5. A valuation lab that knows when to say no

- **What it is:** Every month, every new sale in England and Wales now arrives with an exact property ID. Build a rolling test set of thousands of sales. Test methods against it all the time. The engine's answer becomes one of three things: a value, an honest range, or "not enough evidence".
- **How it changes the business:** A measured engine that knows what it does not know. In time it could back a trusted report for professionals (`KeyholeReport`).
- **Why now:** The Land Registry ID release of 28 Aug 2026. Tabular foundation models that need no training step.
- **Where it fits:** `scripts/avm-holdout.mts` grows into a standing job beside `avm-backtest`.
- **Evidence:** **Medium** for the data. **Weak** for how accurate it could get.
- **Case against:** Open data holds nothing about condition. You view every home anyway, so extra model accuracy has a capped payoff. It needs Python and a graphics card. Opendoor rebuilt on AI and still wrote down $53m of stock in one quarter. **Kills it if:** the backtest shows the error is driven by condition, which no open data can see.
- **Rules:** The method is frozen. Any change is proven on the hold-out first. No value without a sale (rule 5). Publishing an accuracy figure would also run into rule 9, and the methodology page is hidden today.

### S6. A flight simulator for hard calls

- **What it is:** A voice model plays a seller. A grieving executor. Someone facing repossession. You and your partners practise against it. The AI never speaks to a real seller.
- **How it changes the business:** New partners reach your standard on calls sooner. The human side scales.
- **Why now:** Live voice models cost about $0.05 a minute.
- **Where it fits:** Stand-alone. It needs no seller data.
- **Evidence:** **None gathered.** This is our own idea, built on the prices in the notes. No source says rehearsal like this works.
- **Case against:** A simulated seller is a stereotype. It could train the wrong instincts. The 1 to 2 second pause still feels odd. Building it from real seller calls would be a new use of personal data.
- **Rules:** It respects rule 3. People still make every real call.

### S7. A machine channel for solicitors

- **What it is:** Add a solicitor role to the plugin's sign-in side. A solicitor's software, or their own AI, can ask "what is outstanding on this deal?" and get a status back. Fewer chasing emails.
- **How it changes the business:** Legal chasing becomes machine to machine.
- **Why now:** AI title and lease review is now normal in UK conveyancing. The standard for agents talking to agents reached version 1.0 in 2026.
- **Where it fits:** `apps/plugin/lib/pro-tools.ts` already has agent and investor roles. The `legal-chaser` cron and `LegalStep` hold the status.
- **Evidence:** **Weak.** No sign was found that conveyancing tools can call an outside server. The repo notes that Orbital has "no buyer-side API".
- **Case against:** There may be nobody on the other end yet. Agent identity standards are still drafts. Deal status is sensitive. The home-built sign-in has had no outside security review.
- **Rules:** Status and dates only. No figures (rule 4).

### S8. Remote first look

- **What it is:** Before spending on a lead, score how the home looks from the street. At the first visit, capture a 3D record. Use both to decide which homes to view first.
- **How it changes the business:** You spend viewing time and data credits on the best leads first.
- **Why now:** Opendoor says about 80% of its home assessments used to need an employee. A 2026 paper found a model agreed well with experts on street images. A consumer 360 camera now makes walkable 3D scenes.
- **Where it fits:** A triage flag on `ScoutLead.rawPayload`. A 3D record on `Viewing`.
- **Evidence:** **Weak.** The street-image test used only 25 images.
- **Case against:** Street images can be years old. Every commercial condition score found is US-trained. The licence terms for street imagery were not researched. How Opendoor does it was not found.
- **Rules:** "We view every property" is a public promise. This can order the viewings. It can never replace one.

---

# C. Housekeeping the research turned up

_These are findings about the system as it is. They are not new ideas. Items marked "checked today" were confirmed in the repo while writing this report._

### 1. The default model is reported to retire on 30 Nov 2026

- **What:** `anthropic/claude-sonnet-4.5` is the default "strong" model and the head of the strong fallback chain. `anthropic/claude-haiku-4.5` plays the same part for fast work. **[Code, checked today]** (`packages/ai/routing.ts:164-165`, `:196-207`)
- **The date:** Anthropic's own page says Claude Sonnet 4.5 retires on Anthropic-run platforms on **30 Nov 2026**. **[Strong]** ([Deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations))
- **Not confirmed:** whether OpenRouter keeps serving it. The notes say partner clouds set their own dates, so it "may keep serving it … for a while, but that is not guaranteed".
- **Also:** Claude Haiku 4.5 is past its earliest retirement date and "can be deprecated at any time", with at least 60 days' notice. **[Strong]**
- **What would happen is not known.** The repo's own comments disagree. `routing.ts:146-148` says an unknown model id is "a hard 400 that takes the feature down". `packages/ai/fallback.ts` says OpenRouter answers 404 for an id it cannot serve, which the code treats as "try the next model". This was not tested.
- **If it does fall back,** seller-facing words would be written by `z-ai/glm-5.2` or `moonshotai/kimi-k2.6`. `docs/LLM-ROUTING.md:112-129` chose to keep those words on Claude.
- **What to watch:** rows ending `_via_fallback` on `/admin/llm-usage`.
- **Urgency:** high. Five days.

### 2. Moving to the newest models is more than a name swap

- **What:** The newest Claude models reject the `temperature` setting. They return an error when code forces a tool call, which the notes say is a common way older library versions produce structured answers. **[Strong]** ([What's new in Fable 5.2](https://platform.claude.com/docs/en/models/fable-5-2/whats-new-fable-5-2))
- **Where it bites:** `packages/ai/claude.ts` sets `temperature` on every call (`:370`, `:613`). **[Code, checked today]**
- **Certainty:** the notes say plainly, "I did not test it." Whether OpenRouter drops the setting quietly or passes the error on is unknown.
- **Model names:** `routing.ts:143-153` holds names for a newer generation, kept off by default because their OpenRouter names "could not be verified from the build sandbox". The notes confirm the top model is listed on OpenRouter. They do not confirm the exact names for Sonnet 5.5 or Haiku 5.5.
- **Safe path:** the shadow lane that already exists. Set the new model as a shadow on one feature first.

### 3. The brand-voice prompt contradicts the public promise

- **What:** `packages/ai/brand-voice.ts:24` states "Same-day response". Lines `:60-61` and `:96` ban the phrase "24-hour". **[Code, checked today]**
- **The clash:** `CLAUDE.md` and `docs/brand/KEPT.md:139` give the promise as a **24-hour response** (founder, 18 Oct 2026).
- **Reach:** every marketer prompt imports this block.
- **Certainty:** the notes say which wording is intended for generated copy "is unresolved in the repo". It needs your call.
- **Urgency:** high, and tiny to fix. It also blocks idea N2.

### 4. The AI library is three major versions behind

- **What:** `packages/ai/package.json` pins `ai ^4.1.52` and `@openrouter/ai-sdk-provider ^0.4.0`. **[Code, checked today]**
- **Current:** `ai` is reported at 7.0.181 (23 Nov 2026). The OpenRouter connector is at 3.1.0 and needs version 7, Node 22 or newer, and the newer module format. **[Strong, npm registry]** ([npm: ai](https://registry.npmjs.org/ai)), ([npm: connector](https://registry.npmjs.org/@openrouter/ai-sdk-provider/latest))
- **Urgency:** medium. See idea X1 for the case against rushing.

### 5. Vercel's docs call Cron Jobs a legacy feature

- **What:** Vercel's docs are reported to say: "Cron Jobs are a legacy feature and will be migrated to Schedules in the future." **[Strong, read through the Vercel docs tool]** ([Schedules](https://vercel.com/docs/schedules/configuration))
- **Where:** `apps/api/vercel.json` declares 25 crons. **[Code, checked today]**
- **Certainty:** no removal date is given. The replacement's command-line tool is in beta. The move is described as a rename in the config file. ([Migration guide](https://vercel.com/docs/schedules/migrate-from-cron-jobs))
- **Urgency:** low. Watch, do not rush.

### 6. The MCP standard changed in a breaking way in July 2026

- **What:** The 28 Jul 2026 revision removed sessions and the opening handshake, and marked the older sign-up method for apps as deprecated. Old behaviour has a 12-month minimum life. **[Strong]** ([MCP changelog](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/changelog.mdx))
- **Where:** `apps/plugin`. It already uses the newer server library (`@modelcontextprotocol/server ^2.2.0`). **[Code, checked today]**
- **To check:** its sign-in has a `register` route (`apps/plugin/app/oauth/register`), which is the older sign-up method. Whether the plugin leans on anything removed was **not checked**.
- **Cheap win named in the notes:** list tools in a fixed order with a cache hint.
- **Next change:** the next version of the standard is due 30 Mar 2027. ([Release cycle](https://blog.modelcontextprotocol.io/posts/mcp-release-cycle/))
- **Urgency:** medium. Plan before mid-2027.

### 7. `.mcp.json` still points at the broken old server

- **What:** `.mcp.json` starts `@repo/mcp-server`. **[Code, checked today]**
- **Why it matters:** the Oct audit says it "crashes on boot" and "returns lead phone numbers and emails to any caller" (`docs/mcp/01-audit.md:24-27`). It failed to connect in the research session, and again while this report was written.
- **Urgency:** medium. Remove it or point it somewhere safe.

### 8. Smaller items

- **A direct Anthropic call survives.** `packages/document-pipeline/src/probate-extract.ts` still calls `api.anthropic.com`. It is dark while that account is unfunded. `@anthropic-ai/sdk` is still a listed dependency, though no file imports it. Both sit against the OpenRouter-only rule. **[Code, checked today]**
- **The spend page uses a hand-typed price table.** Unknown models are costed as Sonnet. The newest models have no row. (`apps/app/app/(authenticated)/admin/llm-usage/page.tsx:20-41`) **[Code, checked today]**
- **Inbound seller replies appear to arrive with no triage.** The tag is written and never read. See idea N3. **[Code, checked today]**
- **`linkedin_topics` asks for "the past 7 days" of news and is given none.** It leans on the model's memory. (`apps/api/app/cron/marketer-weekly/route.ts:108-120`) **[Code]**
- **`CLAUDE.md` says long routes use 300 seconds.** Fourteen routes use 800. **[Code, checked today]**
- **Privacy pinning deserves a look.** OpenRouter's 22 Nov notice about hosts not keeping their data promises argues for naming exact hosts on any route that sees seller data. The routing table already supports that (`providerOnly`). The Oct audit also says data agreements are needed (`docs/mcp/01-audit.md:80`). **[Medium / Our reasoning]**
- **A zero-retention route cannot reach the top Claude model.** What happens if one is set that way was not checked. **[Our reasoning]**
- **Code with no caller:** `comp_rationale`, `scoring_rationale`, `@repo/knowledge-base`, `findBannedPhrases`, the `markedAsTemplate` flag. Wire each one or delete it. **[Code]**
- **For the knowledge base,** the research suggests a simpler route. Under about 200,000 tokens, put the docs in a stored prompt and skip the search layer. **[Strong, from 2024]**
- **Wired but unproven in live use:** the deal email log ("Not yet used against a live Google account", 23 Nov), and the Savills and Clive Emson auction sources (entry addresses never verified). **[Code]**
- **No bake-off result is recorded.** `docs/llm-bakeoff/` does not exist. **[Code, checked today]**
- **Price dates, if you ever route to Google models:** Gemini 4 Carbon doubles on 1 Dec 2026. Gemini Flash promotions end 31 Dec 2026. **[Medium]**

---

# D. What could not be verified

**How the research was limited**

- **Most pages could not be opened.** Only Anthropic's sites, the MCP blog, the npm registry, raw GitHub files and Vercel's docs tool worked.
- **The search allowance ran out.** Each researcher got roughly 22 to 38 searches, then stopped. Some planned searches never ran.
- **Result:** Anthropic, MCP and Vercel coverage is strong and first-hand. OpenAI, Google and everyone else is thinner. The notes call this "a sourcing artefact, not a judgement on importance".
- **Voice, vision, documents, valuation, marketing, property and regulation:** not one source page was read in full. All of it is search summaries.

**Specific things not confirmed**

| Item | Status |
|:--|:--|
| Whether OpenRouter keeps serving Claude Sonnet 4.5 after 30 Nov | Not confirmed |
| Whether structured answers on the old library work with the newest Claude models | Not tested |
| OpenRouter's zero-retention enforcement, PDF inputs, caching pass-through, and the 22 Nov notice | Site could not be opened |
| A blog title "OpenRouter is Joining Stripe" | Unverified. Seen in a search index only. |
| OpenAI's visual Agent Builder and Evals ending 30 Nov 2026 | Search summary only. Re-verify. |
| Prices and release dates for OpenAI, Google and others | Two price lists agree. Makers' pages not opened. |
| A "100%" score for GPT-6.2 on one reasoning test | The notes call it suspect |
| Vercel Workflows launch date, price and limits | Search summaries. Two rate tables conflicted. |
| That an ICO update in Jan 2026 requires telling callers about AI transcription | Uncorroborated. Vendor blogs only. |
| That Ofcom will require a 10-second AI disclosure on calls | Uncorroborated. No Ofcom document found. |
| Whether one voice vendor (Hume) is shutting its service | Conflicting. Verify before building on it. |
| UK launch date for ChatGPT ads | Sources conflict: May, June or August 2026 |
| Outside studies on many-agent systems | Second-hand. The papers were not read. |
| Whether the ICO's final guidance on automated decisions, and RICS's valuation guidance, are published | Not confirmed |
| Whether the Leasehold Reform Bill has had its first reading | Sources conflict |
| Whether the 2026 material-information guidance for listings is out | Not confirmed |
| The simulation behind the "10% to 15%" reading | Own calculation. Script not saved. |

**Legal questions with no answer in the notes**

- Whether a company that **buys on its own account** must join a redress scheme.
- Whether it must register with HMRC for **anti-money-laundering** supervision. The notes' unverified background is that both duties attach to "estate agency work", so a principal buyer is generally outside them, but a firm that passes sellers to investors is inside. **This needs a legal check**, more so where deals are assigned or introduced to others.
- Whether data from the probate register, Land Registry or the Gazette may be used for marketing, and on what terms.
- Whether an AI voice counts as an "automated call" in law.
- Whether recording a call for transcription needs more than a notice.

**Topics that were thinly covered**

- **Browser agents as products.** Which exist, what they cost, how often they finish real web jobs, how sites block them, and UK law on them.
- **Generative media.** Image models, virtual staging, avatars, voice cloning, and UK rules on property images.
- **Wearables and smart glasses.** Not researched at all.
- **Parts of marketing.** Google's and TikTok's automated ad products. AI-made versus human-made ads. AI receptionists. Print-and-post services.
- **Few-label lead scoring.** No searches ran. Everything in X5 is reasoning.
- **Solo-founder practice.** The notes call this their weakest part. The evidence is one AI lab describing itself.
- **Also thin:** time-series forecasting for house prices, satellite and map-based models, UK phone numbers for voice platforms, how the big models now cite PDFs, and vector search on Kept's database host.
- **Practitioner voices.** Independent writers on testing and security could not be read. The guidance here leans heavily on one lab.

**Things the repo could not tell us**

- The live routing table. Real spend. Real success rates.
- How long the action queue is today.
- How many deals, viewings, emails and calls flow each week.
- Whether the backtest has produced a reading since October.
- Which keys are set in production.

---

# E. What to do first

**Ranked. The few things most worth doing.**

| Rank | Do this | Why first |
|:--|:--|:--|
| **1** | **Defuse the model retirement and fix the brand-voice prompt** (Housekeeping 1, 2, 3) | It has a date: 30 Nov. Both are small. One protects seller-facing words. The other stops prompts teaching the wrong promise. |
| **2** | **Build the test sets** (N1) | Every later model or prompt change is a guess without them. It is the valuation discipline, applied to the AI. |
| **3** | **Close the reply loop with better cards** (N2, N3, N4) | It attacks the bottleneck the repo itself names: decisions, not drafts. |
| **4** | **Grow the valuation test set, then measure honest ranges** (N6, then X4) | It respects the freeze. It turns "12.3%" into a number you can lean on. Nothing ships. |
| **5** | **Upgrade the plumbing, then run one "pause for approval" job** (X1, then X2) | It unlocks tool use and real cost tracking. Do it after rank 2, so the test sets catch breakages. |
| **6** | **Try the voice kit** (N7) | No build. A personal payoff within a day. Easy to drop. |

**One blue-sky idea worth exploring dark:** the **upfront pack** (S3). It fits the public promise. It follows the direction of the 2026 reforms. It reuses parts from the Next list.

**What to leave for now**

- The earned-autonomy ladder (S4). The evidence on approval fatigue cuts against it.
- Anything in table B3.

---

## Conclusion: what this changes

- **The frontier's bottleneck is now Kept's bottleneck.** Every lab write-up ends at the same place: producing work is cheap, and **checking it is the scarce thing**. Kept's review queue is not a quirk of a small firm. It is the same problem the largest AI teams are solving. Their answers are public, and they are mostly plain ones: fewer and richer approvals, hard rules in code, real test cases.

- **Your rules are your compliance position, not a handicap.** "A person approves", "no figure before viewing" and "read-only mail" point the same way as the ICO's draft guidance, the CMA's guidance and the security research. The cost of those rules is your time. So the best engineering spend is whatever gives that time back without removing the person.

- **The edge is in the records, not the model.** Models are level within noise and change every few months. The lasting asset is what Kept already stores: an estimate frozen beside a later sale price, a draft beside your edit, a suggestion beside your decision. No UK quick-sale firm was found publishing measured results. Kept could be the one that measures.

- **Four facts would change this picture.** A real backtest reading. The true length of the action queue. How OpenRouter treats a retired model. And a legal answer on redress and anti-money-laundering registration. None of them could be found from where this research sat.
