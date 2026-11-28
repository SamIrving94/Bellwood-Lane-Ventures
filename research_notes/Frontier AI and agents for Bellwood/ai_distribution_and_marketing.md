# AI distribution and marketing: how people find services through AI assistants, and what has evidence behind it (as of 25 Nov 2026)

> **Method note — read before relying on any figure.**
> - Compiled 25 Nov 2026 from live web searches. Time window Dec 2025 – Nov 2026; older items are labelled **background**.
> - **No source page was opened.** Page fetching was blocked in this session (openai.com, searchengineland.com and ofcom.org.uk all failed to resolve; they need allowing in the session's network settings). Every finding below comes from **search-result summaries**, and each URL is the result the summary pointed to. Treat exact figures as "reported by", and check the primary page before quoting.
> - **The shared web-search budget ran out after about 38 searches.** Several key questions are therefore only part-answered. These are listed under each section's Gaps, not filled from memory.
> - Evidence tags used: **[Official]** = platform/regulator's own page; **[Research]** = regulator or academic survey; **[Vendor study]** = a tool vendor's own data study (sample stated where known); **[Vendor claim]** = a seller's marketing figure; **[Secondary]** = trade press or blog reporting someone else's data; **[URL match uncertain]** = the figure came from a search summary and I could not pin it to one specific result.
> - Geography is UK only where stated. Most citation and ad-performance studies are US or global.

## 1. AI search and "generative engine optimisation": how assistants pick sources, what raises citation, llms.txt, UK behaviour by age, measurement, and Google's policy

### Takeaway
Google's own position (15 May 2026) is that optimising for AI Overviews and AI Mode **is ordinary SEO**: same index, same ranking systems, no special files or markup needed, and tactics built to game AI answers are now spam. The best 2026 data says **llms.txt has no measurable effect**, while **off-site brand mentions (YouTube, Reddit, news) correlate with AI visibility far more than backlinks do** — correlation, not proven cause. In the UK, **54% of adults use AI tools but use skews heavily young**; older adults mostly meet AI passively through Google's AI Overviews, and AI assistants still send **well under 1% of site traffic**.

### Cited Findings

**How the assistants choose and cite sources**
- **[Official, 15 May 2026]** Google published "Optimizing your website for generative AI features on Google Search". It says generative AI features draw on the same Search index and the same ranking systems as classic results, and frames "AEO/GEO" as still SEO. — [Google Search Central guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide); [Search Engine Journal](https://searchenginejournal.com/googles-new-ai-search-guide-calls-aeo-and-geo-still-seo/575026); [Search Engine Land](https://searchengineland.com/google-publishes-guide-on-optimizing-for-generative-ai-features-477671)
- **[Official, 15 May 2026]** The guide's "mythbusting" list says site owners do **not** need: machine-readable/AI text files (llms.txt), special markup or Markdown versions, content rewritten "for AI", or pages chasing every long-tail query variant. Structured data is not required. Seeking inauthentic "mentions" "isn't as helpful as it might seem". — [Google Search Central guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide); [Semrush summary](https://www.semrush.com/blog/google-publishes-generative-ai-search-guide/)
- **[Secondary, May 2026]** The guidance covers AI Overviews and AI Mode, "but not necessarily" the Gemini app. — [Practical Ecommerce](https://practicalecommerce.com/google-says-ai-optimization-is-just-seo)
- **[Official]** Google says AI Overviews only show when its systems judge them additive to classic Search, so they often do not trigger. — [Google: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- **[Secondary, May 2026]** Google has still not given site owners separate controls for AI Overviews / AI Mode versus classic results. — [PPC Land](https://ppc.land/googles-new-guide-for-ai-search-what-seo-really-needs-now/)
- **[Vendor study, background — Aug 2025; 15,000 prompts]** Ahrefs found only **12%** of URLs cited by ChatGPT, Gemini and Copilot rank in Google's top 10 for the same prompt. Its explanation is "query fan-out": assistants search many rewritten versions of the question. Google AI Overviews are the exception: an earlier Ahrefs study found **76%** of AI Overview citations came from top-10 pages. — [Ahrefs](https://ahrefs.com/blog/ai-search-overlap/)
- **[Secondary roundup, 2026]** What gets cited "depends almost entirely on the platform and the prompt". ChatGPT cites the most sources per answer (18.2). Among social platforms, Reddit takes 39.87% of citations and YouTube 25.88%. — [BuzzStream](https://www.buzzstream.com/?p=12233)
- **[Secondary, Aug–Sep 2026, citing Ahrefs Brand Radar; likely US-weighted]** Reddit is about **16.7–16.8%** of ChatGPT citations; Wikipedia about 7.0%; consumerreports.org about 3.7%. YouTube is about 31.2% of Perplexity's citations. — [Obsurfable, Aug 2026](https://obsurfable.com/resources/reports/top-domains-cited-by-llms-august-2026); [Ahrefs: most-cited domains](https://ahrefs.com/blog/top-10-most-cited-domains-ai-assistants)

**What 2026 studies say increases citation**
- **[Vendor study, 26 May 2026; 75,000 brands]** Ahrefs: branded web mentions correlate **0.664** with AI Overview visibility, against **0.218** for backlinks. **YouTube mentions** (brand in title, transcript or description) were the strongest single signal at about **0.737** (Spearman). — [Business Wire press release](https://www.businesswire.com/news/home/20260526119691/en/Across-75000-Brands-YouTube-Mentions-Are-the-Strongest-Signal-of-AI-Visibility-New-Ahrefs-Report-Reveals); [The Next Web](https://thenextweb.com/news/ahrefs-youtube-mentions-ai-visibility-brand-search)
- **[Vendor study, reported Nov 2026; 10,000 US brands]** A later Ahrefs cut of seven mention types found **Reddit mentions** correlated **0.75** with AI mentions, ahead of news (0.67) and TikTok (0.60). — [Web Traffic News](https://webtrafficnews.com/briefs/ahrefs-finds-reddit-mentions-track-ai-visibility-most-closely)
- **[Vendor study, June 2026]** Semrush with Kevin Indig: **61.7%** of AI citations are "ghost citations" — the page is linked but the brand is not named in the answer. — [AuthorityTech write-up](https://authoritytech.io/blog/ai-citations-ghost-references-brand-visibility-2026)
- **[Official, 15 May 2026]** Google updated its spam policies the same day as the guide. Tactics built to manipulate AI Overviews or AI Mode — fake mentions, scaled pages aimed at fan-out queries — are now covered by the spam policies. — [PPC Land](https://ppc.land/google-spam-policies-now-officially-cover-ai-overviews-and-ai-mode-in-search)

**llms.txt — status and real effect**
- **[Vendor study, May 2026 data; 137,210 domains]** Ahrefs: 28% of domains publish an llms.txt (an upper bound — Ahrefs' customers skew technical). Of about 38,000 with a valid file, **97% got no requests for it at all** in May 2026. — [Ahrefs](https://ahrefs.com/blog/llmstxt-study/); [Search Engine Journal](https://searchenginejournal.com/97-of-llms-txt-files-got-no-requests-ahrefs-data-shows/579478)
- **[Vendor study; ~300,000 domains]** SE Ranking found no statistically significant link between having llms.txt and being cited by AI. — [Search Engine Journal](https://www.searchenginejournal.com/llms-txt-shows-no-clear-effect-on-ai-citations-based-on-300k-domains/561542/)
- **[Official, 15 May 2026]** Google lists llms.txt among things you do not need for AI Overviews or AI Mode. — [Google Search Central guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- **[Secondary]** Write-ups report that Chrome's Lighthouse guidance says Google Search does not use the file and it neither helps nor hurts. — [Optimizely field notes](https://www.optimizely.com/field-notes/articles/does-llms-txt-work/) [URL match uncertain]

**How far UK behaviour has shifted, by age**
- **[Research; Ofcom Adults' Media Use and Attitudes 2026; 7,533 UK adults 16+; fieldwork Sep–Nov 2025; published spring 2026]** **54%** of UK adults use AI tools such as ChatGPT, Copilot or Gemini. By age: **79% of 16–24s**, **74% of 25–34s**. — [Ofcom](https://www.ofcom.org.uk/media-use-and-attitudes/media-habits-adults/passive-social-media-use-ai-companionship-and-online-side-hustles-uk-adults-media-and-online-lives-revealed); [IBC](https://www.ibc.org/distribution-consumption/news/ai-use-rivals-social-media-activity-in-uk-adults-ofcom-finds/23138)
- **[Research; Ofcom Technology Tracker 2026, Ipsos; 4,033 adults; reported Sep 2026]** 48% of adult UK internet users used generative AI tools in the past 12 months. **23%** had dealt with a customer-service AI chatbot. (Lower than the 54% above because the base and question differ.) — [ISPreview](https://www.ispreview.co.uk/index.php/2026/09/ofcom-1-in-12-uk-adults-use-ai-to-help-manage-their-telecoms-services.html)
- **[Research; Ofcom News Report, 15 Sep 2026]** 21% of UK adults used AI for news in the past month; ChatGPT was the top tool at 13%. Use peaked at **37% among 25–34s** and was "significantly" lower above 55. — [Ofcom](https://www.ofcom.org.uk/media-use-and-attitudes/attitudes-to-news/one-in-five-brits-using-ai-to-keep-up-with-news); [LBC](https://www.lbc.co.uk/tech/ofcom-report-ai-news/)
- **[Research; Ofcom Online Nation 2025, published Dec 2025; Similarweb panel]** ChatGPT had **1.8bn UK visits in Jan–Aug 2025**, up from 368m a year earlier; 252m in August 2025 alone (+156% year on year). Ofcom called it "already the second-largest search service" in the UK. Google Search is still used by **82% of adults**, about 3bn searches a month. — [Ofcom](https://www.ofcom.org.uk/media-use-and-attitudes/online-habits/from-apps-to-ai-search-how-the-uk-goes-online-in-2025); [Mobile World Live](https://www.mobileworldlive.com/ai-cloud/uk-users-turning-to-ai-search-with-chatgpt-dominating/)
- **[Research; same Ofcom report, Dec 2025]** About **30% of keyword searches return an AI overview**, and **53%** of UK people say they often see AI summaries. Ofcom notes much of this is passive exposure inside ordinary search, and reports early evidence that people who see AI summaries click through less. — [Ofcom](https://www.ofcom.org.uk/media-use-and-attitudes/online-habits/from-apps-to-ai-search-how-the-uk-goes-online-in-2025)
- **[Research; Reuters Institute Digital News Report, June 2026 — news use only]** Weekly use of AI chatbots for news rose from 7% to 10% globally. 18–24s: 17%; 55+: 5%. The **UK is bottom of the table at 4%** (South Korea 14%). Only **6%** in the UK trust news results from AI chatbots, against 20% globally. Press Gazette reports chatbot news use is not rising in the UK or US. — [Reuters Institute](https://reutersinstitute.politics.ox.ac.uk/digital-news-report/2026/dnr-executive-summary); [The Decoder](https://the-decoder.com/more-people-get-news-from-ai-chatbots-but-trust-remains-low/); [Journalism.co.uk](https://www.journalism.co.uk/dnr-2026-five-key-takeaways-for-uk-news-publishers/)
- **[Secondary; UK]** Authoritas (news queries, 16–22 April 2025, submitted to the CMA) found a click-through loss of almost 50% per query when an AI Overview appears. Google called it "inaccurate and based on flawed assumptions". — [Press Gazette](https://pressgazette.co.uk/media-audience-and-business-data/google-ai-overviews-publishers-report-clickthroughs-authoritas-report/)
- **[Secondary; UK]** Sistrix UK data: when an AI Overview sits at the top, the first organic result's click rate falls from **27% to 11%**. — [Press Gazette](https://pressgazette.co.uk/?p=252619) [URL match uncertain]
- **[Secondary; UK, July 2026]** An AOP study of eight UK publishing groups (about 10.8bn pageviews over six months) found referral traffic falling about 5% a quarter for news publishers and **18% a quarter for consumer/B2B publishers**. Premium publishers only; not representative of small sites. — [Press Gazette](https://pressgazette.co.uk/?p=255125) [URL match uncertain]

**Measuring AI referrals and brand mentions**
- **[Vendor study, global]** SE Ranking Google Analytics data: ChatGPT sent **0.32% of all site traffic in May 2026** (0.23% in April). — [Digital Applied roundup](https://www.digitalapplied.com/blog/ai-referral-traffic-share-2026-gemini-chatgpt-geo-analysis) [URL match uncertain]
- **[Vendor study, global]** Similarweb estimates 770.7m AI referral visits a month (June 2025 – May 2026, +117.4%). ChatGPT's share of visits to AI sites fell from about 76% (June 2025) to about 53% (May 2026). The share of ChatGPT referrals landing on a **homepage** rose from 26–29% to **62–63%** by late May 2026. — [Similarweb](https://www.similarweb.com/blog/marketing/geo/gen-ai-stats/)
- **[Secondary]** Estimates of ChatGPT's share of all AI referrals range from 74.78% (SE Ranking, Jan–Apr 2026) to 95.1% (BrightEdge, Aug 2026) — panels disagree. — [GEOboom roundup](https://www.geoboom.io/blog/ai-referral-traffic-statistics) [URL match uncertain]
- **[Official, Feb 2026]** Bing Webmaster Tools launched an **AI Performance report** (public preview): how often a site is cited in Copilot and Bing AI answers, by page, with the "grounding queries". Free; needs a verified site. — [Bing Webmaster Blog](https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview)
- **[Official, June 2026]** Bing added intents, topics, citation share and a compare view. — [Bing Search Blog](https://blogs.bing.com/search/June-2026/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare)
- **[Secondary, not verified against Google]** Google announced "Search Generative AI performance reports" in Search Console on 3 June 2026. Commentators say they show impressions only, with no citation or grounding-query data. — [Product Hunt post](https://www.producthunt.com/p/rankfender/bing-launched-ai-citation-reporting-5-months-before-google-most-people-didn-t-notice); [Practical Ecommerce](https://www.practicalecommerce.com/bings-improved-ai-performance-section)
- **[Research, Nov–Dec 2025; 600 volunteers, 12 prompts, 2,961 runs]** SparkToro and Gumshoe.ai found that fewer than 1 in 100 repeated runs of the same prompt returned the same list of brands across ChatGPT, Claude and Google's AI. Single snapshots of "AI rank" are therefore unreliable. — [Veza Digital tool review](https://www.vezadigital.com/post/ai-brand-visibility-tools) [URL match uncertain; SparkToro primary not opened]
- **[Secondary]** No independent accuracy benchmark exists for the paid AI-visibility trackers (Profound, Peec, Otterly, Ahrefs Brand Radar); published comparisons are vendor-written or documentation-based. — [Pepper](https://www.pepper.inc/blog/best-ai-search-visibility-tools/); [Superlines](https://superlines.io/articles/best-ai-visibility-tools)

**Google's policy on AI-written content and "scaled content abuse"**
- **[Official; spam policies page last revised 28 Aug 2026]** Scaled content abuse is generating many pages mainly to manipulate rankings, not to help users. It applies whether pages are made by AI, automation, people or a mix. AI use is not itself the test. — [PPC Land](https://ppc.land/scaled-content-abuse/); [Practical Ecommerce](https://www.practicalecommerce.com/google-spam-policies-explained)
- **[Secondary]** Google ran spam updates in **August 2026** and from **24 September 2026**; scaled content abuse was in scope for the September one. Google did not say the August update targeted AI content specifically. — [Search Engine Land spam-update guide](https://searchengineland.com/guide/google-spam-update); [GSQi case studies](https://gsqi.com/marketing-blog/august-2026-google-spam-update-case-studies/)
- **[Secondary, single agency]** One case study describes an "ultra-YMYL" niche site hit by the August 2026 spam update. — [GSQi](https://gsqi.com/marketing-blog/august-2026-google-spam-update-case-studies/)

### Inferences
- **Do the plain things.** Clear, crawlable, people-first pages are what Google says feed AI Overviews and AI Mode. There is no evidence that a special "GEO" layer on the site adds anything.
- **llms.txt is harmless and near-useless.** Keep one if it already exists; do not spend time on it.
- **The measurable lever is off-site.** Being named on YouTube, Reddit and in news correlates with AI visibility. This must be real (press, genuine video, honest forum answers); manufactured mentions are now a Google spam matter.
- **Older sellers mostly meet AI through Google, not ChatGPT.** Use of AI tools drops sharply with age, but AI Overviews reach anyone who searches. Their adult children (25–44) are the heavy assistant users.
- **Expect ChatGPT visitors to land on the homepage.** With 62–63% of ChatGPT referrals hitting homepages, the homepage has to do the job a guide page used to.
- **Measure with free first-party tools and repeated sampling.** Bing's AI Performance report plus GA4 referral filters cost nothing. Any "AI rank" from one prompt run is noise.
- **Programmatic pages built to catch query variants are now higher risk.** Google names fan-out-targeted scaled content as spam. A weekly, researched, human-reviewed guide is on the right side of that line.
- **For property and money topics, assume the strictest reading.** I found no 2026 Google update aimed at YMYL specifically, but the one documented YMYL casualty came from a spam update, not a core update.

### Gaps
- **How ChatGPT search, Perplexity, Claude and Copilot select sources in 2026** — no primary documentation found this session. Background knowledge only (not verified today): Copilot grounds on Bing; ChatGPT search has used Bing and other providers; Claude's web search was reported in 2025 to use Brave.
- **Structured data's effect** — a LinkedIn post reported a study showing no meaningful change after adding schema (AI Overviews −4.6%, AI Mode +2.4%, ChatGPT +2.2%). I could not trace the study. ([post A](https://eg.linkedin.com/in/aymanovesky), [post B](https://pt.linkedin.com/in/hugomss) — one of these.)
- **Freshness** — a secondary roundup says AI-cited pages are about 25.7% fresher than Google's top 10 across ~17m citations (attributed to Ahrefs). Not confirmed. ([GEOboom roundup](https://www.geoboom.io/blog/brand-mentions-vs-backlinks) [URL match uncertain])
- **Reviews and original data as citation drivers** — no 2026 study found before the search budget ran out.
- **Age split for AI *search* specifically in the UK** — Ofcom's figures are for AI tool use and AI news use. No UK figure for "used an AI assistant to find a local service". Ofcom has a "User experiences of GenAI search" study and an "era of answer engines" discussion paper that I could not open ([Ofcom](https://www.ofcom.org.uk/internet-based-services/technology/user-experiences-of-generative-artificial-intelligence-genai-search)).
- **Ofcom Online Nation 2026** — not found; the 2025 edition came out in December, so the 2026 one may be days away.
- **Conversion rate of AI referrals** — no figure retrieved.
- **CMA action on Google's AI Overviews** (strategic market status conduct requirements) — not researched; budget ran out.
- **Princeton/academic GEO papers, Seer, BrightEdge, Profound studies** — not reached.

## 2. Apps inside assistants: ChatGPT apps, Claude connectors, Gemini and Copilot

### Takeaway
ChatGPT's app directory opened to submissions on 17 Dec 2025 and was **folded into a "Plugin directory" on 9 Jul 2026**; a third-party tracker counts about **15,000 listings by mid-Nov 2026**, so being listed is no longer scarce. OpenAI says the model picks an app from its **tool descriptions, conversation context and past usage**, and bans descriptions that steer the model away from rivals. In Claude, **only directory-listed connectors can be suggested in chat**; custom ones cannot. I found **no published lead-generation case study** for a service business.

### Cited Findings
- **[Official, 17 Dec 2025]** OpenAI opened app submissions and launched an in-chat app directory (chatgpt.com/apps). Apps can be invoked by name or from the tools menu. OpenAI said it was testing ways to surface relevant apps automatically from context, and that apps that "resonate" may be featured or recommended. The Apps SDK was labelled beta. — [OpenAI](https://openai.com/index/developers-can-now-submit-apps-to-chatgpt/); [VentureBeat](https://venturebeat.com/technology/openai-now-accepting-chatgpt-app-submissions-from-third-party-devs-launches)
- **[Official]** As of **9 July 2026** the app directory was migrated to the **Plugin directory**. A plugin can bundle skills, apps and app templates; "apps" remain the integrations that connect ChatGPT (or Codex) to outside data and actions. Existing connections were unaffected. — [OpenAI Help Center](https://help.openai.com/en/articles/11487775-apps-in-chatgpt)
- **[Secondary; third-party tracker "OpenApps"]** The directory listed 8,540 apps on 22 Oct 2026, 14,983 on 14 Nov and **15,120 on 16 Nov 2026**. OpenAI publishes no count, and the catalogue definition widened after the July migration. — [FourWeekMBA](https://fourweekmba.com/ai-chatgpt-apps-top-15000-after-a-75-jump-in-just-23-days/)
- **[Official]** Monetisation at launch: apps may link out to the developer's own site or app to complete transactions for physical goods. OpenAI said it was "exploring" more options, including digital goods. A January 2026 developer-forum thread confirmed no in-app digital-goods monetisation then. — [OpenAI](https://openai.com/index/developers-can-now-submit-apps-to-chatgpt/); [OpenAI developer forum](https://community.openai.com/t/chatgpt-app-monetization-apps-sdk/1372343)
- **[Official]** "The model uses tool descriptions to decide when a tool fits a request." OpenAI advises: describe the user's intent, not the implementation; say what the tool does, when to use it, and how it differs from similar tools. The SDK "leans on your tool metadata and past usage". — [OpenAI Apps SDK: plan tools](https://developers.openai.com/apps-sdk/plan/tools); [Apps SDK: user interaction](https://developers.openai.com/apps-sdk/concepts/user-interaction)
- **[Official]** Submission rules forbid descriptions, titles or annotations that manipulate how the model selects or uses other plugins. Descriptions must reflect the plugin's value accurately "without disparaging alternatives". — [App submission guidelines](https://developers.openai.com/apps-sdk/app-submission-guidelines); [App developer guidelines](https://developers.openai.com/apps-sdk/app-developer-guidelines)
- **[Official changelog]** May 2026: docs now recommend declaring an `outputSchema` for tools returning structured content. June 2026: app permission controls added in ChatGPT. — [Apps SDK changelog](https://developers.openai.com/apps-sdk/changelog)
- **[Anecdotal, developer forum]** One developer reports ChatGPT ignored their installed app for non-English queries and recommended competitors from web search instead. Another thread asks whether metadata improves discovery of installed apps; OpenAI has not fully specified unprompted surfacing. — [Forum: localisation](https://community.openai.com/t/tool-discovery-localization-in-apps-sdk/1368352); [Forum: metadata](https://community.openai.com/t/can-app-metadata-and-tool-descriptions-improve-how-chatgpt-discovers-tools-from-installed-apps/1382558)
- **[Secondary aggregators]** ChatGPT weekly users: 900m reported for Feb 2026; OpenAI's 6 Aug 2026 model update is quoted as "Every week, 1 billion people turn to ChatGPT." — [Index.dev](https://www.index.dev/blog/chatgpt-statistics) [URL match uncertain]
- **[Official]** Claude: remote MCP servers are submitted through a portal inside Claude.ai. They are scanned automatically for policy compliance and, by default, listed as a **Community connector**. "MCP Apps" (servers that render interactive UI) follow the same route and need screenshots. — [Claude docs: submission](https://claude.com/docs/connectors/building/submission); [Claude docs: directory](https://claude.com/docs/connectors/directory)
- **[Official]** Directory and custom connectors run on identical MCP infrastructure. The difference is review and discovery: **only directory listings are discoverable inside Claude and can be suggested in chat**. — [Claude docs: directory vs custom](https://claude.com/docs/connectors/building/directory-vs-custom)
- **[Official]** Developers on paid Claude plans can submit plugins that bundle MCP connectors or skills through the same portal. — [Claude blog: build plugins](https://claude.com/blog/build-plugins-for-claude)

### Inferences
- **Listing is table stakes, not distribution.** With ~15,000 ChatGPT listings, an app is found either by name or because its tool descriptions match what the user is asking. The description is the ranking surface.
- **Write tool descriptions around the user's situation.** "Use when someone asks what to do with an inherited house" fits OpenAI's guidance; keyword stuffing or knocking alternatives breaks the rules.
- **Submit the same MCP server to Claude's directory.** It is the same infrastructure, and only listed connectors get suggested in chat.
- **Brand demand still drives invocation.** Calling an app by name is the one reliable trigger, which ties app usage back to off-site mentions (section 1).
- **Free tools fit the monetisation limits.** With only link-out monetisation, a free-tool app that hands off to a website is the supported pattern.

### Gaps
- **UK/EU availability of ChatGPT apps/plugins** — not found. Background, unverified today: apps launched outside the EU in Oct 2025 with EU "to follow".
- **Usage numbers per app, and any lead-generation case study for a service business** — nothing found. No source reported app-level engagement.
- **Ranking inside the Plugin directory** — no documentation found beyond "featured" and "resonates with users".
- **Gemini and Microsoft Copilot** app/agent stores and their MCP support — the search returned nothing; not answered.
- **What "past usage" means** (per-user or global) — not specified in the snippets.

## 3. Agentic commerce and advertising inside assistants

### Takeaway
**ChatGPT ads are now a real, self-serve UK channel** (US paid launch Feb 2026; UK mid-2026; 31 European markets from 18 Aug 2026; ~$1bn annualised revenue per OpenAI), shown only to Free and Go users — but six months in, advertisers have **no reliable benchmarks**. **Google plans ads in AI Mode for the UK in Q4 2026**, served from existing campaigns with no opt-out. Perplexity dropped ads and Anthropic pledged Claude stays ad-free. **Agentic checkout is retail plumbing** (OpenAI has reportedly pulled back from Instant Checkout); I found nothing aimed at high-consideration services.

### Cited Findings

**Ads in ChatGPT**
- **[Official]** OpenAI's "Testing ads in ChatGPT" post sets out the programme; ads show to **Free and Go** tiers only. Plus, Pro and Enterprise see none. — [OpenAI](https://openai.com/index/testing-ads-in-chatgpt)
- **[Secondary — dates conflict]** UK go-live is given as **6 June 2026** (first European market) by PPC Land; one outlet says May 2026 and names Tesco, Hilton, Hiscox and Next as early UK advertisers; a gHacks piece dated 13 Aug 2026 reports expansion to the UK, Mexico, Brazil, Japan and South Korea. — [PPC Land](https://ppc.land/chatgpt-ads-go-live-in-the-uk-as-openai-expands-pilot-beyond-us/); [Enterprise DNA](https://enterprisedna.co/resources/news/openai-chatgpt-ads-uk-global-expansion-business-2026/); [gHacks](https://www.ghacks.net/2026/08/13/openai-expands-chatgpt-ads-test-to-uk-mexico-brazil-japan-and-south-korea/)
- **[Secondary]** A **self-serve Ads Manager beta is open to UK advertisers**. — [Search Engine Land](https://searchengineland.com/openai-opens-chatgpt-ads-manager-beta-to-uk-advertisers-480679); [PPC Land](https://ppc.land/chatgpt-ads-go-live-in-japan-and-south-korea-and-uk-gets-self-serve/)
- **[Official, 18 Aug 2026]** OpenAI is bringing ChatGPT Ads to **31 European markets**, first through its ad-sales team, agencies and tech partners, with self-serve "later this summer". EU rules require explicit consent before ad personalisation. — [OpenAI](https://openai.com/blog/chatgpt-ads-expands-across-europe)
- **[Official, 31 Aug 2026 — localised page]** OpenAI says ChatGPT Ads reached about **$1bn annualised revenue**. — [OpenAI](https://openai.com/uk-UA/index/expanding-access-to-ai-with-chatgpt-ads/)
- **[Secondary/vendor, US]** Pricing: first paid ads in Feb 2026 at about **$60 CPM with a $200k minimum**; about **$25 CPM by May 2026**. At 0.6% click-through that is about $4.17 a click. — [PPC.io](https://ppc.io/blog/chatgpt-ads)
- **[Secondary/vendor, US — figures conflict]** Click-through: Similarweb ~0.68% (May 2026); one pilot 0.91%; other early accounts claim 3.8–4%. Hostinger reported CPMs above $65 and weak CTR. A Canadian agency reported 0.6% CTR and **zero buyers**. Portland Leather said 93% of its ChatGPT visitors were new. — [Kompozy](https://kompozy.io/guides/chatgpt-ads-performance); [PPC.io](https://ppc.io/blog/chatgpt-ads)
- **[Secondary]** OpenAI has published no benchmarks: "6 months into ChatGPT Ads, advertisers still don't know what 'good' looks like." — [Search Engine Journal](https://www.searchenginejournal.com/6-months-into-chatgpt-ads-advertisers-still-dont-know-what-good-looks-like/587583/)

**Ads in Google AI Mode, Bing/Copilot, Perplexity, Claude**
- **[Official, 28 Oct 2026]** Google expanded ads in AI Mode to ten countries (Australia, Canada, India, Kenya, Malaysia, New Zealand, Nigeria, Pakistan, the Philippines, Singapore) and said: "In Q4 2026, we plan to expand to additional locales, including Brazil, Mexico, and the **United Kingdom**." No UK date given. — [Google blog](https://blog.google/products/ads-commerce/ads-in-ai-mode-global/); [Search Engine Roundtable](https://www.seroundtable.com/google-expands-ads-ai-mode-42412.html)
- **[Secondary]** There is no separate AI Mode campaign type. Existing Search, Shopping and Performance Max campaigns are automatically eligible, and advertisers **cannot opt out**. Ads on follow-up turns are US-only so far. — [Search Engine Land](https://searchengineland.com/google-ai-mode-ads-everything-you-need-to-know-494628); [PPC Land](https://ppc.land/advertisers-in-10-more-countries-cant-opt-out-of-googles-ai-mode-ads/)
- **[Official / vendor claim]** Google says AI Max for Search is out of beta with 500,000+ advertisers, and that it helps ads show in AI Mode. "Direct Offers" (discounts inside AI Mode) has been a US pilot since Jan 2026. — [Search Engine Land](https://searchengineland.com/google-ai-max-billions-new-monetizable-searches-483347); [Google UK: AI Mode for marketers](https://business.google.com/uk/think/search-and-video/ai-mode-uk-what-it-means-for-marketers/); [Google: Direct Offers](https://business.google.com/us/accelerate/announcements/direct-offers/)
- **[Secondary, Nov 2026]** Microsoft confirmed ads inside Bing's AI Overviews in all markets except China, building on Copilot ad formats (e.g. Showroom Ads). Microsoft also launched its own "AI Max". — [Search Engine Roundtable](https://seroundtable.com/microsoft-ads-in-ai-overviews-on-bing-42578.html); [Search Engine Land](https://searchengineland.com/microsoft-launches-ai-max-and-new-ad-tools-for-the-agentic-web-era-474939)
- **[Secondary, Feb 2026]** **Perplexity abandoned advertising**, citing user trust. There is no Perplexity ad platform to buy. — [MacRumors, 18 Feb 2026](https://www.macrumors.com/2026/02/18/PERPLEXITY-ABANDONS-AI-ADVERTISING/); [eMarketer](https://www.emarketer.com/content/perplexity-retreat-ads-marks-split-on-ai-monetization-models)
- **[Official, 4 Feb 2026]** Anthropic: "**Claude will remain ad-free.**" — [Anthropic](https://www.anthropic.com/research/claude-is-a-space-to-think); [The Register](https://www.theregister.com/2026/02/04/anthropic_no_advertising_in_claude/)

**Agentic checkout**
- **[Official, background — 29 Sep 2025]** OpenAI launched Instant Checkout with the Agentic Commerce Protocol (ACP): US Etsy sellers first, Shopify merchants "coming soon", single-item purchases, merchants pay a fee. — [OpenAI](https://openai.com/index/buy-it-in-chatgpt/)
- **[Vendor report, Apr–May 2026 — not confirmed by OpenAI]** Checkout.com says OpenAI has moved **away from Instant Checkout** toward merchant-controlled checkout built with its SDK, with ACP widening to product discovery. — [Checkout.com](https://checkout.com/blog/openai-agentic-commerce-shift)
- **[Official, 2026]** Google's Universal Commerce Protocol (UCP) is an open standard: businesses publish capabilities at `/.well-known/ucp`. Backers include Shopify, Etsy, Wayfair, Target and Walmart. On 20 May 2026 Google announced a "Universal Cart" across Search and Gemini; the retailer stays merchant of record. AP2 (Sept 2025) is the payment-authorisation layer. — [Google Developers Blog](https://developers.googleblog.com/en/under-the-hood-universal-commerce-protocol-ucp/); [Google blog, 20 May 2026](https://blog.google/products-and-platforms/products/shopping/shopping-updates-google-marketing-live)

### Inferences
- **Agentic checkout is not relevant to selling a house.** Every named partner and use case is retail. A high-consideration, human-reviewed service has nothing to "check out".
- **ChatGPT ads are testable but unproven.** They reach Free/Go users (likely younger and more price-sensitive). There is no evidence yet for services, and the one hard "zero buyers" report is a warning. A small capped test is defensible; a budget line is not.
- **AI Mode ads arrive by default.** Any UK Google Ads account running Search or PMax will be eligible when the UK switches on. The decision is about monitoring, not opting in.
- **Organic presence matters more on Claude and Perplexity.** Neither sells ads, so the only way in is citations and (for Claude) a directory-listed connector.

### Gaps
- **ChatGPT ad policy for housing, financial or sensitive topics, and for bereaved or vulnerable users** — not found. Needs OpenAI's ad policy page.
- **Targeting options, minimum spend and formats for UK self-serve** — the source page could not be opened.
- **Any service-business or lead-gen results from ChatGPT ads** — none found.
- **Confirmed UK launch date** — sources conflict (May / 6 June / August 2026).
- **Whether AI Mode ads are live in the UK today** — as of the latest result (end of Oct 2026) only "planned for Q4".
- **UCP/AP2 for service bookings** — only a passing hint that UCP covers "service offerings".
- **A low-authority headline claims ads show on 49% of US ChatGPT replies** — unverified ([Tech Insider](https://tech-insider.org/chatgpt-ads-rollout-2026/)).

## 4. Paid social and search with AI: Meta, Google, TikTok; evidence; UK rules; creative testing

### Takeaway
Meta is still heading for **URL-in, campaign-out automation by end-2026**, and adoption of its generative tools is large, but the only independent voices found say **Meta's delivery automation helps while its AI-made creative performs worse than human creative**. In the UK there is **no blanket duty to label AI-made ads**, but the advertiser carries full responsibility for anything an automated tool produces. This section is thin: the search budget ran out before Google Performance Max / AI Max, TikTok and creative-testing evidence could be researched.

### Cited Findings
- **[Secondary]** Meta has said it expects to offer fully AI-automated campaigns by the end of 2026; the automated flow reduces setup to a single input, the business URL. — [Digital Applied](https://www.digitalapplied.com/blog/meta-ai-automated-ads-2026-marketing-guide); [Dataslayer](https://www.dataslayer.ai/blog/meta-plans-full-ai-advertising-automation-by-2026-what-this-actually-means)
- **[Vendor claim — figures not reconciled]** One guide says 4m+ advertisers use Meta's generative AI tools, producing 15m+ AI-enhanced ads a month; an earlier Meta figure was 1m+ advertisers and 15m ads in a month. — [Digital Applied](https://www.digitalapplied.com/blog/meta-ai-automated-ads-2026-marketing-guide); [Social Media Today](https://www.socialmediatoday.com/news/meta-shares-insight-into-the-performance-of-its-ai-based-ad-elements/734328/)
- **[Vendor claim]** Meta: campaigns using AI background generation see **11% higher click-through** on average. — [Social Media Today](https://www.socialmediatoday.com/news/meta-shares-insight-into-the-performance-of-its-ai-based-ad-elements/734328/)
- **[Practitioner, 7 Apr 2026]** An agency reported gains from Meta's non-creative automation but said of Meta's AI creative tools: "We do experiment on a regular basis … and just consistently see worse results." Analysts add Meta has not yet overcome scepticism about AI-made ads. — [Marketing Brew](https://www.marketingbrew.com/stories/2026/04/07/meta-ai-ad-creation); [eMarketer](https://www.emarketer.com/content/meta-ramps-up-genai-powered-ad-creation-marketers-weigh-consumer-trust)
- **[Vendor claim, headline only]** A Meta case study credits AI ads with 20% higher conversion rates for one brand. — [PPC Land](https://ppc.land/meta-case-study-credits-nests-ai-ads-with-20-higher-conversion-rates/)
- **[Official]** Meta's special ad categories are housing, employment, **financial products and services** (which replaced "credit") and social issues/politics. Advertisers must self-declare, and audience restrictions apply. Housing covers sale or rental of residential property, homeowners insurance and mortgage loans. — [Meta developer docs](https://developers.facebook.com/docs/marketing-api/audiences/special-ad-category); [PPC Land](https://ppc.land/special-ad-category/)
- **[Secondary, 18 Mar 2026]** A Reuters investigation found Meta failed about 1,000 times in a week to block illegal financial ads in Britain, despite its 2022 voluntary pledge to allow financial-services ads only from FCA-authorised firms. — [Reuters via The Star](https://www.thestar.com.my/tech/tech-news/2026/03/18/exclusive-meta-vowed-to-stop-illegal-financial-ads-in-britain-it-failed-1000-times-in-a-week); [Meta financial-services policy](https://transparency.meta.com/en-gb/policies/ad-standards/restricted-goods-services/financial-services/)
- **[Official]** ASA: there is **no blanket UK legal requirement to disclose AI use in ads**. The test is whether the audience would be misled without it; a label will not rescue a fundamentally misleading ad. — [ASA](https://www.asa.org.uk/news/disclosure-of-ai-in-advertising-striking-the-balance-between-creativity-and-responsibility.html)
- **[Secondary, 18 Jun 2026]** ASA/CAP guidance on AI content and deepfakes: AI-made ads face the same rules on misleadingness, offence and social responsibility, and advertisers remain responsible "regardless of whether the content was created by a human, an algorithm or an automated platform". — [Lewis Silkin](https://lewissilkin.com/en/insights/2026/06/18/asa-warns-on-ai-generated-content-and-deepfakes-102n4o1)
- **[Industry guide, Feb 2026]** The Advertising Association published a voluntary Best Practice Guide for generative AI in advertising, with an **SME version**, recommending risk-based disclosure. — [Advertising Association SME guide](https://adassoc.org.uk/wp-content/uploads/2026/02/Best-Practice-Guide-for-the-Responsible-Use-of-Generative-AI-in-Advertising_SME-Version.pdf); [RPC](https://www.rpclegal.com/snapshots/advertising-and-marketing/spring-2026/the-advertising-associations-2026-genAI-guide/)
- **[Vendor claim]** Google says AI Max for Search is out of beta with 500,000+ advertisers. — [Search Engine Land](https://searchengineland.com/google-ai-max-billions-new-monetizable-searches-483347)

### Inferences
- **Let the platform automate delivery; keep creative human.** That split matches the only practitioner evidence found, and it fits a plain, honest brand voice.
- **Fully automated creation is a legal exposure, not just a quality one.** Under ASA rules the advertiser answers for whatever the machine writes. Auto-generated claims about speed, price or certainty are the risk.
- **Financial-distress framing is a policy hot spot.** Meta's UK financial-ads enforcement is under press scrutiny; expect stricter review, not looser.
- **AI is safest in the testing loop, not the final ad.** Use it to draft variants and angles, with a person choosing and checking what runs.

### Gaps
- **Not researched (search budget exhausted):** independent performance evidence for Google Performance Max and AI Max; TikTok Smart+/Symphony; controlled studies of AI-generated versus human creative; UK consumer reaction to AI-made ads; AI creative-testing workflows.
- **Whether Meta's housing and financial special ad categories apply to UK-targeted campaigns in 2026, and what targeting they remove** — not confirmed from the snippets.
- **Meta's current, primary statement on the end-2026 automation goal** — only secondary blogs found.
- **Any UK platform rule specific to bereavement, debt or repossession audiences** — not found.

## 5. Content: what performs and what gets demoted

### Takeaway
Google's line in 2026 is unchanged in principle and sharper in practice: **how content is made does not matter; making lots of low-value pages to capture queries does**, and that now explicitly includes pages built to catch AI "fan-out" queries. What correlates with being surfaced by AI is **being talked about elsewhere**, especially on video and forums. Beyond that, this section is mostly gaps.

### Cited Findings
- **[Official; revised 28 Aug 2026]** Scaled content abuse applies whether content is produced by AI, automation, people or a combination; the test is many pages made primarily to manipulate rankings rather than help users. — [PPC Land](https://ppc.land/scaled-content-abuse/); [Practical Ecommerce](https://www.practicalecommerce.com/google-spam-policies-explained)
- **[Official, 15 May 2026]** Google says you do not need to capture every long-tail variation or write in a special way for AI search. Scaled content targeting fan-out queries is treated as spam. — [Google Search Central guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide); [PPC Land](https://ppc.land/google-spam-policies-now-officially-cover-ai-overviews-and-ai-mode-in-search)
- **[Secondary]** Two spam updates ran in Aug and Sep 2026. Algorithmic demotions carry no notice, and spam updates overlap core updates, so attribution is hard. — [Search Engine Land](https://searchengineland.com/guide/google-spam-update); [GSQi](https://gsqi.com/marketing-blog/august-2026-google-spam-update-case-studies/)
- **[Vendor study, May 2026]** YouTube mentions are the strongest measured correlate of AI visibility (~0.737), ahead of general web mentions (0.664) and far ahead of backlinks (0.218). — [Business Wire](https://www.businesswire.com/news/home/20260526119691/en/Across-75000-Brands-YouTube-Mentions-Are-the-Strongest-Signal-of-AI-Visibility-New-Ahrefs-Report-Reveals)
- **[Vendor study, Nov 2026]** Reddit mentions 0.75, news 0.67, TikTok 0.60 (10,000 US brands). — [Web Traffic News](https://webtrafficnews.com/briefs/ahrefs-finds-reddit-mentions-track-ai-visibility-most-closely)
- **[Vendor study, background — Aug 2025]** Pages cited by assistants are mostly not the pages ranking top-10 for the literal question, because assistants search many reworded sub-questions. — [Ahrefs](https://ahrefs.com/blog/ai-search-overlap/)

### Inferences
- **One researched guide a week is the right shape.** It is the opposite of "scaled": low volume, original, reviewed by a person.
- **Answer the sub-questions inside one good page.** Fan-out means a single thorough guide can be cited for many reworded questions. That beats making one thin page per variant, which Google now treats as spam.
- **Local pages need real local substance.** A page per town that swaps the place name is the textbook scaled-content pattern. A page with genuine local data and a named human view is not.
- **Plain-spoken video is worth testing.** Video is where the strongest AI-visibility correlation sits, and it suits an audience that may prefer to see a face.
- **Original data earns mentions.** News mentions correlate at 0.67; publishing a real finding is the honest way to get them.

### Gaps
- **Not researched (search budget exhausted):** 2026 studies comparing AI-assisted and human content performance; examples of programmatic local pages that survived the 2026 spam updates; AI video tools and short-form evidence; newsletter growth and the effect of AI inbox summaries; AI-assisted data journalism case studies.
- **No 2026 Google statement specific to YMYL property or money content** was found.

## 6. Outbound and personalisation: AI SDRs, direct mail, WhatsApp and AI receptionists

### Takeaway
The 2026 evidence on fully autonomous "AI SDR" outreach is **negative and mostly vendor-sourced**: lower reply rates than humans, worse inbox placement, high pilot churn. All of it is **B2B and US-centric**. In the UK the hard constraint is **PECR**, with the ICO issuing its largest nuisance-marketing fines in 2026. **Addressed post has the strongest measured numbers** (JICMAIL: cold mail 0.9% response, warm 7.2%; 141 seconds of attention). The official WhatsApp Business Platform still allows purpose-specific business bots.

### Cited Findings

**AI SDRs and AI-personalised email**
- **[Vendor study, 26 Apr 2026; 100k paired emails; B2B]** AI-written outreach got a 4.1% reply rate, but the bigger gap was deliverability: **spam-flagged 8% vs 3%** for human emails, and **inbox placement 71% vs 86%**. — [Digital Applied](https://www.digitalapplied.com/blog/ai-sdr-real-performance-100k-email-analysis-2026)
- **[Vendor claim, 28 Jul 2026 — vendor sells an alternative]** First-generation AI SDRs: positive reply rate 1.3% vs a 2.1% human baseline; "roughly half of all pilots shut down within 90 days" (no primary source). — [Kwanzoo](https://www.kwanzoo.com/blog/why-first-gen-ai-sdrs-failed)
- **[Vendor claim]** Fully autonomous agents get 1–3% replies, against 15–25% for signal-driven, human-supervised outreach. — [Laxis](https://laxis.com/blog/state-of-ai-sdr-2026)
- **[Vendor commentary]** Deliverability is described as "the hard ceiling" on AI SDR returns; churned customers cite inbox placement and domain health. More volume plus more "personalisation" is said to be hurting brands. — [Apollo](https://www.apollo.io/insights/what-are-the-limitations-of-current-ai-sdr-tools); [Rework](https://resources.rework.com/news/sales-tech/ai-sdr-worth-it-2026-hybrid-model-sales-leader); [Boomerang](https://getboomerang.ai/post/ai-sdr-backlash)

**UK rules on electronic direct marketing**
- **[Official, Jan 2026]** The ICO issued **£225,000 in fines** for nuisance marketing messages sent without valid consent. — [ICO](https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/2026/01/fines-of-225-000-for-nuisance-marketing-messages)
- **[Secondary, autumn 2026]** The ICO issued a **£300,000** fine — one of its largest for nuisance marketing — with an enforcement notice. The case highlights the risk of relying on bought-in third-party data. — [RPC](https://www.rpclegal.com/snapshots/data-protection/autumn-2026/ico-issues-landmark-fine-for-unlawful-marketing-messages/)
- **[Official]** The Data (Use and Access) Act 2025 (Royal Assent 19 Jun 2025) is in force for its data-protection and PECR provisions. It moves the definition of direct marketing into PECR and extends the soft opt-in to charities only. The ICO's electronic-mail marketing guidance is under review. — [GOV.UK factsheet](https://www.gov.uk/government/publications/data-use-and-access-act-2025-factsheets/data-use-and-access-act-factsheet-pec-regulations); [ICO marketing FAQs](https://ico.org.uk/for-organisations/advice-for-small-organisations/frequently-asked-questions/marketing/)
- **[Secondary, law-firm commentary, autumn 2026]** PECR fines of **up to £17.5m or 4% of global annual turnover** are now possible. — [RPC](https://www.rpclegal.com/snapshots/data-protection/autumn-2026/ico-issues-landmark-fine-for-unlawful-marketing-messages/)
- **[Secondary]** The soft opt-in is narrow: it cannot be used where there was no sale or negotiation, for third-party marketing, or without an opt-out at collection and in every message. — [RPC, spring 2026](https://www.rpclegal.com/snapshots/data-protection/spring-2026/ico-issues-fines-over-electronic-marketing-breaches/)

**Direct mail**
- **[Industry research; JICMAIL Q1 2026]** A direct-mail item reaches 1.14 people, stays in the home **7.8 days** and gets **141 seconds** of attention; 76% of mail is read or looked at. Door drops: 1.06 people, 5.6 days. — [Marketreach](https://www.marketreach.co.uk/blog/jicmail-q1-2026-results)
- **[Industry research; JICMAIL Response Rate Tracker 2025; ~5,000 campaigns]** **Warm direct mail: 7.2% response, £9.00 ROI. Cold direct mail: 0.9%, £3.20. Door drops: 0.5%, £2.90.** — [DMA](https://dma.org.uk/article/jicmails-2025-response-rate-tracker-update-reveals-growing-performance-of-customer-acquisition-mail-campaigns)
- **[Industry research]** Mail-driven digital interactions are at a five-year high. — [Whistl](https://www.whistl.co.uk/insights/jicmail-mail-driven-digital-interactions-reach-five-year-high)

**WhatsApp and chat**
- **[Secondary, background — Oct 2025; effective 15 Jan 2026]** Meta barred **general-purpose** AI chatbots from the WhatsApp Business Platform. — [TechCrunch](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform)
- **[Vendor guide, 2026]** AI bots with a defined business purpose — support, FAQs, lead qualification, routing to a person — remain allowed, though Meta keeps discretion over what counts as general-purpose. — [Respond.io](https://respond.io/blog/whatsapp-chatbot-policy-2026)
- **[Research, 2026]** 23% of UK adult internet users dealt with a customer-service AI chatbot in the past year. — [ISPreview / Ofcom Technology Tracker](https://www.ispreview.co.uk/index.php/2026/09/ofcom-1-in-12-uk-adults-use-ai-to-help-manage-their-telecoms-services.html)

### Inferences
- **Do not automate cold email to individuals.** The evidence on AI outreach is poor even in B2B, and for consumers PECR consent rules plus 2026 enforcement make it a legal risk as well.
- **Human review before sending is the safe side of every finding here.** Supervised, signal-led outreach is where even the vendors land.
- **Post is the strongest evidenced outbound channel.** It has a measured response benchmark and long dwell time, and it suits older recipients. AI's sensible role is drafting and data matching, with a person approving each letter.
- **Bought lists are the specific trap.** The ICO's largest 2026 fine turned on third-party data.
- **An intake assistant on WhatsApp is within the rules if it is narrow.** Answer set questions, collect details, hand to a person. An open-ended chatbot is not.

### Gaps
- **Not researched (search budget exhausted):** print-and-post APIs with AI personalisation; robot-handwritten letters and any response-rate tests; AI receptionists and voice agents (adoption, caller reactions, UK rules); web-chat intake conversion evidence.
- **No ICO guidance specific to AI-generated or AI-personalised marketing was found.**
- **Postal marketing rules** — not searched. Background, unverified today: post is outside PECR and usually rests on legitimate interests under UK GDPR, with Mailing Preference Service screening and a right to object.
- **JICMAIL 2026 Response Rate Tracker** — referenced by Marketreach but not retrieved; the figures above are the 2025 edition.
- **No consumer-side (B2C) evidence on AI outreach** — all AI SDR data is B2B.

## 7. Trust: UK attitudes to AI in service and sales, disclosure, older customers, and reviews

### Takeaway
UK consumers are **wary of AI in service and sales, expect to be told, and trust it far more when a human is available**: 61% say they are less inclined to engage if they know they are talking to a generative AI assistant (Deloitte), and trust in AI to resolve an issue roughly doubles (26% → 55%) when a human option exists (Five9). Older adults are the least comfortable. Separately, **fake or staff-written reviews are a banned practice under UK law since April 2025**, and the CMA opened investigations in 2026.

### Cited Findings
- **[Research; Deloitte UK Digital Consumer Trends 2026; 4,156 UK consumers aged 16–75, nationally representative; search summary dated it May 2026]** **61%** say they would be less inclined to engage if they knew they were conversing with a GenAI assistant. Over a third believe generative-AI health advice is always accurate. — [Deloitte UK](https://www.deloitte.com/uk/en/about/press-room/digital-consumer-trends-over-a-third-of-consumers-believe-gen-ai-health-advice-is-always-accurate.html)
- **[Vendor survey, Oct 2026; three-country sample]** Six in ten UK respondents called AI customer service frustrating. **55%** trusted AI to resolve an issue when a human option was available, against **26%** when it was not. — [IT Brief UK (Five9)](https://itbrief.co.uk/story/uk-consumers-more-frustrated-by-ai-customer-service)
- **[Vendor survey, 2026]** 93% of UK and Ireland consumers say they have a right to know when they are dealing with a bot or AI. — [Genesys](https://www.genesys.com/en-gb/blog/post/the-uk-and-irelands-ai-trust-paradox-2026-state-of-customer-experience-report)
- **[Vendor survey, undated — source page not pinned]** Quadient: 81% of UK consumers think AI use in customer service should be disclosed; only **23% of UK over-55s** are comfortable with AI-generated customer service; 53% think AI communicates worse than humans. The search summary did not tie this to one result; candidates are [BIMA](https://bima.co.uk/?p=87372) and [Retail Times](https://retailtimes.co.uk/?p=127190). Check the date before quoting.
- **[Poll, Jan 2026 — source page not pinned]** YouGov: 21% of Britons trust AI in the retail sector; 37% do not. Same candidate pages: [Retail Times](https://retailtimes.co.uk/?p=127190), [BIMA](https://bima.co.uk/?p=87372).
- **[Vendor survey, UK]** Qualtrics UK consumer research also reports low trust in AI and that cynicism about AI threatens loyalty (figures not retrieved). — [CXM](https://cxm.world/customer-experience/qualtrics-uk-consumer-research-highlights-low-trust-in-ai/); [CX Today](https://www.cxtoday.com/voice-of-the-customer/qualtrics-finds-cynicism-around-ai-threatens-customer-loyalty/)
- **[Research, June 2026]** Only 6% in the UK trust news results from AI chatbots (20% globally). — [Journalism.co.uk on Reuters Institute DNR 2026](https://www.journalism.co.uk/dnr-2026-five-key-takeaways-for-uk-news-publishers/)
- **[Official, 24 Jul 2026]** FCA survey: **44%** wrongly believe AI-generated financial information is regulated; 32% wrongly think they would get FSCS or Ombudsman compensation if AI advice went wrong. The FCA later asked AI providers to add clear warnings to financial answers. — [FCA](https://www.fca.org.uk/news/press-releases/young-investors-trust-ai-more-tv-or-celebrities); [Health & Protection](https://healthcareandprotection.com/fca-wants-ai-services-to-add-warning-on-financial-advice-and-finds-firms-overstating-accuracy-of-models/)
- **[Research, background — Nov 2025]** Which? put 40 consumer questions to AI tools: answers on tax and ISAs were often wrong, overconfident, and rarely pointed to a professional. About half of UK AI users trust the answers to a great or reasonable extent (two-thirds of frequent users); 17% rely on AI for financial advice. — [Which?](https://www.which.co.uk/policy-and-insight/article/chatgpt-and-gemini-among-ai-tools-giving-risky-consumer-advice-which-finds-aBnBP0l2CE0T); [The Register](https://www.theregister.com/2025/11/18/which_ai_consumer_advice/)
- **[Research, date not confirmed]** A separate Which? test of five chatbots on money questions: best aggregate accuracy 67% (Gemini), worst 58% (ChatGPT and Perplexity). — [Which?](https://www.which.co.uk/news/article/can-ai-answer-your-money-questions-akgpv9t0o1cn)
- **[Official]** Fake reviews became a **banned practice** under the Digital Markets, Competition and Consumers Act in April 2025; the CMA need not prove intent. Penalties: up to £300,000 or 10% of global turnover, without going to court. — [CMA case page](https://www.gov.uk/cma-cases/online-consumer-reviews); [Cripps](https://www.cripps.co.uk/thinking/fake-reviews-you-could-be-fined-even-if-innocent/)
- **[Secondary, Mar 2026]** The CMA opened investigations into **five businesses** over fake or misleading reviews, spanning funerals, food delivery and car sales. One concerns whether a funeral provider asked **staff to write positive reviews**. — [Taylor Wessing, 30 Mar 2026](https://www.taylorwessing.com/en/insights-and-events/insights/2026/03/the-cma-steps-up-its-fight-against-fake-reviews); [A&O Shearman](https://www.aoshearman.com/en/insights/cma-targets-fake-online-reviews-in-expanding-consumer-enforcement-programme)
- **[Secondary]** The CMA's first fine under its new direct powers was £473,000 on 13 Feb 2026 (Euro Car Parks, for ignoring an information notice — not a reviews case). Review platforms must take reasonable steps to prevent and remove fake reviews; Google gave undertakings in Jan 2025. — [A&O Shearman](https://www.aoshearman.com/en/insights/cma-targets-fake-online-reviews-in-expanding-consumer-enforcement-programme); [Ashurst](https://www.ashurst.com/en/insights/lessons-from-the-first-year-of-the-new-consumer-enforcement-regime/)
- **[Secondary, Sep 2026, citing Ahrefs]** A consumer-review publisher (consumerreports.org) is among ChatGPT's most-cited domains at about 3.7%. — [Ahrefs](https://ahrefs.com/blog/top-10-most-cited-domains-ai-assistants) [URL match uncertain]

### Inferences
- **Lead with a person, and say so.** For stressed, bereaved or older sellers, a visible route to a named human is the single best-evidenced trust lever.
- **Disclose any AI the customer talks to.** Between 81% and 93% expect it. Not disclosing risks more than disclosing.
- **Keep AI behind the scenes for this audience.** Drafting, research and triage carry little trust cost; an AI voice or chat as the first contact carries a lot with over-55s.
- **People will ask a chatbot about their options and believe it.** Nearly half think AI financial information is regulated. Clear, sourced, plain-English public guides are both a service and the material assistants draw on.
- **Reviews must be scrupulously real.** No staff reviews, no undisclosed incentives, no gating. The CMA chose a funeral provider — a bereavement business — for one of its first cases.
- **Honest third-party reviews do double duty.** They reassure people and are part of the off-site mention footprint that correlates with AI visibility. (The second half is inference; no review-specific AI study was found.)

### Gaps
- **Reactions of older, bereaved or vulnerable customers to AI contact** — only the undated Quadient over-55 figure. No dedicated UK study found.
- **Role of Trustpilot and Google reviews in AI recommendations** — not researched (search budget exhausted).
- **Whether any reviews fine has been issued yet** — investigations were described as ongoing.
- **EY (May 2026) and Credico UK surveys on AI and sales trust** appeared in results but their figures were not retrieved ([EY](https://www.ey.com/en_uk/newsroom/2026/05/uk-ai-adoption-trust-governance-ey-2026); [Credico](https://www.journalism.co.uk/press-releases/credico-uk-on-ai-assisted-sales-trust/)).
- **Deloitte fieldwork and publication dates** — not confirmed.

## 8. Notable new marketing channels and tools that emerged in 2026

### Takeaway
The genuinely new channels of 2026 are **paid placement inside assistants** (ChatGPT Ads, Google AI Mode ads, Bing AI Overview ads), **app/plugin directories inside ChatGPT and Claude**, and the **first free first-party reporting of AI citations** (Bing, then a thinner Google version). Two players moved the other way: Perplexity dropped ads and Anthropic pledged none.

### Cited Findings
- **[Official / secondary]** **ChatGPT Ads**: US paid launch Feb 2026; UK live by mid-2026 with a self-serve Ads Manager beta; 31 European markets announced 18 Aug 2026; about $1bn annualised revenue by 31 Aug 2026. — [OpenAI](https://openai.com/blog/chatgpt-ads-expands-across-europe); [Search Engine Land](https://searchengineland.com/openai-opens-chatgpt-ads-manager-beta-to-uk-advertisers-480679); [PPC.io](https://ppc.io/blog/chatgpt-ads)
- **[Official, 28 Oct 2026]** **Ads in Google AI Mode**: ten more countries now, UK planned for Q4 2026. — [Google blog](https://blog.google/products/ads-commerce/ads-in-ai-mode-global/)
- **[Secondary, Nov 2026]** **Ads in Bing AI Overviews**: all markets except China. — [Search Engine Roundtable](https://seroundtable.com/microsoft-ads-in-ai-overviews-on-bing-42578.html)
- **[Official]** **ChatGPT Plugin directory** (from 9 Jul 2026), bundling apps, skills and templates. — [OpenAI Help Center](https://help.openai.com/en/articles/11487775-apps-in-chatgpt)
- **[Official]** **Claude connector and plugin directory** with a self-serve submission portal and in-chat suggestion of listed connectors. — [Claude docs](https://claude.com/docs/connectors/building/directory-vs-custom)
- **[Official, Feb and Jun 2026]** **Bing Webmaster Tools AI Performance report** — free citation data for Copilot and Bing AI answers. — [Bing Webmaster Blog](https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview)
- **[Official, Mar 2026]** Microsoft Advertising launched an "AI performance dashboard" showing where a brand appears across AI surfaces. — [Microsoft Advertising](https://about.ads.microsoft.com/en/blog/post/march-2026/the-ai-performance-dashboard-your-view-into-where-your-brand-appears-across-the-ai-web)
- **[Official, 20 May 2026]** Google's **Universal Cart** and UCP — agent-led retail checkout across Search and Gemini. — [Google blog](https://blog.google/products-and-platforms/products/shopping/shopping-updates-google-marketing-live)
- **[Official / secondary, Feb 2026]** Moves the other way: Anthropic's ad-free pledge (4 Feb 2026) and Perplexity ending ads (18 Feb 2026). — [Anthropic](https://www.anthropic.com/research/claude-is-a-space-to-think); [MacRumors](https://www.macrumors.com/2026/02/18/PERPLEXITY-ABANDONS-AI-ADVERTISING/)

### Inferences
- **The cheapest new thing to adopt is measurement.** Verifying the site in Bing Webmaster Tools gives real citation data for nothing.
- **The app directories are the one new organic channel that fits a free-tools offer.** Both ChatGPT and Claude now have open submission.
- **Paid assistant placements are early and retail-led.** For a considered, sensitive service the evidence does not yet justify more than a small test.

### Gaps
- **Not researched (search budget exhausted):** AI browser agents, AI video apps as channels, Reddit or TikTok AI ad products, Gmail/Apple AI inbox changes, and anything launched in November 2026 beyond the items above.
- **This list is limited to what the completed searches surfaced; it is not a full scan of 2026 launches.**
