# UX / IA review — public sites, August 2026

**Goal:** check that the information architecture makes sense to a person
navigating it, and that every path serves both the user's goal (am I safe,
what happens next?) and the business goal (a qualified enquiry, held for
founder review). Brand/visual quality was reviewed separately
([DESIGN-REFERENCES.md](brand/DESIGN-REFERENCES.md)); this review is about
**structure, routes, and journeys**.

**Method:** every public route read in code, full internal link-graph
extracted, both journeys walked (distressed seller / agent with a collapsing
sale), sitemap and robots checked.

---

## The map as it stands

```
/  ──307──▶  /instant-offer  ──307──▶  /agents        ← THE FRONT DOOR IS B2B
                                        │
        ┌── /agents/score (noindex, no nav, no lead capture)
        ├── /save-the-sale (panic page, quick form → /api/quote)
        ├── /partners/login → /portal (dead end)
        └── /sell ◀── the seller surface the brand is built around
                 ├── /probate (new)
                 ├── /instant-offer/methodology (one-way spur)
                 ├── /why-we-wont-buy-any-home
                 └── /legal/fca-disclosure ── /legal/privacy ✗ (404)

Orphans (no inbound links): /chain-break, /instant-offer/team
Print docs reachable only via /portal: partner-brief, seller-disclosure
```

---

## P0 — structural (fix before spending on traffic)

