# Perplexity deep-research brief — marketing the volume book

_Last verified against the site source (`apps/web`, `master` @ af5a12c): 2026-08-28.
The live domain could not be fetched from this session; spot-check wearekept.co.uk
before first external use._

**Companion docs:** `docs/brand/KEPT.md` (voice + copy truth rules),
`docs/marketing/PLAN.md` (internal channel plan), `CLAUDE.md` § Public promises.

---

## What this is

- **Three copy-paste prompts** for Perplexity, Deep Research mode.
- **Prompt A** → research that feeds the **marketing brief**.
- **Prompt B** → research that feeds the **advertising brief**.
- **Prompt C** → a shortlist of **UK agencies and freelancers**.
- Scope is the **volume book only**: probate, chain break, separation,
  relocation, repossession risk, problem property. The higher-value London
  acquisition track is **deliberately excluded**.

## How to use

1. Open Perplexity. Switch to **Deep Research**.
2. Start a **new thread per prompt**. Paste the **context block** first,
   then one prompt, as a single message.
3. Run **A**, then **B**, then **C** (C is better once you know the channels).
4. Save each answer. Bring all three back here: the outputs are **research,
   not the briefs** — the marketing brief and advertising brief get written
   from them, against our guardrails (appendix below).
5. **Spot-check any number** before it goes in front of a customer or an
   agency. Perplexity cites sources; follow the links.

## Before you paste — what is deliberately left out

This document will be pasted into an external tool. It therefore contains:

- **No internal ops targets** — only the SLAs we advertise publicly.
- **No prime-track detail** — thesis, thresholds, and districts stay internal.
- **No platform internals** — nothing about our stack, crons, or data sources.
- **Postcode districts ARE included** — local research (media costs, local
  competitors, solicitor partners) needs them. Trim to city level before
  pasting if you would rather not share the patch.

---

## THE CONTEXT BLOCK — paste this first, every time

```
ABOUT US

We are Kept (wearekept.co.uk), the consumer brand of Bellwood Lane
Ventures: a small, founder-led UK direct-to-vendor cash property buyer.
Two founders. Early stage, live and trading.

WHAT WE DO
We buy homes for cash, directly from sellers who need speed and
certainty more than the last pound of open-market value. We are
deliberately selective. Our positioning line is "we won't buy any
home": we name the situations we are right for, we name the ones we
are wrong for, and we tell people when a high-street agent will serve
them better. We name the trade-off out loud: our offers are below
open-market value by design, because we buy for cash, complete in
weeks, charge the seller nothing, and carry the fall-through risk.

THE PROMISE WE ADVERTISE (exact, do not compress or speed up)
1. Same-day response to every enquiry.
2. We view every property before we price it. No offer without a
   viewing, and no figure is ever shown on screen.
3. A written cash offer within two working days of the viewing or
   fewer, with the notes that informed it.
4. The offer is binding upon Kept for a week. The seller is not bound
   until exchange and can walk away at any point before exchange at
   no cost. We do not renegotiate between issue and exchange (three
   narrow, always-stated exceptions: material survey defect, material
   title issue, materially incorrect information).
5. Completion at the seller's pace: as little as two weeks, or as long
   as a grant of probate, court date, or onward purchase requires.
6. No fees to the seller, ever. Each side pays its own legal costs.

CREDENTIALS
Member of the Property Redress Scheme. We voluntarily follow The
Property Ombudsman code. HMRC-registered for anti-money-laundering
supervision. ICO-registered as a data controller. Cash property
buying is not FCA-regulated and we say so plainly; we never use the
word "advice".

WHO WE BUY FROM (our segments, in priority order)
1. Probate executors — completion flexes to the grant date; the
   message is closure, never deadlines or costs.
2. Chain breaks — the buyer pulled out, the onward purchase is at
   risk; we step in so the chain holds.
3. Mortgage-refused / survey down-valued sellers.
4. Separation and divorce — clean break, solicitors talk to
   solicitors.
5. Relocation — moving abroad or for work; sign once, complete when
   needed.
6. Repossession risk — a controlled voluntary sale before a forced
   one; we always signpost free debt advice (StepChange, Citizens
   Advice) and we decline to buy when a fast sale would leave debt
   the seller cannot service.
7. Problem property — knotweed, short lease, cladding, structural,
   non-standard construction; stock high-street lenders won't
   mortgage.

WHAT WE BUY
Residential UK property, roughly £150k–£800k. Not commercial,
agricultural, equestrian, or heritage assets; not under £80k or
over £2m.

WHERE WE OPERATE
Northern England. Primary patch: Manchester and Stockport (M14, M19,
M20, M21, SK4, SK5, SK7, SK8), Leeds (LS1, LS6, LS8, LS17),
Sheffield (S1, S7, S11, S17).

OUR VOICE
Calm certainty. Closer to a chartered surveyor than a property
influencer. Numbers and specifics instead of adjectives. Plain
English. Empathy without drama. Never: urgency timers, "instant
cash", exclamation marks, "we buy any house" energy.

TWO AUDIENCES
Sellers are the primary audience. Estate agents are a secondary,
repeat audience: a partner programme pays agents a per-deal fee, in
writing, for chain-break referrals the open market is about to lose.

STAGE AND BUDGET
Early stage. Paid acquisition starts around £1,000/month and scales
only on measured cost per lead. We would rather grow slowly than
spend badly.
```

