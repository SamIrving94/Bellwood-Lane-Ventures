# Kept. — brand & design system

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

## Type

- **Headlines & promise lines:** old-style serif — Iowan Old Style /
  Palatino stack (web), Caslon acceptable in print. Weight 500–600,
  tight leading (1.06–1.1), `text-wrap: balance`.
- **Body & UI:** humanist grotesk — Avenir Next / system stack. 15–16.5px.
- **Documents:** Courier accents for offer-letter labels (PROPERTY,
  OUR CASH OFFER) — the typed-document texture.
- Eyebrows: 10.5–11px, letterspacing .24–.28em, uppercase, leaf (or wax
  for "honest version" sections).

## Signature artefacts (these ARE the brand)

1. **The offer letter** — cream paper, serif letterhead, Courier labels,
   the figure huge in serif, wax seal, signature. Slight rotation at rest;
   straightens on hover.
2. **The promise card** — bone card, brass/wax seal, three numbered
   promises.
3. **The offer-breakdown widget** — shows the maths: market estimate →
   "speed & certainty — our margin" → your figure. Radical transparency;
   we never hide the discount.
4. **The WhatsApp thread** — the agent channel's native artefact.
5. **The poster** — giant lowercase `kept.` on forest, one line, one link.

## Motion

- The dot lands (drop + settle, ~0.8s, `cubic-bezier(.3,1.5,.4,1)`) once
  per page load, in the nav mark.
- Sections rise in on scroll (18px, 0.7s).
- Artefacts lift on hover.
- Everything gated behind `prefers-reduced-motion`.

## Voice (register: calm certainty)

- Short declaratives. "The price holds." "Our word. Kept."
- We name the trade-off out loud (below-market by design, and why).
- We say who we're wrong for, unprompted.
- Never: urgency timers, "instant cash", exclamation marks, jargon.

## Copy truth rules (binding)

The live site copy is the source of truth for every claim. The promise is:
**same-day indicative response → we view every property → confirmed written
offer within 24–48 hours of viewing, locked 72 hours → completion in weeks
not months.** Three documented renegotiation exceptions, always stated.
Never advertise internal ops targets. See CLAUDE.md "Public promises".

## Digital home

- Primary domain: **wearekept.co.uk**
- Email pattern: `hello@wearekept.co.uk`
- Design exploration mocks: session artefacts July 2026 (offer-letter
  board, four style tiles, blended homepage, /sell re-skin) — synced to
  the "Kept" Claude Design project for iteration.
