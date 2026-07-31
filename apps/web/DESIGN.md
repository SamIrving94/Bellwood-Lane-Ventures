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
| Body / UI | **Roboto** | The brand kit's working sans (matches the logo lockup). |
| Documents / numerals | **Courier Prime** | A real typed letter. Used for the offer document, refs, figures. |

How it is wired (do not undo this):

- All three are loaded once in `packages/design-system/lib/fonts.ts`.
- The public root (`apps/web/app/layout.tsx`) repoints `--font-fraunces` to
  Libre Caslon and `--font-inter` to Roboto, so every existing `font-serif` and
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

## The tells we never ship

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
11. **Gradient anything as decoration.** No purple/violet/indigo washes, no
    glowing orbs or gradient meshes as background filler, no gradient buttons,
    no gradient text. Buttons are solid brand colour.
12. **The icon-in-circle 3-column feature grid** (icon in a coloured circle +
    bold title + two-line description, repeated identically). The single most
    recognisable AI tell. Present features as narrative, asymmetric, or
    document-styled sections instead.
13. **Centered everything.** Headings, body, and cards all `text-align: center`
    is the template default. Our baseline is left-aligned editorial; centre only
    as a deliberate exception (e.g. the seal, a letterhead).
14. **The Notion-callout card**: `border-left` accent stripe on a flat box. Use
    a hairline full border or a rule instead.
15. **Repeated template phrases.** The same sentence stamped across pages reads
    as generated copy. Any standard phrase ("a price that reflects the speed
    and certainty of the transaction") may appear **once** site-wide; everywhere
    else, say the same true thing in different, page-specific words.
16. **Monotonous section rhythm.** Every section the same height and padding
    (hero → 3 features → testimonials → CTA). Vary density with intent: tight
    for dense content, generous for the hero and letter moments.
17. **Flat grey borders and pure-black shadows** on warm surfaces. Borders are
    alpha-blended from the warm ink (`border-[#241C1A]/12` style), shadows are
    tone-matched and layered, never `shadow-black`.
18. **Nested radius that ignores padding.** Inner radius = outer radius minus
    the gap between them; identical inner/outer radii read as a "lump".

## What reads as handcrafted (the positive rubric)

| Dimension | Signal |
|---|---|
| Typography | Distinctive faces with a clear display-vs-body hierarchy; 3–4 sizes per page max. Never default Inter/Roboto vibes. |
| Colour | One accent + warm neutrals; at most two non-neutral hues per viewport. |
| Layout | Grid-disciplined baseline with 1–2 deliberate surprise moments per page (asymmetric hero, one grid-breaking element, varied column counts between sections). |
| Spacing | Varies per section with intent — tight for dense content, generous for the letter/hero moments. Never uniform padding everywhere. |
| Borders/shadows | Alpha-blended warm-ink borders; tone-matched layered shadows; nested radius respects the padding math. |
| Copy | So specific it could only belong to this one firm. If a sentence would fit any cash buyer's site, rewrite it. |
| Motion | Physical and continuous; functional, not decorative. Nothing teleports. |
| Detail | Empty states, loaders, and error states get the same craft as the hero. |

## Open question: Roboto

The body font is Roboto because the brand kit specifies it. But Roboto is the
Android system default — it is on the banned-defaults list in the rubric above,
and it flattens every page it touches. Display (Libre Caslon) and documents
(Courier Prime) carry the personality; the body does not. **Decision needed
with Ant:** keep Roboto for kit fidelity, or move body/UI to a characterful
grotesk (e.g. Fontshare Satoshi or General Sans) while the logo lockup keeps
Roboto. Until decided, do not swap fonts in code.

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
- [ ] No gradient standing in for an image, and no gradient as decoration.
- [ ] No icon-in-circle feature grids; no centered-everything sections.
- [ ] No `border-left` accent callout cards.
- [ ] No template sentence that already appears on another page.
- [ ] Borders alpha-blended from warm ink; shadows tone-matched, never black.
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

### Cleared (31 July 2026 sweep)

The whole governed backlog was executed in one pass. Zero remaining, verified
by grep audit + `turbo build --filter=web`:

- `tracking-widest` eyebrows: 39 → 0 (all `<Eyebrow>` / `<Wordmark>` /
  `<LogoLockup>` now)
- `rounded-2xl`/`rounded-3xl`: 36 → 0
- Cool-tone colour classes (emerald/blue/amber/rose/red): 10+ → 0 (warm scale)
- Emoji as icons (full Unicode-range sweep, incl. 🔒/🎁 in chat-flow): → 0
- Local `next/font` re-imports: 5 → 0 (root inheritance everywhere)
- Gradients: → 0 (team fake-photo gradient replaced by porcelain panel +
  Courier "photograph to follow" caption)
- Em dashes in UI strings: → 0 (74 remain in long editorial prose + code
  comments, which the standard allows)
- "a price that reflects the speed and certainty of the transaction": 8 → 0
  (each instance reworded page-specifically, honest-claims constraints kept)
- Off-palette one-offs (`#b08f52` gold, `neutral-*`): → 0

### Still open

- **Chat bubbles in `chat-flow.tsx`**: emoji scale, eyebrows, radii and error
  states are fixed, but the full "replace chat with a calm document/ledger
  styled form" redesign (and the fake thinking delay) remains to do.
- **Photography**: still zero real photos site-wide (the biggest gap; see
  Photography section). Team page needs a real headshot + bio.
- **Roboto decision** (see Open question above).

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