---

## PROMPT A — market + audience research (feeds the marketing brief)

```
TASK
You are researching the UK "quick sale" / direct cash home-buying
market for the company described above. Produce a deep, sourced
research report we will use to write a marketing brief for our
mainstream segments (probate, chain break, separation, relocation,
repossession risk, problem property). UK sources only. Prefer the
last 24 months. Cite everything. Where data is older or an estimate,
say so explicitly. If something cannot be verified, write "could not
verify" rather than guessing.

RESEARCH QUESTIONS

1. SEGMENT SIZE. For England (and Wales where data allows), what are
   the best current figures for: (a) grants of probate issued per
   year and the share of estates including property; (b) the
   proportion of agreed residential sales that fall through before
   completion, and the main causes; (c) mortgage possession claims
   and orders, and arrears trends; (d) divorces per year involving
   an owned home; (e) emigration/relocation volumes among
   homeowners; (f) the stock of hard-to-mortgage property (short
   leases, cladding-affected flats, Japanese knotweed,
   non-standard construction).

2. SELLER BEHAVIOUR. For each segment: what do these sellers search
   for, when, and on what device? What is the typical decision
   journey and timeline? Who influences the decision (solicitors,
   family, agents, debt charities)? What research exists on the
   emotional state and information needs of bereaved executors and
   financially distressed sellers?

3. COMPETITOR TEARDOWN. Identify the 10–15 most visible UK cash
   house-buying companies (national and any active in Manchester,
   Leeds, or Sheffield). For each: their headline claims, fees,
   claimed timescales, whether they publish their pricing method,
   Trustpilot score and complaint themes, memberships (NAPB, The
   Property Ombudsman, Property Redress Scheme), and any ASA
   rulings, press investigations, or regulatory findings against
   them. Present as a table.

4. ADJACENT MODELS. How are modern method of auction, assisted-sale,
   part-exchange, and iBuyer-style offerings positioned in the UK,
   and where do they win or lose against a direct cash buyer?

5. TRUST. What does research and press coverage say sellers fear
   about cash buyers (price drops at the last minute, hidden fees,
   pressure)? Which trust signals measurably matter (redress-scheme
   membership, published methodology, reviews, real people)? What
   happened to the sector's reputation since the OFT's 2013
   quick-sale study, and what replaced that oversight?

6. ORGANIC CHANNELS. What content currently ranks in the UK for
   probate-property, chain-break, and problem-property questions?
   Which money-advice and consumer sites (StepChange, Citizens
   Advice, MoneySavingExpert, Which?) link out to or cover cash
   buyers, and on what terms? Are UK solicitors permitted to receive
   referral fees for introducing clients to a property buyer, and
   what disclosure rules apply?

7. LOCAL. For Manchester/Stockport, Leeds, and Sheffield: which
   local competitors are visible; what do local press and community
   media charge for advertising; which probate solicitor firms are
   prominent in these postcodes?

8. MESSAGE LANGUAGE. What guidance exists (from bereavement
   charities, debt charities, and financial-services copy research)
   on language that respects bereaved or financially distressed
   audiences? Give examples of UK financial or legal brands widely
   considered to do empathetic marketing well.

9. FACT REFRESH. Find the most current, citable UK sources for:
   (a) the share of agreed sales that collapse; (b) average time
   from offer accepted to completion; (c) typical high-street
   estate-agency fees. We currently cite roughly "1 in 3"
   (TwentyCi), "4–6 months", and "1–1.5% + VAT" — confirm, update,
   or correct.

OUTPUT FORMAT
Structure the report with these headings: 1. Market context /
2. Segment deep-dives (one per segment: size, triggers, journey,
messaging insight) / 3. Competitor table / 4. Positioning
opportunities and gaps / 5. Trust and reputation / 6. Organic and
referral landscape / 7. Local picture (Manchester, Leeds, Sheffield)
/ 8. Language guidance / 9. Refreshed facts / 10. Full source list.
```

---

## PROMPT B — advertising research (feeds the advertising brief)

