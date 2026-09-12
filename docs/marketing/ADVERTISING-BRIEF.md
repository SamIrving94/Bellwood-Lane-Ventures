# Advertising brief: the volume book

_Status: DRAFT v1, 2026-08-28. For founder review. No spend is authorised
until this is signed off._

_Last verified against the site source (`apps/web`, `master` @ af5a12c):
2026-08-28. Spot-check wearekept.co.uk before handing to an agency._

**Built from:** Prompt B deep research (Perplexity, 2026-08-28), the
guardrails in `docs/marketing/PERPLEXITY-RESEARCH-BRIEF.md`, the live-site
promise chain, and this session's follow-up verification (§13).

**Scope:** paid acquisition for the volume book: probate, chain break,
separation, relocation, repossession risk, problem property. The prime
London track is excluded. Estate agents are reached organically
(LinkedIn, email) and are not in this paid plan.

---

## 1. Background, in five lines

- **Kept** buys homes for cash from sellers who need certainty: no fees,
  no renegotiation, completion at the seller's pace.
- We advertise a fixed promise chain and never anything faster.
- We are deliberately selective: "we won't buy any home" is the
  positioning, and we say who we're wrong for.
- Patch: Manchester/Stockport, Leeds, Sheffield. Residential,
  roughly £150k–£800k.
- Voice: calm certainty. No urgency, no superlatives, no figure on screen.

## 2. Objectives and the numbers that matter

| Number | Target | Source |
|:---|:---|:---|
| Cost per qualified lead (form or tracked call) | **< £250**; kill a segment at > £600 | `PLAN.md` §10 |
| Modelled CPL at launch split | ~£61–£63 (estimate, unvalidated) | Research §7 |
| Expected lead volume at £1,000/month | **~13–17/month** (3–4 a week) | Research §7 model |
| Form-to-accepted-offer conversion | 30%+ | `PLAN.md` §10 |
| Decision window | Judge on 4–6 weeks of data, never days | Research §7 |

**Reality check:** at this budget, weekly lead volume is single-digit.
Statistical patience is part of the plan. The weekly digest reports CPL
by segment and city; changes happen monthly unless something is on fire.

## 3. Who the ads talk to

**Tier 1 at launch (paid from day one):**

1. **Probate executors.** Framing is closure, never deadlines.
   No numbers of any kind in probate creative: no IHT figures, no costs,
   and we keep timing SLAs off the ads (they live on the landing page).
2. **Chain break** (including mortgage-refused and survey down-valued).
   Framing: the move survives. Timing SLAs allowed and stated exactly.

**Tier 2 (switch on when its landing page ships):**

3. **Problem property** (knotweed, short lease, cladding, structural,
   non-standard construction). Research says this is the most viable
   niche at our budget: thin competition, matches our specialism. But
   `/sell/problem-property` does not exist yet. **Build the page first;
   no paid traffic to a page that doesn't exist.**

**Not in paid, and why:**

- **Distress (divorce, repossession, financial).** No paid until
  `/sell/distress` is live with StepChange and Citizens Advice
  signposting and Counsel has reviewed every word (`PLAN.md` §3.4).
  Separation searches route to the existing `/separation` page as a
  later low-budget test, not at launch.
- **Relocation.** Organic only for now; low search volume.
- **Estate agents.** Organic channels per `PLAN.md`; never paid here.

**Geography settings:** target the cities (Manchester, Stockport, Leeds,
Sheffield) at city level, "presence only". City level, not postcode
level: it sidesteps housing-ad targeting sensitivities on every platform
and the volume needs it anyway.

## 4. Budget: the £1,000/month launch split

From the research model (§7), adapted for one fact the model missed:
the problem-property landing page is not live yet.

**Phase 1a (now, before the problem-property page):**

| Campaign | Monthly budget | Modelled CPL |
|:---|--:|--:|
| Google Search: probate long-tail, 3 cities | £550 | ~£61 (est.) |
| Google Search: chain-break long-tail, 3 cities | £250 | ~£63 (est.) |
| Google Search: brand defence ("kept" terms) | £50 | ~£13 (est.) |
| Reserve / search-term mining buffer | £150 | n/a |

