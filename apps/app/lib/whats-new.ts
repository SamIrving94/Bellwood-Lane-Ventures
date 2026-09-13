/**
 * What's New — the release notes behind the login "moment of joy" popup.
 *
 * HOW TO ANNOUNCE A FEATURE: add an entry to the TOP of WHATS_NEW with a
 * fresh `id`. The popup shows the newest entry once per browser (dismissal
 * is remembered in localStorage under the entry id), so a new id = a new
 * moment for everyone at next login.
 *
 * Copy rules (the founders read fast, one is dyslexic): short lines, bold
 * keywords, one emoji per bullet, playful but concrete — say what they can
 * DO now, not what was implemented.
 */

export type WhatsNewEntry = {
  /** Stable slug — changing it re-shows the popup to everyone. */
  id: string;
  /** ISO date, display only. */
  date: string;
  emoji: string;
  title: string;
  intro: string;
  bullets: { emoji: string; text: string }[];
  cta?: { label: string; href: string };
};

/** Newest first. The popup shows index 0. */
export const WHATS_NEW: WhatsNewEntry[] = [
  {
    id: '2026-09-12-scout-reads-desk-drafts',
    date: '2026-09-12',
    emoji: '🔍',
    title: 'The scout now reads the listing. The desk now drafts your call.',
    intro:
      'Sam said "action everything in the report, scout first". Five things landed in one go.',
    bullets: [
      {
        emoji: '📖',
        text: 'Every listing description is **read for motivation** — executor sale, cash buyers only, relocation. It can **lift the lead type** and the score, and the quote is on the lead page.',
      },
      {
        emoji: '🔨',
        text: '**Savills and Clive Emson** auction lots now come in. Watch the first Monday scan.',
      },
      {
        emoji: '🗂️',
        text: 'Every card on the **Action Centre** opens with a **suggested call and the why**, ranked. The morning briefing leads with #1.',
      },
      {
        emoji: '📱',
        text: '**WhatsApp leads** are scored by the same scorer as the rest of the inbox, so the numbers finally compare.',
      },
      {
        emoji: '🎛️',
        text: 'Photo screening and WhatsApp parsing are now rows on **Settings → AI models** too.',
      },
    ],
    cta: { label: 'Open the Action Centre', href: '/actions' },
  },
  {
    id: '2026-09-12-deep-appraisal-second-opinion',
    date: '2026-09-12',
    emoji: '🧠',
    title:
      'The full appraisal now argues with the AVM — and you pick the brain',
    intro:
      'Sam asked "if we put an LLM over the AVM, would it not make sense for some reasoning to look at it?" Yes. It now does, and the model behind it is yours to choose.',
    bullets: [
      {
        emoji: '⚖️',
        text: 'Every deep appraisal now gets the **in-house AVM figure** and must **agree or challenge it** — with the evidence. Look for "vs in-house AVM" under ARV.',
      },
      {
        emoji: '🎛️',
        text: 'Deep appraisal is now a row on **Settings → AI models**. Point it at an **open-weights model via OpenRouter** for a fraction of the cost, no deploy.',
      },
      {
        emoji: '👥',
        text: 'Use the **shadow model** column to run a challenger silently first. Compare cost and quality on the usage stats before you flip it.',
      },
    ],
    cta: { label: 'Open AI models', href: '/settings/ai' },
  },
  {
    id: '2026-09-12-openrouter-first',
    date: '2026-09-12',
    emoji: '🔀',
    title:
      'AI calls now go through OpenRouter, and an empty balance no longer stops them',
    intro:
      'The Anthropic account ran dry and four features went quiet for days: deep appraisal, the photo screener, the morning briefing and the marketer. That failure mode is gone.',
    bullets: [
      {
        emoji: '💳',
        text: 'One bill. Set OPENROUTER_API_KEY in Vercel and every AI feature routes through it, Claude included.',
      },
      {
        emoji: '🛟',
        text: 'Out of credits, rate-limited or provider down? The call falls through to the next model instead of failing.',
      },
      {
        emoji: '🧪',
        text: 'Test open-weight models: pick a shadow model per feature in Settings → AI models, then compare on the LLM usage page. Suggested ids are pre-filled.',
      },
    ],
    cta: { label: 'Open AI models', href: '/settings/ai' },
  },
  {
    id: '2026-09-12-batch-upload-big-number',
    date: '2026-09-12',
    emoji: '📄',
    title: 'Fixed: a batch upload no longer dies on one oversized figure',
    intro:
      'The 11 Sep pipeline sheet had one Acceptable Trade Offer cell of 110,000,000 — a hundred times too big for the database. The whole upload failed silently before a batch was created, so "Run appraisals" never appeared.',
    bullets: [
      {
        emoji: '✅',
        text: 'Upload the same sheet again — every row now loads. The bad cell is left blank and that row shows as "no benchmark" so you can spot it.',
      },
      {
        emoji: '🔎',
        text: 'The limit is about £21.4m per cell. Anything above it is skipped, never guessed — fix the cell in the sheet and re-upload.',
      },
    ],
    cta: { label: 'Open Batch', href: '/batch' },
  },
  {
    id: '2026-09-12-price-per-square-foot',
    date: '2026-09-12',
    emoji: '📐',
    title: 'Square footage is in — and the AVM now prices by it',
    intro:
      'Sam asked why size was not part of the valuation. It is now. Every lead shows its floor area in sqft, and the AVM checks the whole-house comps against what nearby sold homes fetched per square foot.',
    bullets: [
      {
        emoji: '📏',
        text: "Leads list: **sqft on every card** — EPC-verified when the AVM has matched the house number, the listing's own figure before that, each labelled.",
      },
      {
        emoji: '💷',
        text: 'Appraised leads show **£/sqft for this house** next to the **nearby sold £/sqft** — sold comps matched to their own EPC floor areas, never a postcode average.',
      },
      {
        emoji: '⚖️',
        text: "The AVM now has a **size pillar**: rate × this house's sqft carries 25–30% of the blend when 2+ comps match. A house 40% bigger than its street no longer prices like its neighbours.",
      },
      {
        emoji: '🔍',
        text: 'Lead page: a **£/sqft panel** under the comps — ¼-mile vs ½-mile rates, the size-based value, and how far it sits from the whole-house comps.',
      },
    ],
    cta: { label: 'See the leads', href: '/leads' },
  },
  {
    id: '2026-09-12-two-doors-have-pages',
    date: '2026-09-12',
    emoji: '🚪',
    title: 'The two new doors now open onto their own pages',
    intro:
      'Both new reasons on /sell now lead somewhere: a page for the property with a problem or one that needs work, and a page for everyone whose reason is something else. Same template as probate and chain-break, same four steps, same honest version.',
    bullets: [
      {
        emoji: '🏠',
        text: '/problem-property: what buyers and lenders walk away from, we price and carry. Nothing to fix first, no lender to say no, honest about the price.',
      },
      {
        emoji: '🤫',
        text: '/your-situation: quickly, quietly, discreetly. No board, no listing, one visit, your date. Its honest version points to StepChange and Citizens Advice.',
      },
      {
        emoji: '📣',
        text: 'Organic only for now. Counsel reads the your-situation page before any ads point at it, as the marketing plan asks.',
      },
    ],
  },
  {
    id: '2026-09-07-new-areas-scan-first',
    date: '2026-09-07',
    emoji: '📍',
    title: 'Add an area, run the scout — it is in THAT run',
    intro:
      'A freshly added area used to slip to the back of the 6-a-day rotation, so the run you triggered for it could skip it. Fixed.',
    bullets: [
      {
        emoji: '📍',
        text: 'New areas now go to the FRONT of the rotation. Add Wanstead (E11), add South Woodford (E18), click "Run scout now" — both are scanned in that run.',
      },
      {
        emoji: '★',
        text: 'Want a patch checked on EVERY run, not just the next one? Mark it ★ Prime. That also tells the classifier to treat £700k+ finds there as prime stock.',
      },
    ],
    cta: { label: 'Open scouting areas', href: '/settings/scouting' },
  },
  {
    id: '2026-09-06-equity-proxy-flip',
    date: '2026-09-06',
    emoji: '⚖️',
    title: 'Fixed: the score no longer rewards the OPPOSITE of a discount',
    intro:
      'Sam asked "is anything else being marked down that should score up?" — and yes. Before appraisal, a house priced 50% ABOVE its street scored 15 points while one 40% UNDER it scored 3. That is now the right way round.',
    bullets: [
      {
        emoji: '💎',
        text: 'A discount WITH a condition reason (EPC evidence, unmodernised badge, dated heating) now scores top of the range: the deeper the explained discount, the more points.',
      },
      {
        emoji: '⚠️',
        text: 'A discount with NO reason keeps the honest treatment: low points and "check why" — an unexplained cheap house usually hides an unfixable problem.',
      },
      {
        emoji: '🚫',
        text: 'A price under 40% of the street earns a token whatever the evidence — that is usually a flat wearing a house’s postcode.',
      },
      {
        emoji: '🎛️',
        text: 'All eight weights are founder-tunable in the scorer config. The sourcing-gate calibration is unchanged: 285/285 tests green.',
      },
    ],
    cta: { label: 'See the leads', href: '/leads' },
  },
  {
    id: '2026-09-06-ripe-for-modernisation',
    date: '2026-09-06',
    emoji: '🔧',
    title: 'The scout now hunts the unmodernised — and badges the big tickets',
    intro:
      'Two changes to how leads rank and read: the scout finally rewards houses that have NOT been touched (it used to mark them down), and £1.5M+ prime leads wear their own badge.',
    bullets: [
      {
        emoji: '🔎',
        text: 'Each shortlisted lead now gets its OWN energy certificate read: an F or G band, a lapsed 10-year-old certificate, back boilers or storage heaters, and decades since the last sale all now ADD points instead of nothing.',
      },
      {
        emoji: '🔧',
        text: 'A new "Ripe for modernisation" pill on lead cards — hover it to see the evidence verbatim (e.g. "EPC F: heating and insulation untouched · no recorded sale since 1998").',
      },
      {
        emoji: '⭐',
        text: 'Probate leads finally show real condition proof: an old F-rated certificate now counts as the "why it is cheap" reason instead of "check why".',
      },
      {
        emoji: '◆',
        text: 'Cornerstone badge: prime leads at £1.5M+ (own value or street average) show ◆ in violet, so the big-ticket book triages first. Floor unchanged — £700k prime stands.',
      },
      {
        emoji: '🔑',
        text: 'Needs EPC_API_TOKEN on bellwood-api (same key as the web project — the launch board step now covers both). Without it, leads score as before, honestly.',
      },
    ],
    cta: { label: 'See the leads', href: '/leads' },
  },
  {
    id: '2026-09-05-two-more-doors',
    date: '2026-09-05',
    emoji: '🚪',
    title: 'Two more doors on the front page',
    intro:
      'The "why are you selling?" list on /sell now speaks to two more sellers: the property that has a problem or needs work, and anyone whose situation is something else and needs handling quickly, quietly and discreetly. Each has its own card, and its own answer in the form.',
    bullets: [
      {
        emoji: '🏠',
        text: 'Problem or needs work: major refurbishments, structural issues, knotweed. The form records it as problem_property.',
      },
      {
        emoji: '🤫',
        text: 'Something else? A tailored process for whatever the situation is. The form records it as other.',
      },
      {
        emoji: '📄',
        text: 'Their own pages are still to build. Counsel reads any financial-pressure page before ads point at it.',
      },
    ],
  },
  {
    id: '2026-09-05-phone-front-door',
    date: '2026-09-05',
    emoji: '📱',
    title: 'The front door now leads with the door on phones',
    intro:
      'Open the public site on your phone. The threshold photograph and the seal are on the first screen, where they always were on desktop. The form is one thumb-scroll down, and Get started still jumps straight to it.',
    bullets: [
      {
        emoji: '🚪',
        text: 'Photo first: on phones the photograph now sits between the headline and the form, instead of a full screen down.',
      },
      {
        emoji: '✂️',
        text: 'Less crowding: shorter step labels on phones, a tighter header, and the trust marks sit under the photo as a caption.',
      },
      {
        emoji: '🖥️',
        text: 'Desktop unchanged: same grid, same spacing, same copy. Nothing in the signed-off wording moved.',
      },
    ],
  },
  {
    id: '2026-08-30-launch-board',
    date: '2026-08-30',
    emoji: '🚀',
    title: 'The October launch board is live — one next step each',
    intro:
      'No more lists in chat. The Launch page shows Sam, Ant and Claude each ONE green "do this now" card with exact steps and a Done button. Tick it, the next one appears. Both of you see the same live board.',
    bullets: [
      {
        emoji: '✅',
        text: 'One task at a time: the green card is the only thing to look at. Steps are literal — open this, paste this, click Done.',
      },
      {
        emoji: '📋',
        text: 'Commands come with a Copy button. No retyping, no hunting through chat history.',
      },
      {
        emoji: '⏳',
        text: '"Waiting on others" shows why a task is parked — in plain words, no list numbers.',
      },
      {
        emoji: '💼',
        text: 'The PPC freelancer brief is written, with a starter shortlist and 5 screening questions: docs/marketing/freelancer-brief-ppc.md.',
      },
    ],
    cta: { label: 'Open the launch board', href: '/launch' },
  },
  {
    id: '2026-08-29-prime-2m-keyhole',
    date: '2026-08-29',
    emoji: '🗝️',
    title: 'The £2M+ trial, a district truth machine, and Keyhole is live',
    intro:
      'Three decisions, shipped together: the scout can hunt the super-prime fringe, the district list can finally be MEASURED instead of guessed, and professionals get a free report tool that quietly sends us leads.',
    bullets: [
      {
        emoji: '🏰',
        text: 'W11 + NW3 fringe trial, one command: seed-london-prime now takes --districts=W11,NW3. There was never a price ceiling in the code, only a scanning gap.',
      },
      {
        emoji: '📏',
        text: 'New arbitrage-rank script: Land Registry sales matched to EPC certificates, per district, giving real unmodernised vs refurbished £/sqft. The list stops being a hypothesis.',
      },
      {
        emoji: '🗝️',
        text: 'Keyhole is live at /keyhole (invite-only, unlisted): solicitors, surveyors and wealth managers get a one-page condition-and-value report. Never a valuation, never auto-contact.',
      },
      {
        emoji: '🤝',
        text: 'Their referrals land in deals@ with the report attached, opt-in only. The first-look playbook for buying agents is in docs/templates.',
      },
      {
        emoji: '🔑',
        text: 'One env to add: EPC_API_TOKEN on the web project, or Keyhole reports skip the EPC section (honestly, with a note).',
      },
    ],
  },
  {
    id: '2026-08-27-scout-on-demand',
    date: '2026-08-27',
    emoji: '🎯',
    title: 'The scout runs when YOU run it — and never loses a day again',
    intro:
      'Two changes: the scout is now on-demand (you trigger it, you control the spend), and a run can never again time out and throw away everything it found.',
    bullets: [
      {
        emoji: '🔧',
        text: 'Fixed: since Sunday the daily run was timing out and losing ALL its leads — four days of finds evaporated. A run now banks its leads no matter what.',
      },
      {
        emoji: '▶️',
        text: 'Run it yourself: Settings → Scouting → "Run scout now". A full sweep takes ~10 minutes; leads land on the Leads page and the review card appears in Actions.',
      },
      {
        emoji: '💷',
        text: 'You control the spend: no more automatic 7am run burning PropertyData credits daily. Run it when you want fresh stock — same-day re-runs are mostly cached, so they cost little.',
      },
      {
        emoji: '⏱️',
        text: 'If a run does run long, it says so: "ran out of time for X — leads kept, some with less detail" instead of failing silently.',
      },
      {
        emoji: '🤫',
        text: 'The watchdog no longer nags about the scout being "silent" — quiet days are your choice now, not a fault.',
      },
    ],
    cta: { label: 'Run the scout', href: '/settings/scouting' },
  },
  {
    id: '2026-08-23-ch-stream-and-connections',
    date: '2026-08-23',
    emoji: '⚡',
    title: 'Lender trouble now surfaces in minutes, not tomorrow',
    intro:
      'The scout now listens to the Companies House live stream — fresh charges and insolvencies on property companies in your patch land as leads within the half-hour. Plus: leads now show what we already know around them.',
    bullets: [
      {
        emoji: '📡',
        text: 'Live stream, every 30 minutes: a new charge or insolvency on a property company in your areas becomes a lead the same morning it is filed — the old daily check stays on as the safety net.',
      },
      {
        emoji: '🚨',
        text: 'Fresh catches get their own high-priority card — the office-holder clock is running, so you hear about it first.',
      },
      {
        emoji: '🕸️',
        text: 'New Connections panel on lead pages: the company behind a lead, its lender, and the OTHER properties it holds charges over — links no address list could show. Review-only; it never changes a score.',
      },
    ],
    cta: { label: 'See your leads', href: '/pipeline?tab=leads' },
  },
  {
    id: '2026-08-22-prime-gold-dust-capture',
    date: '2026-08-22',
    emoji: '💎',
    title: 'Prime gold dust can no longer slip through the net',
    intro:
      'Prime and block leads now ride OUTSIDE every daily limit and queue — captured the moment they appear, appraised first, and no ticket size is ever "too big".',
    bullets: [
      {
        emoji: '🛡️',
        text: 'Guaranteed capture: prime/block candidates (and probate notices in your prime areas) can no longer be squeezed out of the daily shortlist by volume leads.',
      },
      {
        emoji: '💷',
        text: 'The discount IS the deal: a house priced well under its own prime street — the deepest-margin case — now classifies as prime instead of hiding in volume.',
      },
      {
        emoji: '🔨',
        text: 'Auction guides are read as floors: near-£700k guides inside a prime area now flag as prime BEFORE the sale, and your marked prime areas count.',
      },
      {
        emoji: '⚡',
        text: 'Prime leads jump the appraisal queue (AVM and deep appraisal) — numbers ready the same day, not when the volume queue drains.',
      },
      {
        emoji: '🔍',
        text: 'Prime areas scan three extra distress lists: chain-free, cash-only and poor-EPC — the classic executor / stuck-owner / needs-work signals.',
      },
    ],
    cta: { label: 'See your leads', href: '/pipeline?tab=leads' },
  },
  {
    id: '2026-08-22-homepage-v3-situation-pages',
    date: '2026-08-22',
    emoji: '🏡',
    title:
      'The new homepage is live, and every reason to sell has its own page',
    intro:
      'The signed-off design is in production: new hero with the threshold photo and wax seal, the four-step offer form, and a landing page for each seller situation.',
    bullets: [
      {
        emoji: '✨',
        text: 'Homepage rebuilt end to end: "Selling your property shouldn\'t be painful. We make sure it isn\'t." with the promise, the honest sections and the 7-question FAQ.',
      },
      {
        emoji: '🧭',
        text: 'Four situation pages: /probate, /chain-break, /separation and /relocation, each with its own intake form. /about ("Kept\'s story") is live too.',
      },
      {
        emoji: '🤝',
        text: 'The promise is now: offer in writing within TWO WORKING DAYS of viewing, binding upon Kept for a WEEK. Every page, email and the backend lock all say the same thing.',
      },
      {
        emoji: '🧹',
        text: '"Legally binding", "indicative" and the old 24-48 hour wording are gone from every vendor-facing surface.',
      },
    ],
  },
  {
    id: '2026-08-21-prime-scout-thesis',
    date: '2026-08-21',
    emoji: '🎯',
    title: 'The prime scout now spots the money, not just the price tag',
    intro:
      'Prime leads are judged on the actual strategy: priced below their own street AND needing the work that explains why. And your prime areas now mean it.',
    bullets: [
      {
        emoji: '⭐',
        text: 'Leads that fit the thesis wear a "Prime opportunity · N% under street" badge, with the evidence spelled out on the lead page.',
      },
      {
        emoji: '🗺️',
        text: 'Mark ANY area as prime and the classifier honours it — your geography extends the built-in London list, never loses to it.',
      },
      {
        emoji: '🌆',
        text: 'Ten London prime districts seeded and scanning daily: Battersea, Balham, Tooting, Wandsworth, Clapham, Streatham, Fulham, East Dulwich, Dulwich Village and Herne Hill.',
      },
      {
        emoji: '🔧',
        text: 'Five areas were silently scanning dead postcodes (SW3, S17, M19, M20, SK5) — all repaired, so tomorrow morning is the first fully-working scout run in a while.',
      },
    ],
  },
  {
    id: '2026-08-04-receiverships-and-allsop',
    date: '2026-08-04',
    emoji: '🕵️',
    title: 'Two new hunting grounds for the scout',
    intro:
      'Deep research found where the distressed prime and block stock actually surfaces — both channels are now live.',
    bullets: [
      {
        emoji: '🏦',
        text: '**Receiverships** — when a lender seizes a property, the receiver **must sell, fast**. The scout now reads Gazette receiver notices and digs the property addresses out of Companies House charges. Appointments are running at **3× 2022 levels**, 65% residential.',
      },
      {
        emoji: '🔨',
        text: '**Allsop auctions** — the big one we were missing. One catalogue = **344 lots**, including whole London blocks (18 flats in Finsbury Park at £1.6M guide = under £90k a unit). Now feeds the Monday auction scan.',
      },
      {
        emoji: '⚖️',
        text: "Receivership deals get one extra legal check: **validate the receiver's appointment** before exchange — an invalid one can void the sale.",
      },
      {
        emoji: '📚',
        text: 'The full research with sources is in the repo, and the **Strategy proposal is updated** — Ant, the two-track decisions are still waiting on you.',
      },
    ],
    cta: { label: 'Read the proposal', href: '/strategy' },
  },
  {
    id: '2026-08-04-two-track-prime-blocks',
    date: '2026-08-04',
    emoji: '⭐',
    title: 'The scout now hunts big game too',
    intro:
      'Two businesses, one engine: volume sourcing for investors, prime + blocks for the Kept book.',
    bullets: [
      {
        emoji: '⭐',
        text: '**Prime track** — £700k+ properties are no longer buried by the volume scorer. They **skip the gate** and land on your desk with a ★ Prime badge. Architect refurb → £1M+ exits.',
      },
      {
        emoji: '🏢',
        text: '**Blocks detected** — "block of 6 flats", "freehold building", "portfolio" now get caught in listings **and** auction catalogues. They used to be dropped as development sites.',
      },
      {
        emoji: '🚨',
        text: 'Prime/block finds raise their **own daily high-priority card** — separate from the volume review pile.',
      },
      {
        emoji: '🔍',
        text: 'New **Prime / Block filter** on Leads, badges on Pipeline and deal pages. Track carries lead → deal automatically.',
      },
      {
        emoji: '📋',
        text: '**Ant: a second proposal in Strategy** — the two-track buy-box, architect terms, and blocks appetite need your call.',
      },
    ],
    cta: { label: 'See prime leads', href: '/leads?filter=primeblock' },
  },
  {
    id: '2026-08-03-field-network-legal-works',
    date: '2026-08-03',
    emoji: '🏗️',
    title: 'The back half of the deal just got a machine',
    intro:
      'Viewings, conveyancing and refurbs — the three stages that ate your week — now run on rails.',
    bullets: [
      {
        emoji: '👷',
        text: '**Field network** — add builders and retired contractors at /network. Assign one to a viewing and they get a **magic-link report form** for their phone: photos, condition scores, refurb gut-feel, how keen the seller is.',
      },
      {
        emoji: '📱',
        text: 'When their report lands you get a **high-priority action card** — review it, then confirm or tweak the offer. Their eyes, your judgement.',
      },
      {
        emoji: '⚖️',
        text: '**Legal is alive.** Going under offer now seeds a **12-step conveyancing checklist** with target days. Tick steps off on the deal page and log the panel firm.',
      },
      {
        emoji: '✉️',
        text: 'A weekday **legal chaser** drafts a nudge to the solicitor when steps run late — you review and hit send, it never fires on its own.',
      },
      {
        emoji: '🔨',
        text: '**Works tracker** — once a property is yours, open a refurb project: budget vs quoted vs actual, one work order per trade, late flags. Your field network doubles as the contractor pool.',
      },
      {
        emoji: '📋',
        text: "**Ant: a proposal awaits you in Strategy** — go Farringdon-first (Orbital's AI-native law firm) for conveyancing. Read it, pick the backup firm, decide who makes the call.",
      },
    ],
    cta: { label: 'Open the field network', href: '/network' },
  },
  {
    id: '2026-08-01-sell-page-shows-its-maths',
    date: '2026-08-01',
    emoji: '🧮',
    title: 'The seller page now shows its maths',
    intro:
      'Design-review round one shipped: the honest breakdown, real proof, a real face.',
    bullets: [
      {
        emoji: '🧮',
        text: 'New **"The maths"** section on /sell — market estimate → **our margin, named** → the figure we sign. The agent route is shown beside it and **wins the price line on purpose**.',
      },
      {
        emoji: '🧾',
        text: 'A **proof band** on /sell and /agents — one claim, one clickable third-party proof (PRS, TPO, HMRC AML, ICO). No more take-our-word-for-it.',
      },
      {
        emoji: '🙋',
        text: '**Anthony’s face is on the page** — "Software does the maths. A person makes the promise."',
      },
      {
        emoji: '📖',
        text: 'New **/probate guide** for executors — six plain-English steps, the two deadlines that bite, and where we honestly fit (and don’t).',
      },
      {
        emoji: '📍',
        text: 'Agents get the **live-timeline story** — one link, seller, agent and solicitor all see the same page.',
      },
      {
        emoji: '🚫',
        text: 'The old **£1,000 walk-away cover is retired everywhere** — offer PDF, emails, docs — matching the July terms review.',
      },
      {
        emoji: '🚪',
        text: 'The **front door is fixed** — typing the bare domain now lands sellers on the seller page, not the agent pitch. Full UX review in `docs/UX-REVIEW-2026-08.md`.',
      },
      {
        emoji: '🔏',
        text: 'A real **privacy notice** now lives at /legal/privacy — the ICO claim finally has the page to back it up.',
      },
    ],
  },
  {
    id: '2026-07-30-dashboard-wears-kept',
    date: '2026-07-30',
    emoji: '🌿',
    title: 'Your dashboard wears Kept. now too',
    intro:
      'The last room in the house got painted. Cream walls, forest ink, leaf buttons.',
    bullets: [
      {
        emoji: '🎨',
        text: 'The whole dashboard is on the **Kept palette** — same rules as the site: **leaf** for actions, **wax** only for the dot.',
      },
      {
        emoji: '✒️',
        text: 'The sidebar now carries the **kept.** wordmark on a deep forest rail.',
      },
      {
        emoji: '🌙',
        text: '**Dark mode** came along — forest-tinted, easy on late-night deal reviews.',
      },
      {
        emoji: '🏷️',
        text: 'Every page title and internal mention now says **Kept** — including two vendor-facing quote messages that were hiding in here.',
      },
    ],
  },
  {
    id: '2026-07-30-kept-is-live',
    date: '2026-07-30',
    emoji: '🎉',
    title: 'You said go — the company is now Kept.',
    intro:
      'The name flipped today. The whole front door reads kept. — wax dot and all.',
    bullets: [
      {
        emoji: '✍️',
        text: 'The public site, the offer letter and the emails now all say **Kept** — the three old name variants are gone in one move.',
      },
      {
        emoji: '🌐',
        text: 'The site still lives at **bellwoodslane.co.uk** for now — the 301 to **wearekept.co.uk** stays off until the new domain and mailboxes are wired up.',
      },
      {
        emoji: '⏪',
        text: 'Instant rollback if ever needed: one env setting (`NEXT_PUBLIC_BRAND_PHASE=legacy`) brings Bellwoods back — no code change.',
      },
    ],
  },
  {
    id: '2026-07-29-kept-brand-ready',
    date: '2026-07-29',
    emoji: '🟢',
    title: 'Meet Kept. — the new brand, built and waiting',
    intro: 'A price given is a price kept. The whole front door now wears it.',
    bullets: [
      {
        emoji: '🟢',
        text: '**Leaf green** for every action, **wax red** kept only for the promise — the two-accent rule, enforced in the code.',
      },
      {
        emoji: '📄',
        text: 'The site, the offer letter and the emails are all re-skinned — **not one word of copy changed** (a build check proves it).',
      },
      {
        emoji: '🔒',
        text: "Public name stays **Bellwoods Lane** until the trademark clears. When you say go, it's **one setting** to flip.",
      },
      {
        emoji: '🎨',
        text: 'It all maps to the **Kept.** design project (claude.ai/design), so design and code stay one system.',
      },
    ],
  },
  {
    id: '2026-07-29-scout-picks-the-best',
    date: '2026-07-29',
    emoji: '🔦',
    title: 'The scout now picks the best — and tells you when it is blind',
    intro:
      'It was finding 180 properties a day and keeping the first 30. Not the best 30. The first 30.',
    bullets: [
      {
        emoji: '🏆',
        text: 'Every property found is now ranked before we spend a penny on it. You get the best 30, not a random 30.',
      },
      {
        emoji: '🆕',
        text: 'Your daily card now says how many leads are actually NEW. "30 found — 0 NEW" instead of pretending all 30 need review.',
      },
      {
        emoji: '⚖️',
        text: 'Leads are no longer judged on data we have not bought yet. A missing price history used to quietly sink a good lead.',
      },
      {
        emoji: '🚨',
        text: 'New alert when a lead source goes dark — how many are still live, and exactly which key to set.',
      },
      {
        emoji: '🕳️',
        text: 'Heads up: 3 of your 4 distress sources are off right now. Open the alert, it lists the fix.',
      },
    ],
    cta: { label: 'Check your Action Centre', href: '/actions' },
  },
  {
    id: '2026-07-23-voice-notes-and-learning',
    date: '2026-07-23',
    emoji: '🎙️',
    title: 'Your scout now learns from your voice',
    intro: 'Big one. The platform just got ears — and a memory.',
    bullets: [
      {
        emoji: '🎙️',
        text: 'Tap the mic when rating a lead. Say what you like or dislike — it types itself.',
      },
      {
        emoji: '🧠',
        text: 'Every note is mined into your Taste Profile — what you love, what you hate, in your own words.',
      },
      {
        emoji: '🚫',
        text: 'Say "never buy next to a railway" once — the scout screens every future lead against it. Automatically.',
      },
      {
        emoji: '🎯',
        text: 'The calibration page now suggests scorer tweaks with one-click Apply. The more you talk, the sharper it gets.',
      },
    ],
    cta: { label: 'See your Taste Profile', href: '/leads/calibration' },
  },
];

export function latestWhatsNew(): WhatsNewEntry | null {
  return WHATS_NEW[0] ?? null;
}
