# Kept public site: design standard

This is the standard we hold the public website (`apps/web`) to. It exists
because the site has to do one hard thing: earn the trust of grieving, rushed,
or anxious sellers, and of investors. A site that reads as "AI made this in a
weekend" actively destroys that trust.

**The brand book is `docs/brand/KEPT.md` — read it first.** Where this file
and KEPT.md disagree, KEPT.md wins (founder decision, 31 July 2026). This
file is the anti-genericness rulebook that sits underneath it.

First impressions form in about 50 milliseconds, on visual factors alone,
before a word is read. Templated, personality-free design erodes emotional
trust and signals that a firm is small, unsophisticated, or outdated. For us
that is not a style preference. It is a conversion and credibility problem.

## The one rule

> Put something **real and specific** at the centre of every page. A signed
> document, a named person, a real address, live data. Specificity is the thing
> AI and templates cannot fake, and it is what reads as human.

If a section is just arranged words on a flat colour field, it is not finished.

## Type system (per KEPT.md)

| Role | Face | Why |
|---|---|---|
| Headlines / promise lines | **Libre Caslon Text** | The English document face. Old firm, not startup. |
| Body / UI | **Roboto** | Working sans; candidate for a later swap, revisit after launch. |
| Documents / numerals | **Courier Prime** | The typed offer letter. Labels like PROPERTY, refs, figures. |

- All three load once in `packages/design-system/lib/fonts.ts`; the public
  root repoints `--font-fraunces`/`--font-inter`. The typewriter is used
  directly: `[font-family:var(--font-courier)]`.
- **Never** re-import `next/font` inside a page or sub-layout.

## Palette (per KEPT.md — tokens in `app/[locale]/styles.css`)

`bg-cream` ground · white cards · `text-forest` ink · `text-body` copy ·
`leaf`/`leaf-dark` **interactive only** · `wax` **promise moments only** ·
`border-hair` hairlines · `bg-soft` tinted grounds.

**The two-accent rule:** wax red only ever marks the promise (the dot, seals,
"the honest version" labels). Leaf green is only ever action. Breaking this
rule is how the brand dies. Pragmatic exception, pending founder ruling:
small **error text** may be `text-wax` (never wax fills or wax borders on
error boxes).

Never stock Tailwind `emerald`/`blue`/`amber`/`rose`/`red` classes, and no
leftover Bellwoods brick/terracotta hexes.

## The tells we never ship

Each is a verified marker of AI or template generation. If a PR adds one, it
does not merge.

1. **Inter (or a default system font) for everything.** Use the type system.
2. **Em dashes in UI copy** (labels, chips, greetings, empty states). Use
   periods, commas, or an en dash. Long editorial prose may keep them.
3. **Uniform radius and padding on everything.** Paper is near square
   (`rounded-[2px]`), cards are `md`/`lg` at most. No `rounded-2xl`/`3xl`.
4. **Four card / even grids** as the default layout. Prefer asymmetry,
   hairline-ruled ledgers, and editorial rhythm.
5. **Cool-tone status pills.** Status comes from the Kept tokens: leaf for
   live/positive, soft/hair for neutral, wax text for errors.
6. **Emoji as icons.** Use inline SVG or a Courier text mark.
7. **Gradient placeholders instead of photography.** Use a real photo, a real
   document, or a brand artefact; until photography exists, a flat `bg-soft`
   panel with a Courier "photograph to follow" caption.
8. **The system-font hero**: big text, subtext, button, on a flat field.
   Lead with a real artefact (the offer letter, the promise card).
9. **Hand-rolled eyebrow spans.** Eyebrows are the brand `<Eyebrow>`
   component only (KEPT.md spec: ~11px, uppercase, wide-tracked, leaf; `wax`
   tone reserved for promise sections). Scattered ad-hoc
   `uppercase tracking-widest` spans are how drift starts. Exception: inside
   printed documents, uppercase Courier labels (PROPERTY, OUR CASH OFFER)
   are the typed-document texture and are correct.