```
TASK
You are researching paid advertising for the company described
above: a UK direct cash home buyer marketing to sellers in probate,
chain-break, separation, relocation, repossession-risk, and
problem-property situations, in Manchester/Stockport, Leeds, and
Sheffield. Starting media budget is around £1,000/month, scaling
only on measured cost per lead (target: under £250 per qualified
form submission). Produce a sourced report we will use to write an
advertising brief. UK sources only, last 24 months preferred, cite
everything, and mark estimates as estimates.

RESEARCH QUESTIONS

1. GOOGLE SEARCH. Current UK search volumes and typical CPCs for
   terms across our segments, e.g. "sell house fast", "cash house
   buyer", "sell probate house", "selling a house in probate",
   "buyer pulled out of house sale", "house sale fell through",
   "sell house quickly divorce", "sell house with knotweed",
   "sell flat short lease", plus city-modified variants. Which
   terms are commercially viable at a £1k/month budget and which
   are dominated by national spenders?

2. AD POLICY. What Google Ads and Meta policies currently apply in
   the UK to (a) housing-related ads, (b) ads reaching financially
   distressed audiences, (c) remarketing to visitors of
   distress-themed pages? Does any "special ad category" or
   personalised-ads restriction apply to a UK cash home buyer?
   What targeting is off-limits?

3. COMPETITOR ADS. Using the Google Ads Transparency Center and the
   Meta Ad Library, what are the most visible UK cash-buyer
   advertisers currently running? What claims, offers, extensions,
   and landing pages do they use?

4. COMPLIANCE ON CLAIMS. Which specific ASA rulings exist against
   UK quick-sale / cash home-buying advertisers, and for which
   claims ("up to 100% market value", "sell in 7 days", "no fees",
   guaranteed offers)? What wording patterns have survived
   scrutiny? Summarise the CAP Code sections and CPR 2008 duties
   most relevant to this category.

5. CREATIVE AND LANDING BENCHMARKS. UK lead-gen benchmarks for
   property/financial services: landing-page conversion rates, form
   length trade-offs, impact of trust elements (redress scheme
   logos, reviews, named founders, published methodology), and
   call-vs-form preference for older executors.

6. OFFLINE. For probate specifically: what are current UK costs and
   response benchmarks for (a) direct mail, and what legitimate,
   ICO-compliant probate/bereavement data sources exist for it
   (note the 2019 ICO action involving Smee & Ford, and what
   changed); (b) local press advertising in Manchester, Leeds, and
   Sheffield; (c) solicitor-facing channels (Law Society Gazette,
   local law-society events)?

7. BUDGET MODEL. Given the CPCs found in Q1, model what
   £1,000/month realistically buys per channel in our three cities,
   and what monthly lead volume that implies at typical conversion
   rates. At what spend do Performance Max, Meta retargeting, and
   Microsoft Ads become worth adding?

8. MEASUREMENT. UK-GDPR-clean approaches to call tracking, form
   tracking, and offline conversion import at small budgets;
   consent-mode implications; a sensible UTM scheme; how small
   advertisers judge incrementality.

9. KEYWORD HYGIENE. Commonly used negative-keyword themes for this
   category (renting, "we buy any car", jobs, US terms), and
   brand-safety considerations for appearing against news about
   repossessions or bereavement.

OUTPUT FORMAT
Structure the report: 1. Search demand and CPC table by segment and
city / 2. Policy constraints / 3. Competitor ad teardown /
4. Compliance: banned vs surviving claims / 5. Creative and landing
insights / 6. Offline options for probate / 7. A modelled
£1,000/month starting split with expected cost per lead /
8. Measurement setup / 9. Negative keywords and brand safety /
10. Full source list.

CONSTRAINTS FOR ANY RECOMMENDATIONS
Never recommend urgency tactics (countdown timers, "instant offer"
claims), never a price or valuation figure shown on screen, and any
distress-audience ad must accommodate signposting to StepChange and
Citizens Advice. Our advertised timings are fixed: same-day
response, written offer within two working days of viewing, offer
held for a week, completion in as little as two weeks. Do not
propose claims faster than these.
```

---

## PROMPT C — agencies and freelancers (the shortlist)

