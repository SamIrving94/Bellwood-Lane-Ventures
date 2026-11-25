# Valuation and lead-scoring ML frontier (AVMs, price forecasting, seller lead scoring) — UK focus, as of 25 Nov 2026

> **How far to trust these notes (read first).**
> - **Every cited finding below comes from web-search result summaries, not from a full read of the page.** Direct page fetches were blocked by this session's network policy (arxiv.org, priorlabs.ai, docs.priorlabs.ai, zillow.com, pwc.co.uk, gov.wales and others would not resolve). Re-check any number against its linked primary page before it is used in a decision.
> - **The shared web-search budget ran out part-way through.** Tabular foundation models, AVM research/practice, uncertainty and UK data were searched properly. Geospatial models, time-series models, lead scoring, LLM forecasting and evaluation standards got **one search pass or none**. Their Gaps sections say exactly what was not searched.
> - Anything marked **[background, not verified this session]** is from model memory (cutoff about mid-2026), not from a source read today. Treat it as a lead, not a fact.
> - All new techniques are **candidates to measure on the hold-out**, not recommendations to ship.

## 1. Tabular foundation models: 2026 state of TabPFN (v2, 2.5, 3, 3.5), TabICL, TabDPT, CARTE and similar; comparison with gradient boosting on house-price regression and small data; licensing, hosted APIs, limits, TypeScript/HTTP usability

### Takeaway
By late 2026 in-context tabular foundation models (TabPFN-3 / 3.5, TabICLv2, NVIDIA Kumo Tabular) sit above tuned, ensembled gradient boosting on the main public benchmark (TabArena), and they are strongest on small datasets, which is the reader's regime. But no study was found that tests them on house-price regression specifically, the newest TabPFN weights are non-commercial (production use means the paid/hosted API or a commercial licence), and the benchmark claims are mostly vendor-reported.

### Cited Findings