**Phase 1b (when `/sell/problem-property` ships):** carve
problem-property keywords out into their own campaign at ~£200/month,
funded from probate (£450) and the reserve (£100). Research rates this
segment "highly viable": revisit the split with real data.

**All modelled numbers are estimates from general UK benchmarks, not a
live Keyword Planner pull.** Validate in Keyword Planner before the
first pound is spent (open task, §13).

**Channel gates (in order, each gated on the last):**

1. **Google Search only** until CPL is stable under £250 for 4–6 weeks
   AND budget is fully absorbed with no Search headroom.
2. Then **Meta retargeting**: broad site-visitor audiences ONLY. Never
   build remarketing lists from distress-themed pages (probate,
   repossession): platform-policy and reputational risk. Meta's Housing
   special ad category applies: age locked to 18–65+, no narrow
   targeting, ~15km minimum radius. City-level targeting fits this.
3. Then **Performance Max**, only once there is meaningful conversion
   history for it to learn from.
4. Then **Microsoft Ads** as a cheap supplementary channel.

**Stays out:** TikTok (defer the `PLAN.md` 5% test until the paid
foundation works), X, billboards, radio (`PLAN.md` §12).

**Note for the founder:** this diverges from `PLAN.md` §4.2, which
allocated 15% PMax + 10% Meta + 5% TikTok at launch. The research says
that fragments £1,000 into ineffectiveness. If you approve this brief,
update `PLAN.md` §4.2 to match.

## 5. Campaign structure (Google Search)

**Settings, all campaigns:**

- Search network only. Display expansion OFF. Search partners OFF.
- Location: the four cities, "presence" (people in, not "interested in").
- Ads run 24/7. Sellers search in private at 11pm; never dayparted out.
- Match types: phrase and exact only. No broad match at this budget.
- Bidding: Maximise Clicks with a CPC cap (~£4) until there are enough
  conversions to switch to Maximise Conversions. Review monthly.
- One ad group per theme per city (e.g. `probate-manchester`), so ad
  copy can name the city and search terms stay readable.
- Do not bid on competitor brand names at launch: expensive, low trust,
  off-voice.

**Starter keywords, probate campaign** (phrase unless bracketed exact):

- [sell probate house], [probate house buyers], [sell inherited house]
- "selling a probate property", "probate property sale"
- "sell inherited property", "selling deceased parents house"
- "probate house sale <city>", "sell inherited house <city>"

**Starter keywords, chain-break campaign:**

- [buyer pulled out], [house sale fell through]
- "buyer pulled out of house sale", "buyer withdrew house sale"
- "chain collapsed house sale", "sale fell through after survey"
- "buyer mortgage declined seller options", "survey down valuation sell"
- City-modified variants of the top terms

**Starter keywords, problem-property campaign (Phase 1b):**

- "sell house with knotweed", "sell flat short lease"
- "short lease flat buyers", "sell house with cladding"
- "sell non standard construction house", "sell house structural problems"

**Shared negative keyword list (apply to all campaigns):**

- Rental intent: rent, rental, to let, letting, tenant, landlord
- Buyer intent: for sale, houses for sale, buy a house, first time buyer
- Jobs: jobs, careers, hiring, salary, apprenticeship
- Vehicles: car, cars, van, we buy any car
- US terms: realtor, mls, zillow, dollar
- DIY/research intent: how to, diy, checklist, template, calculator,
  estate agent fees, stamp duty
- Add weekly from the search-terms report (that is what the £150
  reserve and the mining habit are for)

**Brand safety (matters from Meta/PMax onwards):** exclude news
placements and topics around repossession court cases, bereavement, and
divorce stories. Calm certainty next to someone's real bad news reads
as exploitation.

## 6. What we say: the claims matrix

**Always available, exactly these words, never faster:**

- "Same-day response."
- "We view every property before we price it."
- "A written cash offer within two working days of viewing."
- "The offer is binding upon Kept for a week." (Never "legally binding".)
- "Completion in as little as two weeks, or at your pace."
- "No fees to you. Each side pays its own legal costs."
- "We do not renegotiate between issue and exchange." The three
  exceptions must be one click away, stated in full on the landing page
  (CAP 3.9: qualifications must be clear, not buried).