10. **Repeated template phrases.** Any standard sentence ("a price that
    reflects the speed and certainty of the transaction") may appear **once**
    site-wide; everywhere else, say the same true thing in page-specific words.
11. **Gradient anything as decoration** — washes, orbs, gradient buttons or
    text. Buttons are solid leaf.
12. **The icon-in-circle 3-column feature grid.** The single most
    recognisable AI tell. Present features as narrative or document-styled
    sections.
13. **Centered everything.** Baseline is left-aligned editorial; centre only
    as a deliberate exception (a seal, a letterhead).
14. **The Notion-callout card** (`border-left` accent stripe on a flat box).
    Hairline full border or a rule instead.
15. **Monotonous section rhythm.** Vary density with intent: tight for dense
    content, generous for the letter moments.
16. **Flat grey borders and pure-black shadows.** Borders are `border-hair`;
    shadows are tone-matched to forest ink, layered, never `shadow-black`.
17. **Nested radius that ignores padding.** Inner radius = outer minus gap.

## What reads as handcrafted (the positive rubric)

| Dimension | Signal |
|---|---|
| Typography | Distinctive faces, clear display-vs-body hierarchy, 3–4 sizes per page max. |
| Colour | One action accent (leaf) + warm neutrals; wax only at promise moments; at most two non-neutral hues per viewport. |
| Layout | Grid-disciplined with 1–2 deliberate surprise moments per page (the tilted letter, a grid-breaking element). |
| Spacing | Varies per section with intent, never uniform padding everywhere. |
| Borders/shadows | Hairlines (`border-hair`), tone-matched layered shadows, nesting maths respected. |
| Copy | So specific it could only belong to Kept. If a sentence fits any cash buyer's site, rewrite it. |
| Motion | Physical and continuous (the dot lands; sections rise). Functional, not decorative. |
| Detail | Empty states, loaders, and error states get the same craft as the hero. |

## Definition of done (PR checklist)

- [ ] No `next/font` import inside a page or sub-layout.
- [ ] No `emerald`/`blue`/`amber`/`rose`/`red` colour classes; no Bellwoods
      brick hexes.
- [ ] No emoji in JSX.
- [ ] No em dashes in labels, buttons, chips, or empty states.
- [ ] No `rounded-2xl`/`rounded-3xl`; radius intentional, not uniform.
- [ ] Eyebrows use `<Eyebrow>`, never hand-rolled tracked spans.
- [ ] No gradient standing in for an image, none as decoration.
- [ ] No template sentence that already appears on another page.
- [ ] Leaf = action only; wax = promise only (two-accent rule).
- [ ] The page leads with something real and specific.

## Status (31 July 2026 sweep)

The governed backlog was executed against the Kept codebase in one pass
(branch `design/kept-anti-slop-sweep`), verified by grep audit, build, and
in-browser checks:

- Hand-rolled tracked eyebrows → brand `<Eyebrow>`/`<Wordmark>`: 0 remaining
- `rounded-2xl/3xl`: 0 · emoji: 0 · gradients: 0 · local `next/font`: 0
- Cool-tone and leftover-brick colour classes: 0
- "speed and certainty" template phrase: 0 verbatim repeats
- The `/sell` offer widget is a document-styled form (chat bubbles, fake
  thinking delay, and the emoji condition scale are gone), and a silent P0 is
  fixed: a `useSearchParams` Suspense boundary was permanently swallowing the
  form on the static page (users saw an empty gap). Referral codes now read
  from `window.location` at submit.

### Still open

- **Photography** — the site is still 100% CSS-drawn. Commission: property
  exteriors and doorways, the founders, a real signed document. The single
  biggest gap.
- **Wordmark trial** (KEPT.md: Caslon lowercase vs characterful grotesk).
- **Body-font swap candidate** (Roboto is a named default; revisit after
  launch per KEPT.md).
- **Error-colour ruling** — confirm the wax-text-for-errors exception with
  both founders.
