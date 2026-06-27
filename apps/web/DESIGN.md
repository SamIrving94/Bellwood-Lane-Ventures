# Bellwoods Lane public site: design standard

This is the standard we hold the public website (`apps/web`) to. It exists
because the site has to do one hard thing: earn the trust of grieving, rushed,
or anxious sellers, and of investors. A site that reads as "AI made this in a
weekend" actively destroys that trust.

First impressions form in about 50 milliseconds, on visual factors alone, before
a word is read ([The Financial Brand](https://thefinancialbrand.com/news/digital-marketing-banking/clickable-to-credible-how-design-drives-financial-loyalty-191899)).
Templated, personality-free design "erodes emotional trust" and signals that a
firm is "small, unsophisticated, or outdated" (same source). For us that is not
a style preference. It is a conversion and credibility problem.

## The one rule

> Put something **real and specific** at the centre of every page. A signed
> document, a named person, a real address, live data. Specificity is the thing
> AI and templates cannot fake, and it is what reads as human.

If a section is just arranged words on a flat colour field, it is not finished.

## Type system

The public site does **not** use Inter or a trendy default serif. "Inter for
everything" is a named, repeated signature of AI generated design
([techbytes](https://techbytes.app/posts/escape-ai-slop-frontend-design-guide/),
[dev.to](https://dev.to/alanwest/how-to-fix-the-ai-generated-look-in-your-frontend-1ahh)).

| Role | Face | Why |
|---|---|---|
| Display / headings | **Libre Caslon Text** | English, legal, established. Reads as an old firm, not a startup. |
| Body / UI | **Hanken Grotesk** | Warm grotesk with character. Deliberately not Inter. |
| Documents / numerals | **Courier Prime** | A real typed letter. Used for the offer document, refs, figures. |

How it is wired (do not undo this):

- All three are loaded once in `packages/design-system/lib/fonts.ts`.
- The public root (`apps/web/app/layout.tsx`) repoints `--font-fraunces` to
  Libre Caslon and `--font-inter` to Hanken, so every existing `font-serif` and
  `font-sans` class switches without touching the authenticated dashboard.
- The typewriter is used directly: `[font-family:var(--font-courier)]`.
- **Never** re-import `next/font` inside a page or sub-layout. It double loads
  fonts and fights the root. Inherit the root.

## Palette

Warm, custom, never the stock Tailwind defaults. AI sites converge on
indigo/blue/emerald defaults ([Medium](https://medium.com/@chiragthummar16/your-ai-built-websites-look-identical-to-everyone-elses-these-10-skills-fix-that-046ddf58e4d5)).

- Brick: `#7E3F3F` / `#874646` (primary)
- Terracotta: `#DB5C5C` / `#C0492F` (accent)
- Porcelain: `#FBF7F3` / `#FCFAF8` (ground)
- Warm ink: `#241C1A` / `#2B2220` (text)
- Sand / taupe rules: `#EAE0D9` / `#EBE1DB`

Status colours come from the brick/terracotta/sand family (for example
`bg-[#F6ECE7] text-[#874646]`). **Never** `emerald`, `blue`, `amber`, or `rose`
pills. The one allowed off-warm colour is the earth green `#1F6B3A` for a live
state on `/track`.

## The ten tells we never ship

Each is a verified marker of AI or template generation. If a PR adds one, it
does not merge.

1. **Inter (or a default system font) for everything.** Use the type system above.
2. **Em dashes in UI copy** (labels, chips, greetings, empty states). Use
   periods, commas, or an en dash. Long editorial prose may keep them.
3. **Uniform radius and padding on everything** ("the same 16px radius and 24px
   padding on every element" is a named tell,
   [925studios](https://www.925studios.co/blog/ai-slop-web-design-guide)). Vary
   it with intent. Paper is near square (`rounded-[2px]`), buttons are their own
   radius. No `rounded-2xl`/`rounded-3xl` cards.
4. **Four card / even grids** as the default layout
   ([Medium](https://medium.com/@chiragthummar16/your-ai-built-websites-look-identical-to-everyone-elses-these-10-skills-fix-that-046ddf58e4d5)).
   Prefer asymmetry and editorial rhythm.
5. **Emerald/blue/amber status pills.** Use the warm status scale.
6. **Emoji as icons.** Use inline SVG or a Courier text mark.
7. **Gradient placeholders instead of photography.** "Specificity signals
   authenticity, and authenticity is what AI cannot generate"
   ([925studios](https://www.925studios.co/blog/ai-slop-web-design-guide)).
   Use a real photo, a real document, or a brand artifact. Never a gradient
   where an image belongs.
8. **The system-font hero**: big text, subtext, button, on a flat field
   ([aiagentskills](https://www.aiagentskills.ai/blog/ai-websites-all-look-the-same)).
   Lead with a real artifact instead.
9. **The faint giant monogram watermark.** Retired.
10. **Uppercase `tracking-widest` mono eyebrows.** Use the brand `<Eyebrow>`
    (Caslon italic kicker plus a short terracotta rule).

## The human moves we always make

- A real artifact in the hero (document, photo, named person, live figures).
- Intentional asymmetry. Hairline rules instead of boxes where possible.
- Real, specific copy with a human voice (the existing `/agents` and `/sell`
  prose is the bar).
- Subtle grain or texture over flat fills where it adds warmth.
- The brand components: `Eyebrow`, `SectionNumber`, `StatusNote`, `Button`,
  `Seal`, `LogoLockup`. Propagate them, do not reinvent them.

## Definition of done (PR checklist)

- [ ] No `next/font` import inside the page or sub-layout.
- [ ] No `emerald`/`blue`/`amber`/`rose` colour classes.
- [ ] No emoji in JSX.
- [ ] No em dashes in labels, buttons, chips, or empty states.
- [ ] No `rounded-2xl`/`rounded-3xl`; radius is intentional, not uniform.
- [ ] Eyebrows use `<Eyebrow>`, not `uppercase tracking-widest`.
- [ ] No gradient standing in for an image.
- [ ] The page leads with something real and specific.

## Page status

Reviewed every public route against the standard.

### Reference standard (keep, this is the bar)

- `/sell` (now leads with the signed `OfferLetter` hero)
- `/agents` (the `SampleOfferDocument` letter, honest FAQ)
- `/track/[token]` (the transparency timeline)
- `/instant-offer/offer/[id]` (print styled offer certificate)
- `/legal/fca-disclosure`
- `components/brand/*` and `live-pill.tsx` (the counter system itself)

### Needs fixing (adopt the brand system)

`agent-quick-form`, `agents/score` (+ form), `instant-offer/methodology`,
`instant-offer/partner-brief`, `instant-offer/seller-disclosure`,
`save-the-sale`, `why-we-wont-buy-any-home`, `partners/login` (+ form),
`partners/signup` (+ form), `portal/layout`, `ledger-ticker`.

### Replace (worst offenders)

- **`instant-offer/components/chat-flow.tsx`**: the emoji condition scale
  (`chat-flow.tsx:88-97`, `💀` through `🏆`), chat bubbles, and fake "thinking"
  delay. Replace with a calm document/ledger styled form. This sits inside
  `/sell` and `/agents`, so it drags the flagships down.
- **`portal/page.tsx`**: emerald/blue status pills (`:16-17`), a four card grid
  (`:82`), em dash greeting (`:51`).

## Shared offenders (fix once, applies everywhere)

1. **Local `next/font` re-imports** (still present): `instant-offer/layout.tsx:2`,
   `partners/layout.tsx:2`, `portal/layout.tsx:3`, `save-the-sale/page.tsx:3`,
   `why-we-wont-buy-any-home/page.tsx:3`. Delete them; inherit the root.
   (`sell/layout.tsx` and `agents/layout.tsx` are already done.)
2. **Old `uppercase tracking-widest` eyebrow** on ~14 files: `methodology:21,35`,
   `team:19,33`, `partner-brief:37,41,68,174`,
   `seller-disclosure:36,40,66,85,94,103,112,135,144,209,231`,
   `chat-flow:649,680,820`, `login/page:31`, `login-form:58`,
   `signup/page:14,18`, `signup-form:61,127`, `portal/layout:47`,
   `portal/page:47,57,72,93,115,174`, `ledger-ticker:32`,
   `investors/[token]:116,124`. Replace with `<Eyebrow>`.
3. **Emoji icons**: `chat-flow:88-97,592,718,806,834`,
   `agent-quick-form:420,427,430,467,445`,
   `bellwood-score-form:420,427,467`, `login-form:33`, `signup-form:51`.
4. **Status pills**: `portal/page:16,17`, `investors/[token]:108`.
5. **Gradient fake photo**: `team/page.tsx:58` (plus placeholder bio at `:50`).
   Needs a real headshot.
6. **Four card grids**: `portal/page:82`, `bellwood-score-form:172`,
   `agent-quick-form:316,413`.
7. **Soft/oversized radius and doubled borders**: `agent-quick-form:144,283,301,405`,
   `score/page:52,56,158`, `why-we-wont-buy:176`.
8. **Em dashes in UI strings**: `portal/page:9,51`, `investors/[token]:18`,
   `bellwood-score-form:188,194`, `agent-quick-form:61`.
9. **Off palette one offs**: `signup-form:100` (`hover:bg-[#b08f52]`),
   `investors/[token]:116,124` (`neutral-` not brand `stone-`).

## Photography

The site is currently 100 percent CSS drawn. There is no real photography
anywhere. This is the single biggest gap. Commission: property exteriors and
doorways, the founder, and a real signed document. Until then, lean on the
document and seal artifacts, never on gradients.

## Status / changelog

- Type system swapped to Libre Caslon + Hanken Grotesk + Courier Prime; wired at
  the public root.
- `/sell` hero rebuilt around the signed `OfferLetter` artifact. The faint
  monogram and the type on a flat field hero are gone.
- `sell/layout.tsx` and `agents/layout.tsx` local font imports removed.
- Everything under "needs fixing", "replace", and "shared offenders" is the
  governed backlog. Work through it page by page against this checklist.