**TabPFN line (Prior Labs)**
- **TabPFN-2.5 (Nov 2025):** built for up to 50,000 rows and 2,000 features, a 20x increase in data cells over TabPFN v2; the paper says the row limit is not strict and reports strong results up to 100,000 training rows. Weights are under a non-commercial licence (research and internal evaluation); production needs a paid Commercial Enterprise License. — [arXiv 2511.08667](https://arxiv.org/abs/2511.08667v2); [Hugging Face model card](https://huggingface.co/Prior-Labs/tabpfn_2_5)
- **TabPFN-3 (technical report May 2026):** pretrained on synthetic data only; the report says a single forward pass beats all other models on TabArena, including tuned and ensembled baselines; +72 Elo over TabPFN-2.5; up to 20x faster than 2.5; scales to 1M training rows. — [arXiv 2605.13986](https://arxiv.org/abs/2605.13986); [Prior Labs technical report](https://priorlabs.ai/technical-reports/tabpfn-3)
- **TabPFN-3-Plus "Thinking" variant (May 2026):** reported to beat all non-TabPFN models by over 200 Elo on TabArena (420 Elo on the largest-data subset) and to beat AutoGluon 1.5 "extreme" (a 4-hour tuned ensemble) by over 100 Elo while being 10x faster. Vendor-reported. — [arXiv 2605.13986v2](https://arxiv.org/html/2605.13986v2)
- **TabPFN-3 licence:** weights under "TABPFN-3.0 License v1.0", permissive for research and internal evaluation; commercial use needs a separate licence. — [Hugging Face model card](https://huggingface.co/Prior-Labs/tabpfn_3)
- **TabPFN-3.5 (released about 15 Sep 2026) is the current default:** a multitask model that adds text and high-cardinality support and raises the feature ceiling to 20,000; a "Fast" checkpoint in alpha; Plus and Thinking variants. — [Prior Labs changelog](https://docs.priorlabs.ai/changelog.md); [TabPFN-3.5 technical report](https://priorlabs.ai/technical-reports/tabpfn-3-5); [arXiv 2609.17895](https://arxiv.org/pdf/2609.17895)
- **TabPFN-3.5 limits:** up to 1,000,000 rows and 20,000 features (docs recommend up to 6,000 columns; row and column maxima cannot necessarily be reached together); hosted API allows up to 200 million training cells per estimator context. — [Prior Labs models page](https://docs.priorlabs.ai/models)
- **TabPFN-3.5 benchmark claim:** ranks first on TabArena and "BeyondArena"; Thinking adds 44 Elo on TabArena over the base model. Vendor-reported. — [TabPFN-3.5 technical report](https://priorlabs.ai/technical-reports/tabpfn-3-5)
- **Third-party read of 3.5 (15 Sep 2026):** the Thinking variant holds the top rank on four of seven benchmarks and is "competitive" rather than dominant. — [Digital Applied](https://www.digitalapplied.com/blog/tabpfn-3-5-tabular-foundation-model-when-to-use)
- **Plus variant:** API-only; adds proprietary text processing; hosted text limits are 50 million tokens total and 2,500 characters per text value. — [Prior Labs models page](https://docs.priorlabs.ai/models)
- **Thinking variant:** API-only; up to 1M training rows on the hosted API; explicit fit-time budget up to 2,400 seconds; fits are metered and requests over the remaining budget return HTTP 429. — [Thinking mode docs](https://docs.priorlabs.ai/capabilities/thinking-mode); [Metering docs](https://docs.priorlabs.ai/api-reference/metering)
- **API changes (Nov 2026):** resumable API jobs and cheaper SHAP explanations added. — [Prior Labs changelog](https://docs.priorlabs.ai/changelog.md)
- **Licensing summary (2026):** weights for TabPFN-2.5, 2.6, 3 and 3.5 are all non-commercial. The docs say integrating TabPFN into a product or platform needs the API or a commercial licence, and call the API "the simplest path for production trials and product integration". The 2.6 licence also bars hosting the model as an API/SaaS without a commercial licence. — [Prior Labs models docs](https://docs.priorlabs.ai/models.md); [TabPFN-2.6 model card](https://huggingface.co/Prior-Labs/tabpfn_2_6)
- **Pricing:** the pricing page lists Free, Pro and Max API tiers plus Private Cloud and on-prem licences; a secondary article says no rates are published for any of them. The API and Private Cloud run the Plus and Thinking lines under the Terms of Service. — [Prior Labs pricing](https://priorlabs.ai/pricing); [Beri.net commentary](https://www.beri.net/article/nvidia-kumo-tabular-open-tabular-foundation-model-tabarena-commercial-license-vs-tabpfn-3-5)
- **Code licence conflict:** Wikipedia says the Python package was relicensed to Apache 2.0 from version 9.0.0 (Sep 2026); Prior Labs docs describe code under the "Prior Labs License" (open source, commercial use with attribution). Not reconciled. — [Wikipedia](https://en.wikipedia.org/wiki/TabPFN); contradicted by [Prior Labs models docs](https://docs.priorlabs.ai/models.md)
- **Distribution channels:** Python client on GitHub, PyPI package, an R package on CRAN, and listings on Azure AI Foundry and AWS Marketplace. — [tabpfn-client](https://www.github.com/PriorLabs/tabpfn-client); [PyPI](https://pypi.org/project/tabpfn); [CRAN news](https://cran.rstudio.com/web/packages/tabpfn/news/news.html); [Azure catalog](https://ai.azure.com/catalog/models/TabPFN-3-Plus?publisher=PriorLabs); [AWS Marketplace](https://aws.amazon.com/marketplace/pp/prodview-sor7k6q2iz42q)

**Open alternatives**
- **TabICLv2 (preprint Feb 2026, ICML 2026):** titled "a better, faster, scalable, and open tabular foundation model"; covers regression and classification; authors report it beats RealTabPFN-2.5 on the TabArena and TALENT benchmarks without tuning. — [arXiv 2602.11139](https://arxiv.org/abs/2602.11139); [PMLR v306](https://proceedings.mlr.press/v306/qu26a.html)
- **NVIDIA Kumo Tabular (released 23–29 Sep 2026):** weights under the permissive **OpenMDW 1.1** licence; three sizes (about 28M, 62M and 215M parameters); NVIDIA reports first place on TabArena with default settings (Elo 1950) and 17x faster than LimiX-2 on one RTX 6000 Pro. NVIDIA-reported, not independently verified. — [Hugging Face model card](https://huggingface.co/nvidia/kumo-tabular); [NVIDIA model card](https://build.nvidia.com/nvidia/kumo-tabular/modelcard); [MarkTechPost, 30 Sep 2026](https://www.marktechpost.com/2026/09/30/nvidia-releases-kumo-tabular/?noamp=mobile)
- **Kumo Tabular caveats:** the model card lists "TabArena-v0.1: 51 datasets (38 classification, 13 regression)" among its training datasets while other coverage says it was pretrained only on artificial data, so benchmark contamination is unclear. NVIDIA warns accuracy may degrade when query rows come from a different distribution than context rows. Secondary reporting lists TabPFN-3, LimiX-2 and Google's TabFM as non-commercial or paid. — [NVIDIA model card](https://build.nvidia.com/nvidia/kumo-tabular/modelcard); [MarkTechPost](https://www.marktechpost.com/2026/09/30/nvidia-releases-kumo-tabular/?noamp=mobile)
- **TabDPT:** credited by the TabICLv2 authors with showing that large-scale pretraining on real datasets can be competitive; it was in the original TabArena v0.1 evaluation. No 2026 regression scores were found. — [arXiv 2602.11139](https://arxiv.org/html/2602.11139); [TabArena paper](https://arxiv.org/html/2506.16791v4)

**Benchmarks vs gradient boosting**
- **TabArena** (NeurIPS 2025 Datasets & Benchmarks) is a continuously maintained "living" benchmark: 51 curated datasets, 9–30 splits each, 27+ methods including 10+ tabular foundation models. The original paper found foundation models excel on smaller datasets. — [NeurIPS 2025 proceedings](https://proceedings.neurips.cc/paper_files/paper/2025/hash/1697e3fb412da11dc9488249f9e7bbc9-Abstract-Datasets_and_Benchmarks_Track.html); [arXiv 2506.16791](https://arxiv.org/html/2506.16791v4); [GitHub](https://github.com/autogluon/tabarena)
- **Mid-2026 standings (secondary trackers):** on TabArena v0.1.4 the top four single models are all foundation models (TabPFN-3, TabPFN-2.6, RealTabPFN-2.5, TabICLv2), with the best gradient-boosted-tree configuration about 240 Elo lower. A 15 Jul 2026 snapshot found every single-model entry above the best tuned, ensembled GBDT is a foundation model; only AutoGluon's 4-hour ensemble pipelines are exceptions. — [Codesota tracker](https://www.codesota.com/tasks/tabular-ml); [Towards Data Science](https://towardsdatascience.com/tabular-llms-an-introduction-to-the-foundation-models-that-predict-your-spreadsheet)
- **Counter-evidence (2025):** a study comparing tuned tree models with TabPFN-1.0 and TabICL found tree ensembles equal or surpass them, including on a (binarised) Housing dataset (over 91% accuracy for XGBoost/LightGBM), and that trees are far faster at inference (under 0.4s vs up to 47s per batch for TabPFN on Higgs). It used an old TabPFN version and a classification target, so it is weak evidence for price regression. — [arXiv 2512.00888](https://arxiv.org/pdf/2512.00888v1)
- **No house-price-specific head-to-head was found** for any current tabular foundation model against tuned XGBoost/LightGBM. — [search summary citing arXiv 2605.13986 and 2609.17895 regression tables](https://arxiv.org/pdf/2609.17895)

**Tables with free text (CARTE and successors)**
- **CARTE** is mainly referenced in 2025–26 as a 51-dataset benchmark for tabular learning with text. A July 2025 paper argues it has flaws (a "Complete Leak" baseline that leaks the target reaches 100%) and proposes a curated benchmark. — [arXiv 2507.07829](https://arxiv.org/html/2507.07829v1)
- **ConTextTab (SAP, Jun 2025):** semantics-aware in-context learner; sets a new standard on CARTE, but a 2026 paper notes it is outperformed on non-text tasks on TabArena. — [arXiv 2506.10707](https://arxiv.org/html/2506.10707v2); [arXiv 2606.04876](https://arxiv.org/html/2606.04876)
- **TabSTAR (May 2025):** unfreezes a text encoder; reports state of the art on classification tasks with text fields; needs task-specific fine-tuning. — [arXiv 2505.18125](https://arxiv.org/html/2505.18125v2)
- **TabPFN Text Adapter (Jun 2026):** projects language-model embeddings into TabPFN's embedding space without updating either model. — [arXiv 2606.04876](https://arxiv.org/html/2606.04876)

### Inferences
- **Fit to the reader's data.** Hundreds to low thousands of rows is the regime where these models are reported to be strongest, and far below every row limit (50k for 2.5; 1M for 3/3.5). Both the comps-level AVM residual model and the lead-scoring classifier are plausible candidates. This is an inference from general benchmarks; **there is no property-specific evidence**.
- **A cheap experiment exists.** Because the models need no training, a hold-out test is "fit on the pre-cut-off rows, predict the 209 sales". That makes it one of the lowest-effort candidates to measure offline before any production decision.
- **Licence shapes the route.** For a commercial company, open weights for 2.5/2.6/3/3.5 cover evaluation only. Production options appear to be: (a) the hosted API under its Terms of Service, (b) a commercial licence, or (c) a permissively licensed model (Kumo Tabular under OpenMDW 1.1; TabICLv2 described as "open", exact licence not confirmed).
- **TypeScript usability is unconfirmed.** The docs show HTTP-level behaviour (metering, HTTP 429, resumable jobs) and Python/R clients; no TypeScript SDK surfaced. A plain HTTP call from a Node route is probably feasible, but the endpoint spec was not read. Self-hosting any of these means a Python + GPU service, which a serverless TypeScript stack does not have.
- **Privacy flag.** Sending lead rows (probate, repossession) to a third-party hosted model is a data-sharing decision. Property attributes for valuation are lower risk than lead PII.
- **Text support in TabPFN-3.5 / Plus** could let listing descriptions or probate-notice text enter as raw columns. That is a second, separate candidate to measure.
- **Benchmark caution.** Most 2026 rankings are vendor-reported on the same public benchmark; at least one model card lists the benchmark among "training datasets". Only a result on the reader's own hold-out should count.

### Gaps
- **No published house-price regression comparison** (MdAPE or share within 10%) for TabPFN-3/3.5, TabICLv2 or Kumo Tabular vs tuned gradient boosting. Searched; none found.
- **API prices, rate limits, free-tier size and the REST endpoint spec** were not retrievable (pricing/doc pages blocked). The one secondary source says no rates are published.
- **TabICLv2 licence text, row/feature limits and exact margins** not verified (arXiv blocked). **[background, not verified this session]** the original TabICL code and weights were BSD-3 licensed.
- **TabDPT 2026 status** and **TabPFN v2 licence** (believed to be Apache-2.0-with-attribution, allowing commercial use **[background, not verified this session]**) not confirmed.
- **TabPFN regression outputs.** **[background, not verified this session]** TabPFN regressors return a full predictive distribution (quantiles), which would matter for intervals and abstention; not confirmed for 3.5 or the API.
- Whether the hosted API processes data in the UK/EU, and its retention terms, was not checked.

## 2. AVM research and practice 2025–2026: best published approaches, commercial error rates (UK and US), and the realistic floor for off-market UK homes on public data

### Takeaway
The strongest published patterns are hybrids (comparable-sales logic stacked with gradient boosting), learned comparable selection, and LLM/vision models used as feature extractors over listing text and photos rather than as valuers. The best commercial off-market benchmark is the US Zestimate at about 7.2% median error (about 62% within 10%) with far richer data than UK open data; UK vendors publish only self-reported figures, mostly against surveyor values, and no independent UK floor was found.

### Cited Findings

**Research approaches**
- **Stacking comps with ML (2025, Oslo apartments):** a stacked model combining XGBoost, a comparable-sales method (CSM) and LAD regression gave the best result, MdAPE 5.17%. Not UK; apartments in one city. — [Journal of Real Estate Finance and Economics (Springer), 2025](https://link.springer.com/article/10.1007/s11146-025-10030-x)
- **Learned comparable selection (13 Mar 2026):** "Retrieval-Enhanced Real Estate Appraisal" learns which comparables to select with a hybrid vector + geographic retrieval module trained jointly with the estimator, instead of hand-written distance rules. Reported: better comparables than distance rules, near state-of-the-art accuracy with fewer comparables and fewer parameters, which makes predictions easier for a human to check. Tested on five datasets (US, Brazil, France), including a new French dataset with explicit temporality. No UK data. — [arXiv 2603.12986](https://arxiv.org/abs/2603.12986)
- **LLM + vision as feature extractors (Nov 2026):** "LLM-Enhanced Multimodal House Price Prediction" uses an LLM to turn free-text listing descriptions into structured spatio-temporal and contextual features, and a vision-language model to sort unlabelled property photos into categories; both add gains beyond structured and spatial baselines. Code and data are public. Numbers not retrieved. — [arXiv 2611.01615](https://arxiv.org/pdf/2611.01615)
- **LLMs as direct valuers (Jun 2025):** LLMs produce house-price estimates approaching traditional ML, but consistently understate uncertainty; their ranges are too narrow to contain real market values. — [arXiv 2506.11812](https://arxiv.org/html/2506.11812v1)
- **Multimodal survey (Mar 2025):** a comprehensive survey of multimodal ML for real-estate appraisal. Background. — [arXiv 2503.22119](https://arxiv.org/abs/2503.22119v1)
- **Text + image embeddings (2024):** MHPP fuses raw attributes, geospatial neighbourhood embeddings, BERT text embeddings and CLIP image embeddings into one regressor; code and data on GitHub. — [arXiv 2409.05335](https://arxiv.org/abs/2409.05335v1)
- **Graph neural networks:** a boundary-aware GNN (Jan 2026) reports MAPE reductions of 4.4% to 7.9% across three datasets; baselines not confirmed. GraphLand (NeurIPS 2025), a general benchmark, finds gradient-boosted trees with graph-derived features are strong baselines against GNNs. — [MDPI ISPRS IJGI, Jan 2026](https://www.mdpi.com/2220-9964/15/2/52); [arXiv 2409.14500](https://arxiv.org/pdf/2409.14500v3)
- **Street-level and aerial imagery, London (2018–19, background):** adding learned neighbourhood visual features from Street View and aerial images improved price prediction, including in unseen boroughs. A 2022 Warwick thesis found estate-agent marketing photos gave better estimates than Street View or Geograph images. No 2025–26 UK imagery study was found. — [arXiv 1807.07155](https://arxiv.org/abs/1807.07155v2); [Warwick thesis](https://wrap.warwick.ac.uk/id/eprint/177026)
- **University of Manchester (date not captured):** describes an AI valuation system trained on millions of England and Wales transactions with energy-performance, local-economy and market data. No error figures in the snippet. — [University of Manchester news](https://www.manchester.ac.uk/about/news/the-ai-system-transforming-the-accuracy-of-property-valuations/)

**UK open-data evidence (self-reported hobby/portfolio projects, not peer reviewed; the search summary did not name which repository each figure came from, so the links below are the best match from the result list and must be checked)**
- A public project on Land Registry sales (best match: one using about 2.7M sales with time-based validation) reports gradient boosting at **19.9% median error vs 30.6% for a district-median baseline**, with about half of predictions more than 20% off; it blames the absence of floor area, bedrooms and condition in Price Paid data. — [GitHub project](https://github.com/Pulak-PSR/uk-house-price-prediction)
- A second public project that adds **EPC floor area and a spatial k-nearest-neighbour feature** reports XGBoost at **MdAPE 15.7%** on its test set (which of the listed repositories this is was not confirmed). — [GitHub project](https://github.com/adilh333/uk-house-price-analysis)
- A third project uses H3 hex features, spatial block cross-validation and Moran's I, and reports hex features roughly halve residual spatial autocorrelation. — [GitHub project](https://github.com/camerons-world/house_price_prediction)
- A ready-made linked dataset exists: **"House Price per Square Metre in England and Wales, 1995–2024"**, combining Price Paid Data with domestic EPCs. — [UK Data Service ReShare](https://reshare.ukdataservice.ac.uk/857911/)

**Commercial AVM accuracy — US**
- **Zestimate (Oct 2026):** nationwide median error **1.77% on-market, 7.20% off-market**. An article citing Zillow data refreshed 8 Aug 2026 gives 1.78% and 7.20%. — [Boston Globe, 23 Oct 2026](https://www.bostonglobe.com/2026/10/23/real-estate/home-value-estimates-zillow-redfin/); [Naperville.com](https://naperville.com/?p=8569)
- **Zestimate distribution (May 2026, via HomeLight citing Zillow tables):** off-market within 5% of sale price 37.73% of the time and **within 10% 61.81%**; on-market 85.01% within 5%, **95.92% within 10%**, 99.02% within 20%. — [HomeLight, May 2026](https://www.homelight.com/blog/buyer-most-accurate-home-value-website/)
- **Local spread:** off-market median error is 12.7% in Vermont (few available estimates) and 5.3% in Colorado; Seattle off-market 6.09%, 42.91% within 5%, 89.12% within 20% (refreshed Nov 2026). — [The Close](https://theclose.com/how-accurate-is-zillow-zestimate/); [HomeLight Seattle](https://www.homelight.com/blog/zillow-zestimate-seattle/)
- **How on-market is measured:** Zillow compares the last Zestimate shown before a home goes pending with the final recorded price. The Neural Zestimate values over 100 million homes from sales, tax assessments and public records. — [HomeLight](https://www.homelight.com/blog/buyer-most-accurate-home-value-website/); [Zillow tech blog](https://www.zillow.com/tech/building-the-neural-zestimate)
- Conflicting third-party figures circulate (1.83%/7.01% on a Zillow page last updated 28 Jul 2025; 2.4%/7.49% elsewhere). — [Zillow](https://www.zillow.com/zestimate); contradicted by [iBuyer.com](https://ibuyer.com/blog/how-reliable-is-the-zestimate/)

**Commercial AVM accuracy and use — UK**
- **Hometrack (vendor claim):** 80% of valuations within 10% of the **surveyor's** value (not sold price). It says a house price index alone lands within 10% of the surveyor only about 50–55% of the time. — [Hometrack](https://www.hometrack.com/uk/automated-valuation-model/)
- **One UK vendor (self-published):** 85.3% within ±10% of sale price against Land Registry; puts portal asking prices about 15% from sale price. — [Gadsden Valuations](https://valuations.andrewgadsden.com/overview)
- **Independent evidence is thin:** "little hard impartial evidence on the accuracy of commercially available AVMs in the public domain"; US data averages about 70% within ±10% with wide spread by location. No verified accuracy figures for Zoopla or Rightmove estimates were found. — [PropertyData article](https://propertydata.co.uk/resources/just-how-accurate-are-automated-valuations-models)
- **Portal caveat:** Rightmove's guidance says an automated model generally cannot assess interior decoration, presentation, or renovations since the last sale. — [Rightmove guide](https://www.rightmove.co.uk/guides/?p=12813)
- **Asking vs AVM (Q2 2026):** the average newly listed UK property was priced 11.6% above its independent AVM value. — [Mortgage Solutions, 16 Jul 2026](https://www.mortgagesolutions.co.uk/mortgage-news/2026/07/16/down-valuation-risk-set-to-rise-as-pricing-gap-increases-to-11-6-twentyci/)
- **Lender use (Feb–Mar 2026 survey, 11 of the 20 largest UK mortgage lenders):** AVM use is growing from "a low and uneven starting point"; only a small share use AVMs for back-book and product-transfer valuation, most rely on HPI indexing. — [PwC AVM Benchmarking Survey 2026](https://www.pwc.co.uk/industries/financial-services/understanding-regulatory-developments/pwc-avm-benchmarking-survey-2026.html)
- **Regulation:** PRA PS1/26 (20 Jan 2026) finalised Basel 3.1; supervisory statements take effect 1 Jan 2027; firms must obtain a new valuation at least every five years; AVMs or indices are allowed "where it is prudent to do so" in place of a physical valuation. — [Bank of England PS1/26](https://www.bankofengland.co.uk/prudential-regulation/publication/2026/january/implementation-of-the-basel-3-1-final-rules-policy-statement); [RICS update, 23 Jan 2026](https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/valuation-standards/rics-update-on-the-pra-boe-final-rules-on-the-implementation-of-basel-3-point-1-in-the-uk)
- **RICS:** no dedicated 2025–26 AVM standard found (the AVM Roadmap is June 2021; an insight paper is April 2022). RICS is developing global practice guidance on **AI in real estate valuation**, expected as a 1st edition later in 2026. — [RICS AI in valuation](https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/valuation-standards/ai-in-real-estate-valuation); [RICS AVM Roadmap](https://www.rics.org/content/dam/ricsglobal/documents/standards/rics_avm_roadmap.pdf)

### Inferences
- **Where 12.3% sits.** The reader's hold-out MdAPE of about 12.3% is better than the open-data-only UK projects above (15.7% with EPC floor area; 19.9% Price-Paid only) and behind the best US off-market figure (7.2%), which is built on tax-assessor attributes and listing data that have no open UK equivalent. These are not like-for-like tests (different samples, filters, dates).
- **A realistic UK off-market floor is not published.** Triangulating the figures above, something in the **high single digits to about 10% MdAPE** looks like the plausible ceiling of what public data can do, and getting there likely needs condition/interior information that public data lacks. This is my inference, not a sourced number.
- **The on-market/off-market gap (1.8% vs 7.2%) is mostly the asking price.** That is the single largest known accuracy lever, and it is US evidence. In the UK, asking prices sat about 11.6–15% above AVM/sale values, so an asking price is an informative but biased signal that would need its own discount model. It only helps for listed homes.
- **Candidates this evidence supports measuring** (each on the hold-out, one at a time):
  - a **stacked blend** of the existing comps estimate with a small tabular model on the same features (Oslo result);
  - **learned or re-ranked comparable selection** in place of pure radius rules (retrieval paper), which also keeps the human-checkable comp list;
  - **LLM extraction of condition/features from listing text** and **photo categorisation** for homes with a listing (Nov 2026 paper), as features rather than as a valuer.
- **LLMs should not produce the number or the interval** on current evidence (understated uncertainty).
- **GNNs look low priority** at this data size: the general benchmark finding is that boosted trees plus neighbour features match them.

### Gaps
- **No independent, audited UK AVM accuracy study** against sold prices (Hometrack, Zoopla, Rightmove, bank AVMs) was found. Vendor numbers are self-reported.
- **No peer-reviewed 2025–26 UK study** reporting MdAPE for an AVM on open data was found. A 2026 Glasgow PhD thesis surfaced but was not read ([link](https://theses.gla.ac.uk/86042/4/2026OuPhD.pdf)).
- **Numbers from arXiv 2603.12986 and 2611.01615** (error tables) could not be read.
- **PwC survey detail** (confidence thresholds, LTV caps, vendor performance) and **PRA validation/monitoring conditions** for AVMs not retrieved.
- **European AVM Alliance standards** and Bank of England statements beyond PS1/26 were not searched (budget). A 2026 Bank of England report "Artificial intelligence in UK financial services" exists but was not read ([link](https://www.bankofengland.co.uk/report/2026/artificial-intelligence-in-uk-financial-services-2026)).
- **Welsh Government land-valuation method tests** (published 17 Mar 2026, several contractors including a VOA pilot) compare comparables, statistical and ML methods on Welsh public data; one search summary suggested nearest-neighbour comparables did worse than statistical/ML approaches, but no figures were retrieved and the target is land value, not house price ([link](https://gov.wales/testing-land-valuation-methods-tesseract-academy)).
- Redfin and other US AVM figures were not collected.

## 3. Uncertainty and abstention: conformal prediction and other honest-interval methods, calibration, and rules for when a model should refuse to value

### Takeaway
Conformal prediction is the best-evidenced way to get valuation intervals that actually hit their stated coverage, and property-specific papers show it must be conditioned (by location or property group) or the coverage is uneven. Industry practice treats refusal as normal: a model declines when its expected error (forecast standard deviation) is above a threshold, trading hit rate for accuracy.

### Cited Findings
- **Conformal quantile regression on house prices (J. Property Research, 2025, vol 42(1), pp 1–19):** on San Francisco Bay Area sales, conformal intervals achieve target coverage while plain quantile-regression intervals "severely undercover"; intervals adapt to dwelling characteristics. US data. — [RePEc record](https://ideas.repec.org/a/taf/jpropr/v42y2025i1p1-19.html); [open working paper](https://rem.rc.iseg.ulisboa.pt/wps/pdf/REM_WP_0314_2024.pdf)
- **Spatially weighted conformal prediction for AVMs (revised Jan 2025):** on Oslo transactions, plain conformal prediction gives intervals that are "not calibrated everywhere" because of spatial dependence; spatially weighted and Mondrian-style variants fix this. The paper also points to a London study on adjusting conformal intervals for temporal drift in house prices. — [arXiv 2312.06531](https://arxiv.org/html/2312.06531v2)
- **Mondrian conformal by property group (Feb 2026, rental valuation):** conditioning calibration on bedroom count gave the largest efficiency gain, cutting 95% interval width by up to 5.3% versus absolute-residual split conformal. — [Ghent working paper 26/1136](https://econpapers.repec.org/RePEc:rug:rugwps:26/1136)
- **Normalised nonconformity measures for AVMs (2021, background):** earlier work on scaling conformal intervals by difficulty, on Ames data. — [Expert Systems with Applications](https://research.nottingham.edu.cn:443/en/publications/normalized-nonconformity-measures-for-automated-valuation-models)
- **LLM-stated ranges are too narrow (Jun 2025):** LLMs consistently underestimate price uncertainty. — [arXiv 2506.11812](https://arxiv.org/html/2506.11812v1)
- **Forecast standard deviation (FSD):** the standard deviation of percentage sales errors; a confidence score is often 100 minus FSD (FSD 7% gives 93), but that conversion is a convention and scores are not comparable across vendors. Freddie Mac calls FSD the best measure of expected accuracy in use, and says users must validate FSDs and confidence scores themselves on out-of-sample tests. US practice. — [Freddie Mac white paper](https://my.sf.freddiemac.com/docs/pdf/fact-sheets/dougwhitepaper_metricsmatter.pdf); [Xome](https://www.xome.com/blog/all-about-avm/)
- **Abstention is expected:** "often, AVMs do not (and should not) produce results when they don't have strong confidence in the valuation"; the user sets the minimum confidence threshold; excluding hard properties lowers hit rate and improves accuracy. — [Clear Capital glossary](https://www.clearcapital.com/blog-avm-testing-glossary/); [Xome](https://www.xome.com/blog/?p=1692)
- **Coverage must be reported with accuracy:** an AVM "can post strong error numbers on the cases it chooses to value and still fail in practice if it skips too many properties"; tight comp filters lower observed error but cut hit rate. — [BatchData](https://batchdata.io/blog/avm-accuracy-study-metrics-matter)
- **Selective conformal inference (general statistics):** methods exist to keep valid coverage on a selected subset (false coverage-statement rate control). Not property-specific. — [arXiv 2301.00584](https://arxiv.org/pdf/2301.00584)

### Inferences
- **Split conformal is cheap to trial on frozen snapshots.** It needs only past (estimate, later sale price) pairs. Each frozen appraisal that later gets a Land Registry sale is a calibration point. With a few hundred pairs, a 90% interval can be calibrated; group-conditional (Mondrian) splits will be limited to two or three coarse groups at this sample size (for example evidence path: radius comps vs postcode vs sector; or flat vs house).
- **Evidence path is the natural conditioning variable.** The reader already records which fallback produced a valuation and how many sized comps it had. The Oslo and Ghent results suggest calibrating intervals per group rather than globally.
- **An explicit refuse rule can be made measurable:** refuse when the calibrated interval half-width exceeds X%. Report **hit rate and MdAPE together**, so a change that improves accuracy only by refusing more is visible.
- **Temporal drift matters for conformal validity.** Calibration pairs are old sales; a rolling or time-weighted calibration window is the documented remedy (London drift study cited in the Oslo paper; not read).
- The existing hard rule (no sale evidence, no value) is consistent with stated industry practice; conformal widths would add a graded version above that floor.

### Gaps
- **The London temporal-drift conformal paper** was referenced but not found or read.
- **No 2026 property paper** combining conditional coverage, local adaptivity and drift was found.
- **No published rule-of-thumb threshold** for when to refuse (FSD cut-offs used by UK lenders) was retrieved.
- Calibration methods other than conformal (quantile GBMs, Bayesian models, TabPFN predictive distributions) were not searched for property-specific evidence.
- Minimum calibration-set sizes for group-conditional coverage were not sourced; the "two or three groups" statement is my judgement.

## 4. Geospatial and imagery foundation models: AlphaEarth Foundations, Population Dynamics Foundation Model, Prithvi, Clay, SatCLIP and newer; evidence for price prediction; accessibility for UK locations

### Takeaway
No study was found showing that AlphaEarth, Prithvi, Clay or similar embeddings improve house-price prediction; the closest evidence is that they predict neighbourhood income, health, travel and crime in US cities, with AlphaEarth best. For the UK, the most directly usable items are a prototype England-and-Wales small-area embedding set and a UK-written guide to pulling AlphaEarth embeddings at building level. Search on this topic was cut short.

### Cited Findings
- **AlphaEarth Foundations (Google DeepMind, Jul 2025):** a general-purpose embedding field model; its embeddings "consistently outperform" other featurisation approaches on mapping evaluations without retraining. The paper's evaluations are mapping tasks, not housing. — [arXiv 2507.22291](https://arxiv.org/abs/2507.22291)
- **Urban benchmark (Apr 2026), "Earth Embeddings Reveal Diverse Urban Signals from Space":** compares AlphaEarth, Prithvi-EO-2.0-300M and Clay-v1.5 for neighbourhood-level prediction in six US metros, 2020–2023, on 14 indicators. Mean R² 0.59 (health), 0.48 (travel), 0.44 (income), 0.42 (crime). AlphaEarth is consistently best, then Prithvi, then Clay; 64-dimensional AlphaEarth embeddings beat 64-dimensional reductions of the others. Home value is not confirmed as one of the indicators. US-only. — [arXiv 2604.03456](https://arxiv.org/abs/2604.03456)
- **UK how-to for AlphaEarth at building level:** a Geographic Data Service training pack covers extracting pixel-level embeddings for regions and specific building locations and using them in predictive models. A method guide, not a housing study. — [Geographic Data Service](https://geographicdataservice.github.io/Building_Level_AlphaEarth/)
- **Population Dynamics Foundation Model (Google Research, Nov 2024):** embeddings and sample code are public for researchers; the original work covers the contiguous United States. — [arXiv 2411.07207](https://arxiv.org/abs/2411.07207); [Google Research blog](https://research.google/blog/insights-into-population-dynamics-a-foundation-model-for-geospatial-inference/)
- **PDFM expansion (Oct 2025):** the Earth AI paper says embeddings were expanded to 17 countries and are comparable across countries, so "a downstream model trained on US data can be applied in the United Kingdom or Brazil". How to access UK embeddings is not stated. — [arXiv 2510.18318](https://arxiv.org/pdf/2510.18318)
- **Output Area Foundation Model (OAFM) prototype:** embeddings capturing socio-demographic factors for England and Wales at 2021 Output Area and LSOA level, described as a first step toward a UK population-dynamics model and as a demonstrator. Downloadable as Parquet and zipped CSV; code MIT, data under OGL v3.0. — [GeoDS data service](https://data.geods.ac.uk/dataset/output-area-foundation-model-embeddings)
- **Access landscape (Jan 2026):** a paper catalogues Earth-embedding "products", their taxonomy and standardised access. Not read in detail. — [arXiv 2601.13134](https://arxiv.org/html/2601.13134v1)
- **Older direct evidence (2016, 2018–19):** deep features from multi-scale satellite imagery explained house-price variation beyond house attributes; in London, Street View plus aerial features improved price models. Pre-foundation-model work. — [arXiv 1610.04805](https://arxiv.org/pdf/1610.04805); [arXiv 1807.07155](https://arxiv.org/abs/1807.07155v2)

### Inferences
- **These embeddings are neighbourhood-quality proxies.** They predict income and deprivation-like signals. A comps-based AVM already absorbs most neighbourhood effect through nearby sale prices. The likely incremental value is therefore small, and largest where comps are thin (the postcode-sector fallback). That is my reasoning; no property study confirms it.
- **Cheapest UK test:** join OAFM embeddings (free, OGL, keyed by Output Area/LSOA) to the hold-out and test whether they explain AVM residuals. It needs no imagery pipeline.
- **AlphaEarth at building level** is feasible for UK coordinates per the UK training pack, but adds an Earth Engine dependency. Rank it below OAFM.
- Photos of the actual home (listing photos) have better direct evidence of value than overhead imagery (Warwick thesis; Nov 2026 multimodal paper in section 2).

### Gaps
- **Search budget ran out** before follow-up searches on: AlphaEarth dataset licence and commercial terms on Earth Engine; PDFM home-value results and UK access route; SatCLIP; Prithvi/Clay housing studies; any 2026 UK price study using these embeddings.
- **[background, not verified this session]** AlphaEarth's annual 64-dimensional "Satellite Embedding" dataset is distributed through Google Earth Engine at about 10 m resolution with global coverage; licence terms for commercial use were not confirmed.
- **[background, not verified this session]** The SatCLIP paper (Microsoft) evaluated its location embeddings on a California housing-price task among others and released code under a permissive licence. The PDFM paper reported predicting US home values among its downstream tasks. Neither was re-checked today.
- Whether the benchmark in arXiv 2604.03456 includes a home-value indicator is unconfirmed.
- UrbanFusion ([arXiv 2510.13774](https://arxiv.org/html/2510.13774v1), Oct 2025) surfaced as a multimodal spatial-representation model but was not read.

## 5. UK data sources, especially new or newly opened in 2025–2026 (licence terms and cost)

### Takeaway
The biggest 2026 change is that HM Land Registry now publishes UPRN and INSPIRE ID lookups with each month's Price Paid Data (from 28 Aug 2026, new records only), which makes exact property matching to EPC records open and free going forward. EPC reform will change the certificate's headline metrics but not before the second half of 2027; VOA property attributes stay closed at property level; OS building attributes (height, floors, age) exist but are paid for commercial users.

### Cited Findings

**HM Land Registry**
- **UPRNs and INSPIRE IDs with Price Paid Data from 28 Aug 2026.** Published as separate monthly lookup tables (for example `pp-uprn-lookup-aug-2026.txt`, `pp-inspire-id-lookup-aug-2026.txt`) keyed on the transaction unique identifier. Reported live on 3 Sep 2026. — [gov.uk announcement](https://www.gov.uk/government/news/hm-land-registry-to-provide-property-identifiers-for-price-paid-data-from-28-august); [Property118, 3 Sep 2026](https://www.property118.com/hm-land-registry-launches-tool-for-accurate-sales-data/)
- **No backfill.** Identifiers are not added to previously published data; only new price-paid records are included. — [gov.uk announcement](https://www.gov.uk/government/news/hm-land-registry-to-provide-property-identifiers-for-price-paid-data-from-28-august)
- **UPRN coverage:** freehold and leasehold sales; a UPRN is included only where the registered title address can be reliably related to an addressable location (sourced from OS AddressBase Premium and Royal Mail PAF), so some transactions will have none. — [UPRN lookup technical specification](https://www.gov.uk/government/statistical-data-sets/technical-specification-transaction-unique-identifier-and-uprn-look-up-table-dataset)
- **INSPIRE ID coverage:** freehold only (INSPIRE index polygons are based on freehold registered land); a property may have more than one INSPIRE ID. — [INSPIRE lookup technical specification](https://www.gov.uk/government/statistical-data-sets/technical-specification-transaction-unique-identifier-and-inspire-id-look-up-table-dataset)
- **Licence:** Price Paid Data and the lookups are under the Open Government Licence v3.0 for commercial and non-commercial use; the OGL does not cover third-party rights in the address data. The lookups are not part of the Price Paid linked-data service. — [Price Paid Data downloads](https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads); [UPRN lookup dataset](https://www.gov.uk/government/statistical-data-sets/transaction-unique-identifier-and-uprn-look-up-table-dataset)
- **No new official HMLR API was found** in 2026; monthly CSV/TXT releases and linked data continue. — [Price Paid Data: August 2026](https://www.gov.uk/government/statistical-data-sets/price-paid-data-august-2026)
- **Property data pilot:** HMLR is piloting better access to property datasets held by local authorities (the ones that cause the longest search delays), under its Local Land Charges programme. — [gov.uk pilot page](https://www.gov.uk/government/publications/hm-land-registry-local-land-charges-programme/hm-land-registry-launches-new-property-data-pilot)
- **Home buying and selling reform roadmap (19 Jun 2026):** covers mandatory upfront property information, digital property logbooks and packs, binding conditional contracts and digitisation; the timeline includes a 2026 call for evidence on a **smart data scheme for the property sector**. — [gov.uk roadmap](https://www.gov.uk/government/consultations/home-buying-and-selling-reform/outcome/home-buying-and-selling-reform-roadmap)

**EPC**
- **EPC reform:** partial government response published 9 Mar 2026. For homes, the single cost-based rating is replaced by four headline metrics: energy cost, fabric performance, heating system and smart readiness. Regulations intended in 2026. — [gov.uk partial response](https://gov.uk/government/consultations/reforms-to-the-energy-performance-of-buildings-regime/outcome/reforms-to-the-energy-performance-of-buildings-regime-partial-government-response); [Osborne Clarke](https://www.osborneclarke.com/insights/government-reforms-energy-performance-buildings-regime-and-raises-minimum-energy)
- **Timing slipped:** new-style EPCs are not expected until the second half of 2027; Scotland says most of the current system stays until spring 2028. The response on EPC **data** and quality management was still to come in a further 2026 publication. — [Propertymark](https://www.propertymark.co.uk/resource/anticipated-reinvention-of-epcs-held-back-until-2027.html); [Scottish Government, 17 Mar 2026](https://www.gov.scot/publications/energy-performance-certificate-reform-updates/pages/17-march-2026/)
- **Private rented sector:** an EPC "C-equivalent" minimum for all privately rented homes in England and Wales from 1 Oct 2030. — [HSF Kramer](https://www.hsfkramer.com/it/notes/realestate/2026-posts/epc-mees-reform-warm-homes-plan-key-updates-living-sector0)
- **Data access:** the "Get energy performance of buildings data" service offers bulk CSV downloads and a developer API for domestic and non-domestic certificates in England and Wales, including expired or replaced certificates. Scotland is separate. — [Get energy performance of buildings data](https://get-energy-performance-data.communities.gov.uk/); [data.gov.uk collection](https://www.data.gov.uk/collections/land-and-property/energy-performance-of-buildings)

**VOA**
- **Council Tax stock of properties 2026** (data as at 31 Mar 2026): aggregate tables by band and property attributes (type, bedrooms for some property types) for England and Wales; a May 2026 update added attribute breakdowns after a new data feed from the VOA's Valuation Operating System. Statistics only. — [gov.uk statistics](https://www.gov.uk/government/statistics/council-tax-stock-of-properties-2026); [background information](https://www.gov.uk/government/statistics/council-tax-stock-of-properties-2026/background-information)
- **Property-level attributes are not open:** Property Attribute Data is released on request and requires verification that the requester is the taxpayer. — [gov.uk PAD guidance](https://www.gov.uk/guidance/property-attribute-data-pad)

**Ordnance Survey**
- **OS NGD Building Features** carries building type, height (with confidence levels), construction material, age, usage, number of floors (from version 3.0) and roof material/shape; updated daily; available by API (GeoJSON) and download. Building age and roof data come from Verisk and carry additional royalty obligations. — [OS product page](https://www.ordnancesurvey.co.uk/products/os-building-features); [OS docs](https://docs.os.uk/osngd/data-structure/buildings/building-features); [OS blog on number of floors](https://www.ordnancesurvey.co.uk/blog/number-of-floors-data-release)
- **Cost:** pricing is by area or per feature; OS Select+Build and the NGD APIs are offered under the Public Sector Plan and the Premium Plan, which implies paid access for a commercial user. No free tier for these collections was found. — [OS NGD product book](https://docs.os.uk/welcome/welcome/product-book-test-june-25/os-ngd-product-book/os-ngd-buildings-product-book/os-ngd-building-features-product-book); [OS news](https://www.ordnancesurvey.co.uk/news/ordnance-survey-launches-significant-enhancements)

**Planning, flood, rents, linked datasets**
- **planning.data.gov.uk:** planning-application dataset under OGL v3.0 with a documented API (OpenAPI spec). Coverage is growing but not fully national; the official performance page says coverage metrics are being revised. Wales is not covered (third-party statement). — [planning application dataset](https://www.planning.data.gov.uk/dataset/planning-application); [API docs](https://planning.data.gov.uk/docs); [performance page](https://planning.data.gov.uk/about/performance)
- **Flood risk (NaFRA2):** new river, sea and surface-water data went live 28 Jan 2025 and new Flood Zones on 25 Mar 2025, free and open via the Defra Data Services Platform and data.gov.uk; an OGC API Features service exists for flood extents (polygons, not property-level). England only; Natural Resources Wales published its own properties-at-risk data on 2 Oct 2025. — [gov.uk guidance](https://www.gov.uk/guidance/updates-to-national-flood-and-coastal-erosion-risk-information); [Environment Agency blog, 28 Jan 2025](https://environmentagency.blog.gov.uk/2025/01/28/enhancing-flood-and-coastal-erosion-risk-digital-services-with-the-latest-data-and-mapping); [Defra DSP catalogue entry](https://dsp.agrimetrics.co.uk/dataset/bb486190-bb9c-4eb0-a4b2-c9bd63ca86ec)
- **Private rents:** the ONS Price Index of Private Rents became official statistics on 20 May 2026; average rents are published at local-authority level for England and Wales (Broad Rental Market Area for Scotland and Northern Ireland); UK average rent £1,393 in July 2026. — [ONS bulletin, Oct 2026](https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/october2026)
- **Price per square metre, 1995–2024:** a ready-linked Price Paid + domestic EPC dataset for England and Wales. — [UK Data Service ReShare](https://reshare.ukdataservice.ac.uk/857911/)

### Inferences
- **UPRN lookup is the most useful new item for this AVM.** New sales can now be joined to EPC records by UPRN without address matching, which is the same join the reader already trusts for the subject's floor area. Because there is no backfill, benefit accrues only to sales registered from Aug 2026; older comps still need address matching. It should reduce wrong-certificate sizing of **comps** over time. Measure the match-rate change before relying on it.
- **INSPIRE ID gives plot polygons for freehold sales,** so plot area becomes a candidate feature for houses (not flats). Candidate to measure.
- **EPC reform is a watch item, not an action.** Floor area is expected to stay on certificates, but new metrics and any change to the data service could alter fields in 2027. The data-specific response had not been found.
- **Paid OS attributes (floors, height, age)** could help size or classify homes with no EPC, but carry licence cost and royalties; weigh against the free EPC route already in use.
- **Flood, planning and rent data** are free and open and are candidates for residual-explaining features or lead flags, with unknown effect size.

### Gaps
- **Not searched (budget):** crime (police.uk), schools (Ofsted/DfE), broadband (Ofcom), ONS small-area house-price statistics (HPSSA) and Census small-area data, listing-history datasets and their licences, HMLR title-polygon products beyond INSPIRE, any digital-register changes.
- **EPC data licence terms** (address-field restrictions, UPRN field) on the new service were not confirmed.
- **OS Data Hub prices** and any free-tier thresholds were not retrieved.
- **Property-level NaFRA2 access** (per-address risk via API) was not confirmed.
- Whether the UPRN lookup will ever be backfilled is not stated beyond "will not provide back-dated data".

## 6. Time-series foundation models (Chronos, TimesFM, Moirai, Lag-Llama and successors) for local house-price index nowcasting

### Takeaway
No evidence was found that time-series foundation models beat simple indices or classical baselines for house-price nowcasting; no study on house-price indices surfaced at all. Adjacent evidence from finance says naive and ARIMA baselines remain hard to beat at short horizons. Search on this topic was cut short.

### Cited Findings
- **No house-price-index evaluation of Chronos or TimesFM was found** in the search; results came from adjacent domains only. — [search results incl. arXiv 2511.18578](https://arxiv.org/html/2511.18578v1)
- **Finance (Nov 2025):** on excess-return forecasting, Chronos (large, 512-step context) had out-of-sample R² of −1.37% and TimesFM (500M) −2.80%; both families improve with larger models and longer windows. Returns are far noisier than house-price indices. — [arXiv 2511.18578](https://arxiv.org/html/2511.18578v1)
- **Stock prices (2025–26 master's thesis):** naive and ARIMA remained strongest for short-horizon price forecasts and during the 2022 downturn. — [Leiden LIACS thesis](https://theses.liacs.nl/pdf/2025-2026-KourntidisDDimitrios.pdf)
- **Model capabilities (2026 benchmark "It's TIME"):** 12 foundation models evaluated from official checkpoints; Chronos-2, VisionTS++, Toto and Moirai 1.1 natively take multivariate input, which is what a rates- or income-aware housing model would need. — [arXiv 2602.12147](https://arxiv.org/pdf/2602.12147)
- **Household electricity load:** foundation models were comparable to task-specific transformers and better with longer inputs. Not housing. — [arXiv 2410.09487](https://arxiv.org/html/2410.09487v3)
- **Operational-viability study (May 2026)** and a living benchmark (Aug 2026) exist but were not read. — [arXiv 2605.24381](https://arxiv.org/pdf/2605.24381); [arXiv 2608.17299](https://arxiv.org/pdf/2608.17299)

### Inferences
- **Low expected value for this AVM.** Local house-price indices are short, smooth, monthly and strongly autocorrelated, the setting where a random-walk-with-drift or ARIMA is a strong baseline. The gain from a foundation model is likely small and is unproven.
- **The practical problem is time-adjusting comps, not forecasting.** A simple test is: does indexing comps to the valuation date with any index (official local HPI vs a foundation-model nowcast of the latest unpublished months) lower hold-out MdAPE? If plain indexing shows no gain, a fancier nowcast will not either.
- Zero-shot models need no training, so a backtest against the published index history is cheap if someone wants the measurement.

### Gaps
- **Search budget ran out** before targeted queries on house-price indices, repeat-sales vs hedonic nowcasting, Chronos-2 / TimesFM 2.5 / Moirai 2 releases and benchmark standings (GIFT-Eval, fev-bench), Lag-Llama successors, and central-bank evaluations.
- No source was retrieved on UK House Price Index publication lag or revision size at local-authority level.
- **[background, not verified this session]** Chronos-2 (Amazon, Oct 2025) added covariate and multivariate support in a zero-shot model; TimesFM 2.5 (Google, 2025) lengthened context and added quantile forecasts. Neither was re-checked.

## 7. Lead scoring and propensity-to-sell with few labels; published work on which probate/inherited or distressed properties sell, and how fast

### Takeaway
No peer-reviewed study was found on predicting which probate, inherited or distressed properties sell or how fast; public evidence is limited to US vendor and brokerage write-ups of 6–12-month "likely to sell" models built on far more labels than the reader has. The few-label techniques asked about (LLM rubric scoring, embeddings plus small models, learning-to-rank, uplift, active learning, bandits) could not be searched before the budget ran out.

### Cited Findings
- **Brokerage "likely to sell" model (2020–2022 engineering posts):** takes a home and homeowner as input and estimates the likelihood of sale in the next 12 months, trained on labelled sold/not-sold homes; the authors stress it is predictive, not causal, and that feature engineering should follow a model of what drives owners to sell. US. — [Compass engineering blog](https://medium.com/compass-true-north/likely-to-sell-recommendations-for-real-estate-47e2f5c37f4); [feature-engineering post](https://medium.com/compass-true-north/framing-feature-engineering-for-machine-learning-a-generative-model-of-homeowners-likelihood-to-sell-f96f21d6d6d0)
- **Vendor propensity scoring:** predicts sales within 6–12 months from property, owner-behaviour and market data; names random forests as an entry-level method; claims high-propensity properties are 26x more likely to list within three months. Marketing claim, unverified. US. — [BatchData](https://batchdata.io/blog/science-behind-sale-propensity-scoring)
- **Signals named in a US patent:** length of ownership and owner's age as prediction factors; probate or inheritance is not described. — [US patent 11615432](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11615432)
- **No academic study of probate or inherited-property time-to-sale** surfaced in the search. — [search results, e.g. Compass post](https://medium.com/compass-true-north/machine-learning-in-action-for-compasss-likely-to-sell-recommendations-699a6dcd5076)
- **Small-data classifiers:** tabular foundation models are reported to excel on smaller datasets (see section 1). — [TabArena paper](https://arxiv.org/html/2506.16791v4)

### Inferences
*All of the following are reasoned candidates from general ML practice. None was sourced this session. Each needs measuring.*
- **Start by defining the label and a frozen backtest,** mirroring the AVM discipline: for each lead, freeze the score and features at scoring time, then record outcomes (replied, viewing booked, offer accepted, completed; and whether the property later sold to anyone, visible in Land Registry data). Without frozen scores, no method can be compared.
- **Free outcome label:** "did this property sell within N months" can be read from Price Paid Data for every past lead, including ones never contacted. With the new UPRN lookup this join is exact for sales from Aug 2026. That gives a propensity-to-sell label at zero cost, separate from the scarcer "sold to us" label.
- **Candidate A, tabular foundation model as scorer:** with hundreds to low thousands of labelled leads, an in-context classifier is a low-effort baseline to compare against the current hand-built score (licence and privacy caveats in section 1).
- **Candidate B, LLM rubric features, small model on top:** have an LLM answer fixed, auditable rubric questions about each lead (for example: is there a named executor; is the property vacant; lease years remaining band), store the answers as features, and fit a simple calibrated model. This keeps the LLM out of the final number, in line with the AVM finding that LLMs understate uncertainty.
- **Candidate C, rank metrics over accuracy:** the founder works the top of a list, so judge by precision in the top-k and by lift over the current score, not by overall accuracy.
- **Uplift modelling and bandits need volume the reader probably lacks.** Uplift needs randomised contact/no-contact data; bandits over outreach variants need many sends per arm. With vendor emails always held for human review, a simple randomised A/B on draft variants with a pre-set sample size is the realistic version.
- **Active learning fits the workflow:** founder feedback on borderline leads is a label source; prioritise review of leads where the score is least certain.
- **Time-to-sale** is a survival-analysis problem (many leads are censored: not yet sold). A Kaplan–Meier curve per lead type (probate, repossession, chain break, short lease) from Price Paid outcomes would be the first honest baseline.

### Gaps
- **Search budget ran out** before any query on: LLM-as-scorer with rubrics, embeddings plus small models, learning-to-rank for lead lists, uplift modelling, active learning from human feedback, contextual bandits for outreach, survival models for time-on-market, or UK studies of probate sale timing and sale fall-through rates.
- No source was found for UK base rates (share of probate properties sold within 12 months; chain-break fall-through rates). These would be valuable priors and should be searched in a follow-up.
- No published accuracy (AUC, lift) for any propensity-to-sell model was found; vendor figures are marketing claims.

## 8. LLM forecasting: state of "forecaster" research in 2026 vs human superforecasters; usefulness for deal-level predictions (time-to-completion, fall-through risk)

### Takeaway
By 2026 the best LLM systems are reported, on preliminary benchmark results, to be statistically indistinguishable from superforecasters on public world-event questions, though expert human forecasters still beat individual bots on at least one live leaderboard as of May 2026. There is no evidence about private, deal-level questions, and the property-specific finding is that LLMs understate uncertainty.

### Cited Findings
- **Parity claim (Forecasting Research Institute, 2026; exact date not captured):** on ForecastBench, several models are "already statistically indistinguishable from superforecaster-level accuracy"; an AI system ranked above superforecasters on market questions for the first time. Described as preliminary; results may shift as more questions resolve. A fresh superforecaster round was planned for autumn 2026. — [FRI Substack](https://forecastingresearch.substack.com/p/ai-models-have-likely-reached-parity)
- **Earlier FRI projection:** LLMs would match superforecasters on ForecastBench in November 2026 (95% CI December 2025 to January 2028); at that earlier update the gap was Brier 0.101 (best LLM) vs 0.081 (superforecasters). — [FRI Substack](https://forecastingresearch.substack.com/p/ai-llm-forecasting-model-forecastbench-benchmark)
- **Sceptical synthesis (2026):** as of May 2026, human "Pro" forecasters beat individual bots on Metaculus's FutureEval leaderboard; several papers claiming superhuman forecasting rely on retrospective backtests on already-resolved questions, and one prominent result reportedly does not replicate on a different question set. — [LessWrong synthesis](https://www.lesswrong.com/posts/a82q6yd8zKpYk56cF/ai-forecasting-in-2026-what-11-analyses-say)
- **Benchmark design:** ForecastBench is a dynamic benchmark built to avoid leakage by using questions that resolve after model release. — [arXiv 2409.19839](https://arxiv.org/pdf/2409.19839)
- **Head-to-head study (Jul 2025):** evaluates LLMs on real-world forecasting questions against expert and superforecaster baselines. Details not read. — [arXiv 2507.04562](https://arxiv.org/html/2507.04562v3)
- **Property-specific caution (Jun 2025):** LLMs asked for house-price ranges consistently produce intervals that are too narrow. — [arXiv 2506.11812](https://arxiv.org/html/2506.11812v1)

### Inferences
- **The evidence does not transfer directly.** Benchmarks cover public questions with news coverage and market prices to anchor on. Deal-level questions (will this sale complete, in how many weeks) depend on private facts and have no public base rate for the model to retrieve.
- **A safe, cheap trial is "log, don't act".** Record an LLM probability for fall-through and a predicted completion week on each live deal, alongside a simple base-rate forecast, and score both with Brier score once deals resolve. Display-only, as the reader already does for model-read email digests. With tens of deals a year, it will take a long time to separate the two.
- **Base rates first.** The reader's own completed and fallen-through deals, even a few dozen, give a base rate that any LLM forecast must beat to be worth showing.
- Backtesting an LLM on past deals risks leakage (the model or its context may already contain the outcome), the same flaw the sceptical synthesis flags in the research literature.

### Gaps
- **The date and exact figures of the FRI parity post** were not captured; no peer-reviewed final 2026 ForecastBench report was found.
- **No study of LLM forecasting on private, small-business or transaction-level outcomes** was found; follow-up searches were cut off by the budget.
- No source on UK sale fall-through base rates or completion-time distributions was retrieved.
- Calibration quality of 2026 models (as opposed to Brier-score rank) was not sourced.

## 9. Evaluation practice: backtesting methodology for AVMs, leakage, and sample-size/confidence intervals for a ~200-sale hold-out

### Takeaway
Published practice says to test out of sample and forward in time, to report coverage (hit rate) next to accuracy, and to watch for asking-price leakage, which alone explains most of the gap between on-market and off-market results. My own simulation shows a 209-sale hold-out pins MdAPE down to roughly ±2 percentage points, so only improvements of about 1.5–2.5 points are reliably detectable even with a paired comparison.

### Cited Findings
- **Out-of-sample validation by the user:** Freddie Mac's guidance is that the user runs its own tests to validate an AVM's values, confidence scores and FSDs, out of sample. US. — [Freddie Mac white paper](https://my.sf.freddiemac.com/docs/pdf/fact-sheets/dougwhitepaper_metricsmatter.pdf)
- **Asking-price leakage is large:** Zillow's on-market accuracy is measured from the last estimate shown before the home goes pending, when the list price is known; median error is 1.77% on-market vs 7.20% off-market (Oct 2026). — [HomeLight](https://www.homelight.com/blog/buyer-most-accurate-home-value-website/); [Boston Globe, 23 Oct 2026](https://www.bostonglobe.com/2026/10/23/real-estate/home-value-estimates-zillow-redfin/)
- **Report hit rate with error:** an AVM can show strong error figures on the cases it chooses to value and still fail in use if it skips too many; tighter comp filters lower observed error and lower hit rate. — [BatchData](https://batchdata.io/blog/avm-accuracy-study-metrics-matter); [Clear Capital glossary](https://www.clearcapital.com/blog-avm-testing-glossary/)
- **A median hides the tail:** a 7.2% median error means half of estimates miss by more; share-within-5/10/20% bands are published alongside. — [HomeLight](https://www.homelight.com/blog/buyer-most-accurate-home-value-website/)
- **Temporal validation in recent research:** the Mar 2026 retrieval paper built a new dataset "with explicit temporality"; UK open-data projects use time-based validation and spatial block cross-validation. — [arXiv 2603.12986](https://arxiv.org/pdf/2603.12986v1); [GitHub project](https://github.com/Pulak-PSR/uk-house-price-prediction); [GitHub project](https://github.com/camerons-world/house_price_prediction)
- **Leak checks as a baseline:** a 2025 benchmark paper adds a "Complete Leak" baseline that feeds the target in as a feature to expose leakage in benchmark design. — [arXiv 2507.07829](https://arxiv.org/html/2507.07829v1)
- **Benchmark vs surveyor is not benchmark vs sale:** UK vendor figures are often against surveyor values (80% within 10%), not sold prices. — [Hometrack](https://www.hometrack.com/uk/automated-valuation-model/)

### Inferences
*Own calculations (simulation run 25 Nov 2026; assumptions stated). Not from a published source.*
- **Precision of the current reading.** With n = 209 and a true MdAPE of 12.3%, the sampling standard deviation of the measured MdAPE is about **1.0 point** (normal errors) to **1.2 points** (Laplace, heavier tails). A 95% range is roughly **10.1% to 14.9%**. So "12.3%" really means "about 10–15%".
- **Precision of share-within-10%.** At a true share near 42%, n = 209 gives a standard error of about 3.4 points, so a 95% interval of about **±6.7 points**. Share-within-20% (about 70%) has ±6.3 points.
- **Detectable improvement, paired design** (both methods value the same 209 sales; one-sided 5% sign-flip test on the paired difference in absolute percentage error; improvement modelled as a uniform shrink in error):
  - 12.3% → 11.3% (1 point): power only **22–56%**. Not reliably detectable.
  - 12.3% → 10.8% (1.5 points): power **37–85%**.
  - 12.3% → 10.3% (2 points): power **56–98%**.
  - 12.3% → 9.8% (2.5 points): power **75–100%**.
  - The range depends on how correlated the two methods' errors are (0 to 0.8) and how heavy the tails are. Variants of one AVM are usually highly correlated, which is the favourable end.
- **Reading the earlier result.** The previously measured move from 15.6% to 12.3% (3.3 points) is well inside the detectable range for a paired test at this sample size.
- **Practical rules that follow:**
  - Always compare methods **paired on the same sales**, and report a bootstrap confidence interval on the difference in MdAPE, not two separate medians.
  - Pre-state the metric (MdAPE), a secondary metric (share within 10% and within 20%), and the decision threshold before running a candidate.
  - **Do not tune on the 209.** Each extra candidate tried against the same hold-out raises the chance of a lucky win. Keep a second, later slice of sales untouched as a confirmation set, or grow the hold-out each quarter with newly registered sales.
  - Report **hit rate** with every result, so a candidate cannot win by refusing harder cases.
  - Report **signed bias** (median signed error) as well; a comps method can be accurate in MdAPE yet biased in a moving market.
  - Value each hold-out sale **as of just before its sale date**, using only data registered before then. Price Paid records arrive with a lag, so "data available at the time" should respect registration date, not sale date.
  - If asking prices are ever added as a feature, score listed and unlisted homes separately.
  - Growing the hold-out to about 800 sales would halve these intervals (precision scales with the square root of n).

### Gaps
- **Search budget ran out** before queries on formal standards: IAAO ratio-study metrics (COD, PRD), European AVM Alliance testing guidance, lender AVM-testing vendors, and published guidance on confidence intervals for MdAPE.
- **[background, not verified this session]** US interagency quality-control standards for AVMs (final rule 2024, effective 1 Oct 2025) require policies for confidence in estimates, protection against data manipulation, random sample testing and non-discrimination; not re-checked.
- No published source was found for how large an accuracy gain is "detectable" at a given sample size; the figures above are from my own simulation and rest on its assumptions (symmetric error distributions; uniform error shrink; errors independent across sales). Real hold-out errors cluster by area and month, which would widen the intervals somewhat.
- The simulation script was run in a temporary scratch directory and is not saved in the repository.