**Allowed, with care:**

- "Below open-market value, by design" plus the why: cash, speed,
  certainty, no fees, we carry the risk. Naming the trade-off is our
  positioning, not a concession.
- "We'd rather you sold well than sold to us" and who we're wrong for.
- Credentials, exact phrasings only:
  - "Member of the Property Redress Scheme" ✓
  - "We voluntarily follow The Property Ombudsman code" ✓
    (never "TPO member")
  - "HMRC-registered for anti-money-laundering supervision" ✓
  - "ICO-registered" ✓
  - NAPB: **not claimable**, we are not members (open question §13)

**Never, with the precedent that bans it:**

| Never say | Why |
|:---|:---|
| "Up to 100% market value" or any % of value | ASA ruled against a cash buyer (Chris and Leon Buy Houses) for exactly this claim |
| Anything implying we broker to third parties, or hiding that we are the buyer | ASA ruling vs We Buy Any House (2014, CAP 3.1): implied direct purchase while brokering. We genuinely are the direct buyer; say so plainly and keep it true |
| "Instant offer", "cash in 24 hours", offer figures in ads | House rules: no offer without a viewing, no figure on screen |
| "Guaranteed" anything | We say "binding upon Kept for a week", which is the true, stronger claim |
| "UK's leading / number one / most trusted" | Unsubstantiated superlatives; competitors do this, we don't |
| Urgency: countdowns, "act now", exclamation marks | Brand rules |
| "Advice" | Not FCA authorised. "An honest steer" |
| Review scores we don't verifiably hold | ASA has ruled implied Trustpilot ratings misleading (CAP 3.1) |
| Em dashes | House style: comma, colon, or split the sentence |

**Probate creative, additional rule:** no numbers at all, and keep even
our own timing SLAs off probate ads. Closure, pace, and a person
checking the offer are the messages. The SLAs live on `/probate`.

## 7. Starter ad copy (responsive search ads)

Character counts checked (headlines ≤ 30, descriptions ≤ 90). Drafts
for founder review, not approved copy.

**Probate campaign** (pin headline 1 or 2 to position 1):

Headlines:
1. `Selling a probate property?`
2. `A written offer, held a week`
3. `We complete at your pace`
4. `No fees to you, no pressure`
5. `A calm, plain-English guide`
6. `An offer checked by a person`

Descriptions:
1. `We view the property first, then send a written cash offer. It is held for a week.`
2. `Completion flexes to the grant of probate. Take the time you and your family need.`
3. `No fees to you at any point. You choose your own solicitor. We cover our own costs.`
4. `A plain-English guide for executors, and a promise in writing when you are ready.`

**Chain-break campaign:**

Headlines:
1. `Buyer pulled out?`
2. `Keep your move alive`
3. `A cash buyer who commits`
4. `Same-day response`
5. `No fees, no renegotiation`
6. `A written offer, kept`

Descriptions:
1. `Same-day response. We view, then send a written offer within two working days.`
2. `The price we put in writing is the price we complete at. Three exceptions, always stated.`
3. `We step in when a buyer pulls out, so the chain holds and your onward move survives.`
4. `Completion in as little as two weeks, or at the pace your onward purchase needs.`

**Problem-property campaign (Phase 1b):**

Headlines:
1. `Short lease? Knotweed?`
2. `We buy what lenders won't`
3. `A fair offer, in writing`
4. `Hard to mortgage? Talk to us`
5. `We view first, then commit`

Descriptions:
1. `Cladding, structural issues, non-standard builds. We view first, then commit in writing.`
2. `We name the trade-off: below open-market value, for cash, certainty and no fees to you.`
3. `Stock high-street lenders will not mortgage. A written offer, held for a week.`

**Extensions (all campaigns):**

- Sitelinks: `Who we're wrong for` → `/why-we-wont-buy-any-home`,
  `How it works` → `/sell#how`, `Our promise` → `/sell#promise`,
  `Guide for executors` → `/probate`,
  `Our methodology` → `/instant-offer/methodology`
