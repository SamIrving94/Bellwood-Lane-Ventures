# Kept. — brand & design system

_Last verified against the live site: 2026-08-22._

**Status:** exploration approved by both founders, July 2026. Domain secured:
**wearekept.co.uk**. Legal/trading structure TBC (trademark class 36 search
still to be run before public use).

The name is the promise: **a price given is a price kept.** Every design
decision serves calm certainty in someone's worst week — never tech, never
hype, never "We Buy Any House" energy.

---

## The mark

- Wordmark: lowercase **kept** in a heavy grotesk, tight letter-spacing
  (−0.03em), followed by a full stop.
- **The full stop IS the logo.** It is always the accent colour (wax red),
  and it "lands": in animated contexts the dot drops in and settles
  (given → kept). In print it becomes a wax seal.
- Monogram: **k.** (used as seal, favicon, ghosted watermark).
- Never: uppercase KEPT, outlined versions, gradients on the mark.

## Colour tokens

| Token | Hex | Role |
|---|---|---|
| `cream` | `#F7F3EA` | Page ground |
| `card` | `#FFFFFF` | Cards / documents |
| `forest` | `#1F332B` | Ink — headlines, dark bands, footer |
| `body` | `#4C5A50` | Body text |
| `leaf` | `#2E7D5B` | Interactive ONLY — buttons, links, focus |
| `leaf-dark` | `#256A4C` | Hover state |
| `wax` | `#C33F35` | The dot, seals, promise moments ONLY |
| `hair` | `#E2DCCB` | Hairlines / borders |
| `soft` | `#EDE7D8` | Tinted section grounds |

**The two-accent rule:** wax red is *reserved* — it only ever marks the
promise (the dot, the seal, "the honest version" labels). Leaf green is
*only* ever action. Breaking this rule is how the brand dies.

## Type — DECIDED: inherit the Bellwoods editorial set

All faces are **self-hosted** in `packages/design-system/lib/fonts/` and
loaded via `next/font/local` from `packages/design-system/lib/fonts.ts`.
They were `next/font/google` until Aug 2026, when a Vercel build failed on
`Failed to fetch font file from fonts.gstatic.com` and took the marketing
site's deployment down. Builds no longer touch the network for type. All
five families are SIL OFL, so there is no licensing cost either way. The
woff2 files are the `latin` subset only.

The set, unchanged by the hosting move:

- **Headlines & promise lines:** **Libre Caslon Text** — Caslon is the
  English document face (legal, publishing, letterpress): exactly Kept's
  world. Weight 500–700, tight leading (1.06–1.1), `text-wrap: balance`.
  (System fallback in mocks: Iowan Old Style / Palatino / Georgia.)
- **Body & UI:** **Roboto** (working sans; candidate for a later swap —
  zero-cost decision, revisit after launch).
- **Documents:** **Courier Prime** for offer-letter labels (PROPERTY,
  OUR CASH OFFER) — the typed-document texture.
- **The wordmark — one test outstanding:** never Roboto Bold (invisible).
  Trial A: `kept.` in **Libre Caslon Bold lowercase** (serif mark, ties
  the logo to the document world). Trial B: a characterful free grotesk
  (e.g. Hanken Grotesk) at 700, −0.03em. Decide in Claude Design; the
  drawn dot/circle is constant either way.
- Eyebrows: 10.5–11px, letterspacing .24–.28em, uppercase, leaf (or wax
  for "honest version" sections).

## Signature artefacts (these ARE the brand)

1. **The `kept.` watermark** — the wordmark oversized and near-translucent
   (~5% forest), bled off the page edge behind the headline. Never behind
   running body text; large display type can carry a tint, prose cannot.
2. **The promise card** — bone card, brass/wax seal, numbered promises.
3. **The WhatsApp thread** — the agent channel's native artefact.
4. **The poster** — giant lowercase `kept.` on forest, one line, one link.