### 1. The front door lands sellers on the trade entrance
`/` redirects to `/instant-offer`, which redirects to `/agents`. A seller
who types the bare domain — from a letter, a WhatsApp, a Google Business
card — lands on B2B commission talk ("You don't lose a commission. You earn
two."). For a probate widow, that reads as *"this site is not for me"*, and
for the business it leaks the core direct-to-vendor lead.

- **User goal broken:** the most vulnerable audience gets the wrong room.
- **Business goal broken:** direct-to-vendor is the model; the vendor is
  the one audience the root URL turns away.
- **Fix:** make `/` render the seller surface (move or re-export `/sell`).
  Agents already get a prominent band + nav link on it. Keep
  `/instant-offer` and `/chain-break` as `permanentRedirect`s (they
  currently emit **307 temporary** — SEO equity is being thrown away).

### 2. `/legal/privacy` is linked but does not exist
The FCA-disclosure page links to it — and the site tells every visitor we
are "ICO-registered as a data controller" while having **no privacy
notice**. With forms collecting name/email/phone, this is a UK GDPR
transparency gap, not just a 404.

- **Fix:** write `/legal/privacy` (what we collect, why, retention,
  processor list, ICO complaint route) and link it from every form.

### 3. Dead anchors and placeholder copy in production
- `/instant-offer#chat` is linked 3× (methodology ×2, team) — **no
  `id="chat"` exists anywhere**. And since `/instant-offer` now redirects
  to `/agents`, those CTAs dump a seller reading pricing methodology onto
  the agent pitch.
- `/instant-offer/team` ships literal `[role]` / `[sector]` placeholders, a
  `href="#"` LinkedIn, an empty gradient for a headshot — **and it is in
  the sitemap** while being orphaned. Google indexes the placeholder text.
- `/instant-offer/partner-brief` prints `Phone: +44 (0) [phone]` on the
  leave-behind agents hand to sellers.
- **Fix:** point methodology/team CTAs at `/sell#offer`; finish or unlist
  the team page (it now duplicates the "person" job done better by the
  Anthony block on /sell); fill or remove the phone placeholder.

### 4. Mis-routed situations on the routing page
`/why-we-wont-buy-any-home` is the page whose whole job is sending people
to the right place, and:
- **"Probate" routes to `/sell`** — `/probate` exists now.
- **"Distressed sale" promises "read our distress page first"** — no such
  page exists; it routes to generic `/sell`. For sellers in financial
  distress this is the moment the site must be most precise (it already
  does the right thing pointing at StepChange — the copy just lies about
  what's behind the button).
- Two rows render raw paths ("Use the form on /save-the-sale") as button
  copy.

## P1 — journey friction

### 5. The two-calculator seam (agents)
`/agents/score` returns a range but **captures no contact and creates no
lead**; its result CTA sends the agent to `/save-the-sale` where they
**re-type the same address and postcode**. Two tools, two overlapping
situation taxonomies, no data handoff. Every re-typed field is a place a
tired negotiator abandons.
- **Fix (minimum):** carry address/postcode/situation into the quick form
  via query params. **Fix (better):** the score result grows the four
  contact fields and becomes the lead — one tool, two depths.

### 6. Header roulette
Nine pages, four+ different header treatments, and the logo points at five
different places (`/`, `/agents`, `/instant-offer`, `/portal`, nowhere).
`/why-we-wont-buy-any-home` has **no mobile nav at all** (hidden below
`md`). Users learn a site's shape from its header; this site has six shapes.
- **Fix:** one shared `SiteHeader` component (logo → `/` always), with a
  compact variant for panic/print pages, and a mobile menu.

### 7. The portal is a dead end
A signed-in agent cannot reach `/save-the-sale` or `/agents/score` (their
daily tools) from `/portal`, and the logo links to the portal itself. The
two compliance docs are *only* reachable via the portal, so an agent who
never signs in can't get the seller-disclosure form they're told to use.
Also: `estEarnings` hardcodes 1% against "agreed per deal, in writing"
terms, and the referral link falls back to **localhost** if
`NEXT_PUBLIC_WEB_URL` is unset.
- **Fix:** portal quick-links to the two tools + docs; guard the env
  fallback; label earnings "illustrative at 1%" or compute from terms.

### 8. Sitemap out of sync
Missing: `/save-the-sale` (the conversion page), `/why-we-wont-buy-any-home`
(the SEO-strongest page). Present: the unfinished `/instant-offer/team`.
`/agents/score` is noindexed yet is the first item in the /agents nav —
decide which it is.

## P2 — consistency debt

9. **Three parallel "situations" taxonomies** (score form, quick form,
   why-we-wont page) hand-maintained and already disagreeing. One shared
   list in one module.
10. **Brand leak:** `bellwood-score-form.tsx` renders "Bellwood's confirmed
    offer" one viewport away from "Kept Score". Route it through
    `@repo/brand` like everything else.
11. **Statute-year inconsistency:** partner-brief cites "DMCC Act 2025",
    seller-disclosure cites both 2024 and 2025. The Act is **2024** (its
    consumer provisions commenced 2025). One for Counsel to confirm, then
    make consistent.
12. **Methodology publishes the margin table** (20% chain-break, 25%
    repossession, floor/ceiling rules). On-brand transparency — but it
    prices our negotiations for anyone who reads it. Confirm intentional.
13. **Methodology/team are one-way spurs** — no site nav, no footer, no
    route back to /sell or /agents except the broken CTAs (see #3).

---

## Target IA (proposed)

```
/                       seller surface (today's /sell), agent band intact
├── /probate            guide → /#offer
├── /maths              (anchor on /) + /methodology as its long form
├── /why-we-wont-buy-any-home   routing page, fixed destinations
├── /agents             B2B home
│    ├── /agents/score  score + lead capture merged (one tool, two depths)
│    ├── /save-the-sale panic entry (kept minimal on purpose)
│    └── /portal        + links to tools & docs
├── /legal/fca-disclosure ── /legal/privacy (new)
└── legacy: /instant-offer*, /chain-break → permanentRedirect
```

**Principles applied:** one front door per audience, never two pages for
one job, every artefact reachable without sign-in, every promise-page
linked from where the promise is made, and no page that exists only
because a URL used to.

## Suggested fix order

1. **Quick wins, one PR:** root → seller surface; permanentRedirects;
   fix #chat CTAs; fix probate/distress mis-routes; sitemap sync; unlist
   team page; phone placeholder; brand leak; raw-path button copy.
2. **Privacy notice** (`/legal/privacy`) — small page, real compliance.
3. **Shared SiteHeader** + mobile menu.
4. **Merge the agent calculators** (needs a founder call on whether Score
   stays a separate brand).
5. **Portal links + earnings honesty.**