- Callouts: `No fees to you` · `We view before we price` ·
  `Offer held for a week` · `Property Redress Scheme` ·
  `No renegotiation`
- Call extension: on, with a tracked number (§9), especially probate.

## 8. Landing pages

| Campaign | Lands on | Status |
|:---|:---|:---|
| Probate | `/probate` | Live |
| Chain break | `/save-the-sale` (form), `/chain-break` as sitelink | Live |
| Problem property | `/sell/problem-property` | **Not built. Blocks Phase 1b** |
| Separation (later test) | `/separation` | Live |
| Distress | `/sell/distress` | **Not built. Blocks any distress paid** |
| Brand | `/sell` | Live |

Rules and asks:

- Never send paid traffic to a page that does not exist. (It sounds
  obvious. The research found competitors doing the opposite with
  templated ghost pages. We don't.)
- Trust elements above the fold: redress-scheme membership, the
  no-renegotiation promise, a named human. Research says last-minute
  price drops are the sector's number-one fear; our answer is the brand.
- Give probate visitors a prominent phone option. Hypothesis from the
  research (older executors prefer calling): treat as an A/B test, not
  a fact.
- Test form length. Current four-step form vs a shorter first step.

## 9. Measurement and consent

**Consent first (this blocks everything else):**

- A proper CMP with **Google Consent Mode v2**, blocking GA4 and ad tags
  until consent, with "Reject All" as prominent as "Accept All". The ICO
  has said cookieless pings are not a lawful basis on their own.
- Do not rely on the DUAA 2025 analytics exemption: GA4 does not qualify
  by default. The CMP route is the pragmatic one at our size.

**Tracking:**

- Conversions: qualified form submission (primary), tracked calls over a
  duration threshold (secondary). Import offline outcomes (offer
  accepted) later.
- Call tracking with per-channel numbers. Prefer a UK-hosted provider to
  avoid international-transfer paperwork; if a US-hosted tool (e.g.
  CallRail) wins on features, a UK IDTA and privacy-policy disclosure of
  call recording are required, and calls must announce recording.
- UTM scheme, lowercase, boring on purpose:
  `utm_source` = google / bing / meta ·
  `utm_medium` = cpc / paidsocial / mail ·
  `utm_campaign` = segment-city (e.g. `probate-manchester`) ·
  `utm_content` = ad variant.
- Add a "how did you hear about us?" field to the offer form
  (small Engineer task) and cross-check it against platform attribution.
  At our volumes, that plus per-channel CPL discipline IS the
  incrementality plan; formal lift tests are not statistically possible.
- Weekly: the four vendor numbers from `PLAN.md` §10 into the digest.

## 10. Probate offline: hold, pending compliance

The economics look plausible; the data sourcing is the blocker.

- **Benchmarks (JICMAIL 2025 tracker):** cold mail ~0.9% response,
  £3.20 back per £1; ~£0.30–£2.50 per piece all-in. At 0.9%, cost per
  response lands around £48–£64: inside our CPL target IF the list is
  genuinely probate-triggered and responses qualify.
- **The data question, corrected after verification:** the research
  cited a "2019 ICO enforcement action" against Smee & Ford. **No ICO
  penalty is on the public record.** What happened in 2019: HMCTS
  announced (January) it was ending its data-sharing arrangement with
  Smee & Ford; the service continued under revised terms and higher fees
  from August 2019. Separately, ICO direct-marketing guidance sets a
  high bar for contacting executors: established legitimate interest,
  relevance, and minimising distress.
- **Before any mailing, all four:** (1) a named data provider with its
  lawful basis documented; (2) our own legitimate-interests assessment
  and DPIA; (3) Counsel sign-off; (4) creative that follows the probate
  rules: no numbers, closure framing, and an easy way to say no.
- **Local press and solicitor channels:** rate cards are not published.
  Direct outreach needed to Reach plc (Manchester Evening News,
  Yorkshire Post network), Sheffield titles, the Law Society Gazette
  commercial team, and the three local law societies. Founder or agency
  task; email templates can be drafted here.

## 11. Pre-flight checklist (every ad, every month)

- [ ] Every claim exactly matches the live site (the site wins).
- [ ] No claim faster than the promise chain. No figures. No urgency.
- [ ] Qualifications (the three exceptions) one click away, in full.
- [ ] Credential phrasings exact (§6). No NAPB, no "TPO member".
- [ ] Probate creative: zero numbers.
- [ ] Distress-adjacent creative: StepChange + Citizens Advice signposted.
- [ ] Landing page exists, loads fast on mobile, CMP live.
- [ ] Negative keywords reviewed against last month's search terms.
- [ ] Substantiation on file for anything factual (CAP 3.1/3.3, CPR 2008).

## 12. Approval workflow

Unchanged from the iron rule: **nothing goes live without founder (CEO)
approval.** Marketer or agency drafts; Counsel reviews anything
distress-adjacent and audits quarterly; monthly ad-copy review cadence
per `PLAN.md` §6. An agency gets the guardrails appendix of
`PERPLEXITY-RESEARCH-BRIEF.md` on day one and account access is owned
by us, always.

## 13. Verification log and open tasks

**Closed this session (2026-08-28):**

- ASA vs We Buy Any House (2014): misleading, implied direct purchase
  while brokering; "cash in typically 28 days" implications. CAP 3.1.
- ASA vs Chris and Leon Buy Houses (Liverpool): "up to 100 per cent
  market value" and cash-speed implications ruled misleading.
- Smee & Ford 2019: HMCTS contractual action, not an ICO penalty
  (nothing on the public record found). Compliance bar stands regardless.

**Open, before spend:**

- [ ] Live Keyword Planner pull for the §5 keyword lists, UK, per city.
      (Founder or agency; needs a Google Ads account.)
- [ ] Google Ads Transparency Center + Meta Ad Library pull on the
      named competitors (We Buy Any Home, Ziphouse, Housebuyers4u,
      Springmove, National Homebuyers).
- [ ] Rate cards: Reach plc titles, Sheffield press, Law Society Gazette.
- [ ] Decide: join NAPB (which brings TPO membership with it)? Founder
      call; would unlock the sector's most recognised badge set.
- [ ] Choose CMP + call-tracking provider (UK-hosted preferred).
- [ ] Engineer: "how did you hear about us" field on the offer form.
- [ ] Build `/sell/problem-property` (unlocks Phase 1b) and later
      `/sell/distress` (with Counsel, unlocks the distress segment).

## 14. Provenance: how much to trust each number

| Class | Examples | Treatment |
|:---|:---|:---|
| Verified UK | JICMAIL response rates, Consent Mode v2 requirement, ASA rulings, Meta housing category limits | Rely on, cite |
| UK benchmark, category-level | £2.18–£3.12 real-estate CPCs, 4.4–4.7% search CVR | Directional |
| US-sourced | $25–$75 cash-buyer CPCs, US CPL ranges | Pattern only, never budget on it |
| Estimate | £3–£8 UK cash-buyer CPC, all §4 CPL figures | Validate in Keyword Planner first |
| Gap | Local press rates, Gazette rates, live ad-library data | Open tasks, §13 |

**Key sources:** [We Buy Any House ASA ruling](https://mortgagesoup.co.uk/buy-house-ad-found-mislead/) ·
[Chris and Leon ruling report](https://mortgagestrategy.co.uk/misleading-property-advert-banned-consumer-complaint) ·
[ASA misleading advertising guidance](https://www.asa.org.uk/advice-online/misleading-advertising.html) ·
[Smee & Ford service continuation 2019](https://fundraising.co.uk/2019/07/04/smee-ford-to-continue-bequest-notification-service-for-at-least-12-months/) ·
[HMCTS/Smee & Ford FOI](https://www.whatdotheyknow.com/request/probate_registry_smee_and_ford_w) ·
[Smee & Ford GDPR FAQs](https://smeeandford.com/gdpr-faqs/) ·
[JICMAIL response rate tracker](https://www.jicmail.org.uk/insights/quarterly-releases/q1-2026-results-continued-uplift-in-mails-digital-effectiveness-plus-2026-response-rate-tracker/) ·
[Google restricted targeting policy](https://support.google.com/adspolicy/answer/143465?hl=en-GB) ·
plus the 46 references in the Prompt B research output (on file).
