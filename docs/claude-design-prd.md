# Claude Design PRD — Bellwood Instant Offer Visual Polish

**Purpose of this document:** Paste this into Claude Design (or any visual iteration tool) to polish specific component visuals. Claude Design returns polished JSX/TSX. Sam pastes the improved component back into the repo; Claude Code integrates.

---

## Brand primitives

**Palette**
- Primary navy: `#0A2540`
- Navy hover: `#13365c`
- Text: `#0A1020`
- Muted text: `text-slate-600`
- Gold accent: `#C6A664` (hover `#b08f52`)
- Warm cream surface: `#FAF6EA`
- Page bg: `#FAFAF7`
- Success: `#1F6B3A`

**Typography**
- Serif headlines: **Fraunces** (next/font/google), weights 400/500/600/700
- Sans body: **Inter**
- Hero: `text-5xl md:text-7xl leading-[1.05]`
- Section h2: `text-4xl md:text-5xl`
- Card h3: `text-2xl` to `text-3xl`

**Spacing**
- Section padding: `py-24` standard, `py-20` compact bands
- Section max width: `max-w-3xl` (content), `max-w-5xl` (grids), `max-w-6xl` (chrome)
- Border radius: `rounded-2xl` cards, `rounded-3xl` hero-type cards, `rounded-full` buttons

**Tone**
- British understatement. No exclamation marks in headlines.
- Confidence through precision, not volume.
- "Legally binding" not "guaranteed." "Cash" not "fast cash."
- Use em-dashes, not ampersands.

---

## Components to polish (in priority order)

### 1. Hero section

**Current file path in repo:** `apps/web/app/instant-offer/page.tsx` — first `<section>` after `<header>`

**Headline:**
> Sell in 18 days. <br/> Cash. <span class="text-[#C6A664]">Guaranteed.</span>

**Subhead:**
> The UK cash buyer built for estate agents. Instant offer. **No re-trade.** AML handled. **Up to 3% + VAT commission protected.**

**Must include:**
- Top micro-pill: a live-dot (pulsing green) with "Live · accepting new properties today"
- Two CTAs: primary gold "Get an instant offer →" scrolls to `#chat`; secondary ghost "See how we price" links to `/instant-offer/methodology`
- Below CTAs: `HMRC-aligned · FCA-compliant disclosure · 72-hour offer lock`
- Below hero text: a 3-card data-visual row (HMLR comps / EPC risk / Offer) — premium financial-document feel

**What I want better:**
- The 3-card visual feels flat. Make it feel like a live dashboard snapshot.
- Consider subtle motion (gold underline that animates on page load under "Guaranteed.")
- Add a soft radial gradient behind the hero to lift it off the page

---

### 2. Chat flow container

**Current file path:** `apps/web/app/instant-offer/components/chat-flow.tsx`

**Structure:**
- Chat bubbles: bot (left, white card) vs user (right, navy card)
- Chip buttons for multi-choice steps
- Slider for condition (1–10)
- Progress dots at top (1 of 10)
- "Thinking" sequence with staggered check-marks
- Result card with big offer number

**What I want better:**
- The result card should feel like a premium investment document, not a web form
- Big cash-offer number (`text-6xl`) should have more gravitas — serif font, tighter leading
- Confidence bar is too thin — make it feel like a metric, not a progress bar
- Add a subtle Bellwood watermark/seal to the result card
- The 72-hour lock badge should feel more substantial (small icon, timestamp, signed feel)

---

### 3. "No re-trade" promise section

**Current file path in repo:** `apps/web/app/instant-offer/page.tsx` — section with id around the No Re-Trade text

**Headline:** *No re-trade. Ever. In writing.*

**Three cards in a row:**
1. Written guarantee
2. One exception — disclosed (survey only)
3. Audited completion rate

**What I want:**
- This is a trust moment — the cards should feel like contract clauses
- Consider a subtle ruled-paper background on the section
- A thin gold legal-style seal or wax-stamp motif in one corner
- Serif numerals (01, 02, 03) floating above card titles

---

### 4. "How agents earn" — 3% + VAT section

**Three cards:**
- 1% Sale fee
- 1% Introducer fee
- 1% Resale instruction

**Current treatment:** Big gold `5xl` percentages; title underneath; short description

**What I want:**
- Make it feel like a "stack" — each card subtly offsets/overlaps the next (z-axis hint)
- The gold percentage should dominate visually — serif, even larger
- Add running total at the bottom ("Total: up to 3% + VAT across two transactions") — treat like a sum on an invoice

---

### 5. Partnership tiers (Partner / Preferred / Elite)

**Current treatment:** Dark navy band, 3 cards, middle one highlighted with gold border

**What I want:**
- Make the Elite tier feel aspirational — badge/crest/seal icon
- Each tier gets its own visual identifier (not just text)
- Consider a subtle "upgrade path" visual element connecting the tiers

---

### 6. Offer result card

**Content:**
- AVM range
- Big cash offer number
- Completion days
- Confidence bar
- 72-hour lock badge
- Reasoning accordion
- Accept / email buttons

**What I want:**
- Feel like a **legal offer document**, not a web UI
- Serif body copy for the offer terms
- A small "Offer reference: BW-2026-04-29-1234" style code at the top
- Ability to print-to-PDF styling

---

## How to use this with Claude Design

1. **Pick one component** from the list above.
2. **Paste into Claude Design** along with the brand primitives.
3. **Ask:** "Polish the JSX for the [component name] with the brand tokens. Use only Tailwind + lucide-react + next/font. No external deps. Return a single .tsx file I can paste straight into the repo."
4. **Iterate 2-3 rounds** in Claude Design until you love it.
5. **Send me the final JSX** — I integrate, run type-check, commit.

---

## What NOT to change in Claude Design

- Don't touch data/logic — no fetching, no state management changes, no route handlers
- Don't add dependencies (no framer-motion, no react-query, no UI libraries beyond shadcn + lucide)
- Don't change the component's API/props contract — it has to fit where it lives in the repo

## Repo context

- Monorepo: Next.js 15.5 App Router, React 19
- Tailwind + shadcn/ui available via `@repo/design-system/components/ui/`
- Fonts wired in `apps/web/app/instant-offer/layout.tsx`
- Public URL: `http://localhost:3001/instant-offer` (local), `bellwoodlane.com/instant-offer` (prod)