**Retired, Aug 2026 — do not reintroduce or brief from these:**

- ~~The signed offer letter~~ — removed from the `/sell` hero at founder
  review. The watermark replaced it.
- ~~The offer-breakdown widget~~ — the market-estimate → margin → your-figure
  maths panel. Component deleted (`components/offer-breakdown.tsx`). The
  below-market trade is still stated in the `/sell` FAQ and the "when we're
  probably not the right answer" section, but it is **no longer shown as a
  worked example, and not on every page**.

## Motion

- The dot lands (drop + settle, ~0.8s, `cubic-bezier(.3,1.5,.4,1)`) once
  per page load, in the nav mark.
- Sections rise in on scroll (18px, 0.7s).
- Artefacts lift on hover.
- Everything gated behind `prefers-reduced-motion`.

## Voice (register: calm certainty)

### The bar: the Beth Sims editorial pass (Aug 2026)

The signed-off homepage copy (from "Kept BS comments.docx", implemented
verbatim on the live site) is the standard every new piece of copy must
meet. Founder direction, 22 Aug 2026: "this is what good looks like;
whenever we are building anything we want it to meet this bar." The
principles her edits demonstrate:

- **People first, always.** "We know there's more to a home than bricks and
  mortar. Every property comes with lives lived, memories made and reasons
  for moving on." Copy leads with the person's situation, never the
  transaction. "We don't just care about homes, we care about people."
- **Cut what adds nothing.** Her most common note. Every sentence earns its
  place; sections that repeat get merged or moved to the Q&A.
- **Neutral precision over drama.** "quick or agonising" became "long and
  painful"; "months of not knowing" became "uncertainty". No theatrical
  language, even in service of empathy.
- **Verify before asserting.** Any claim of fact gets checked; if it is an
  assumption, rewrite it as an honest one ("For sellers, few things are more
  frustrating than a cash offer that drops at the last minute").
- **Commit or don't.** Where we CAN commit, say it firmly: "Provided within
  two working days or fewer" beats "we aim for 24–48 hours". Where we can't,
  don't dress a hope as a promise.
- **The rhetorical turn, used sparingly.** "The only exceptions?" "None of
  those apply? The price does not change." One per section at most.
- **Warm sign-offs on the brand line.** "That's our promise: a promise made
  is a promise Kept."
- **Say who we're wrong for, unprompted.** "We'd rather you sold well than
  sold to us."

- Short declaratives. "The price holds." "Our word. Kept."
- We name the trade-off out loud (below-market by design, and why).
- We say who we're wrong for, unprompted.
- Never: urgency timers, "instant cash", exclamation marks, jargon.

## Copy truth rules (binding)

The live site copy is the source of truth for every claim. The promise is:
**same-day response → we view every property → confirmed written offer sent
within two working days of viewing, binding upon Kept for a week →
completion in weeks not months, as little as two weeks.** Three documented
renegotiation exceptions, always stated. Never advertise internal ops
targets. See CLAUDE.md "Public promises".

Also binding, from the Aug 2026 founder review:

- **No indicative offers**, and no generated figure shown on screen anywhere.
- **No em dashes** in any copy, on the site or in documents. Comma, colon, or
  split the sentence. En dashes in number ranges (24–48) are fine.
- **Never "advice"** — we are not FCA authorised. Use "an honest steer".
- **Never "legally binding"** — "binding upon Kept for a week".
- **No numbers in probate copy.** No IHT interest, no carrying costs. Closure,
  not a deadline.
- Sellers pay their own legal costs; we pay ours. Never imply the offer figure
  lands whole.

## Digital home

- Primary domain: **wearekept.co.uk**
- Email pattern: `hello@wearekept.co.uk`
- Design exploration mocks: session artefacts July 2026 (offer-letter
  board, four style tiles, blended homepage, /sell re-skin) — synced to
  the "Kept" Claude Design project for iteration.