```
TASK
Find UK agencies and freelancers who could run marketing and
advertising for the company described above. Budget reality: media
spend starts around £1,000/month, so we need boutique agencies or
senior freelancers who take small accounts seriously, not network
agencies. We value sensitive-sector experience (property, legal,
financial services, later-life, charity) and a calm, plain-English
creative style. Remote UK is fine; Manchester, Leeds, or Sheffield
presence is a plus.

WHAT WE NEED COVERED (may be one provider or several)
a. Paid search (Google Ads) management for sensitive categories at
   small budgets.
b. SEO and long-form content: plain-English guides for probate,
   chain-break, and problem-property questions, written to a strict
   editorial bar.
c. Direct mail for probate: compliant data sourcing, print,
   fulfilment.
d. Occasional brand/design support (we have a defined brand system;
   we need execution, not reinvention).

RESEARCH QUESTIONS

1. AGENCY SHORTLIST. 10–15 UK boutique agencies with named,
   verifiable casework in property, legal, financial services, or
   other sensitive categories, and evidence they serve small or
   founder-led clients. For each: name, location, headcount if
   published, two relevant named clients or case studies (link
   them), services, typical minimum monthly fee if published,
   website. Only include agencies you can link to. Mark fees as
   "published" or "estimated". Do not rely on pay-to-play "best
   agency" listicles; prefer named casework, industry press (The
   Drum, Campaign, Prolific North), and award records.

2. FREELANCER SHORTLIST. 8–12 UK freelance specialists: PPC
   consultants and SEO/content writers with property, legal, or
   financial-services portfolios. Check ProCopywriters directory,
   YunoJuno, Worksome, and LinkedIn. Same rule: link or leave out.

3. PROBATE DIRECT MAIL. Which UK providers legitimately supply
   probate or bereavement-related data and mailing services today,
   post the 2019 ICO enforcement in this space? What compliance
   posture do they claim? Which direct-mail houses specialise in
   sensitive sectors?

4. PRICING NORMS. Current UK rates: PPC management at under
   £2k/month media (flat fee vs percentage); per-article or
   day-rate for specialist SEO content; direct mail cost per piece
   at 500–2,000 volume; fractional/part-time marketing lead
   day-rates in northern England.

5. SELECTION. The 10 best questions to ask in a first call with an
   agency or freelancer for this brief; contract norms to insist on
   (30-day rolling, account access owned by us, no long tie-ins);
   and red flags specific to this sector (guaranteed rankings,
   urgency-led portfolios, content farms, "we buy any house"-style
   creative history).

OUTPUT FORMAT
1. Agency table / 2. Freelancer table / 3. Probate mail providers /
4. Rate benchmarks / 5. Selection questions, contract norms, red
flags / 6. Full source list. UK providers only. Never invent a
provider, a client, or a fee; write "not published" where
information is missing.
```

---

## Appendix — guardrails for whoever we hire (binding)

Send this section, as-is, to any agency or freelancer we engage.
It is the compressed form of `docs/brand/KEPT.md`; the live site is
the source of truth for every claim.

**The promise, verbatim — never compressed, never faster:**

- Same-day response.
- We view every property before we price it.
- Written offer within **two working days of viewing** or fewer.
- **Binding upon Kept for a week.** Never "legally binding".
- Completion **in as little as two weeks**, at the seller's pace.
- No fees to the seller; each side pays its own legal costs.
- Three renegotiation exceptions exist and are **always stated**.

**Hard rules:**

- **No indicative offers.** No valuation or offer figure on screen,
  in an ad, or in any tool. Offers are reviewed by a person and sent
  by email after a viewing.
- **Never "advice."** We are not FCA authorised. Say "an honest steer".
- **Probate copy carries no numbers.** No IHT interest rates, no
  carrying costs, no deadlines. The message is closure.
- **No urgency.** No countdown timers, no "instant cash", no
  exclamation marks.
- **No em dashes** in copy. Comma, colon, or split the sentence.
  En dashes in ranges (24–48) are fine.
- **Name the trade-off.** Below open-market value by design, and why.
- **Say who we're wrong for, unprompted.** We'd rather someone sold
  well than sold to us.
- **Signpost free debt advice** (StepChange, Citizens Advice) in any
  distress-adjacent content.
- **Substantiate every claim** with a linked source (CAP Code).
- **Case studies are anonymised:** postcode area only (M14, never
  M14 5AB), no identifying photos, no names, no family
  circumstances, 30-day delay after completion.
- **Nothing goes live without founder approval.** No exceptions, no
  auto-posting.

**The voice bar (from the signed-off site copy):**

- People first: lead with the person's situation, never the deal.
- Cut what adds nothing.
- Neutral precision over drama.
- Verify before asserting; rewrite assumptions as honest ones.
- Commit firmly or not at all ("within two working days or fewer"
  beats "we aim for 24–48 hours").
- Plain English. Short declaratives. "The price holds."

**Landing pages** — live today: `/sell`, `/probate`, `/chain-break`,
`/save-the-sale`, `/separation`, `/relocation`,
`/why-we-wont-buy-any-home`, `/about`, `/agents`. Planned, not yet
live: `/sell/distress`, `/sell/problem-property`, the quarterly
completion-rate page. Do not send paid traffic to a page that does
not exist yet, and do not run paid distress-audience ads before the
distress page (with charity signposting) is live and reviewed.
