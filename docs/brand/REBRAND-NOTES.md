# Kept. rebrand — implementation notes

Companion to `KEPT.md` (the brand spec). This file records how the rebrand was
applied in code, the decisions taken, and what is deliberately left for later.
Branch: `claude/kept-rebrand`.

## Guiding rule

A rebrand change may touch only **styles, tokens, brand components, and the
company name**. Human **copy stays word-for-word**. This is machine-enforced for
the public site by `pnpm copy-integrity` (`scripts/copy-integrity.mjs`).

## Scoping — what changes vs what waits

- **Public site (`apps/web`) re-skins now.** All Kept colour tokens are applied
  in `apps/web/app/[locale]/styles.css` (a web-only stylesheet) via a
  public-root override, mirroring how the site already overrides fonts. The
  shared `packages/design-system` tokens are **not** changed.
- **Authenticated dashboard (`apps/app`) stays on Bellwoods** until its own
  phase (KEPT.md: "last or never"). It reads the unchanged design-system tokens.
- **Everything is invisible in production** until the gated flip below.

## The name flip is gated

`@repo/brand` (`packages/brand`) is the single source of truth for name /
domain / email. `BRAND_PHASE` controls it: `legacy` (default) → `dual`
("Kept, formerly Bellwoods Lane") → `kept`. With `legacy`, every resolved value
is byte-for-byte the current Bellwoods string, so wiring copy to `brand.*`
changes nothing visible and the eventual flip is one value.

**Do not advance `BRAND_PHASE` in production** (env `NEXT_PUBLIC_BRAND_PHASE`)
until the **class-36 trademark search clears and the founders give the go**
(KEPT.md). In-flight deals complete under the name on their signed offer.

## Name / domain inconsistencies found (reconcile at the flip)

The codebase carries **three** name forms and **two** domains for the outgoing
brand. `@repo/brand` captures each exactly so `legacy` output is unchanged:

| Where | Current string |
|---|---|
| Public site copy | **Bellwoods Lane** (with the "s") |
| Legal entity + offer PDF | **Bellwood Lane Ventures Ltd** (no "s") |
| Signed-offer email signature | **Bellwood Ventures** (third variant) |
| Public domain | bellwoodslane.co.uk |
| Offer-PDF deals address | deals@bellwoodlane.co.uk (no "s") |

Plus the **"Bellwood Score"** feature name (public `apps/web/app/agents/score`).
All of these collapse to the single clean Kept. identity at the flip; none were
changed now (they are copy).

## Two-accent rule — how the colour sweep mapped brand reds

KEPT.md: **leaf = interactive ONLY**, **wax = the promise ONLY** (reserved).
The sweep (`apps/web`, ~32 files) mapped:

- Neutrals (deterministic): grounds→`cream`, tinted grounds→`soft`,
  borders→`hair`, ink→`forest`, muted text→`body`.
- `#874646` brick → `forest` when ink/heading, `leaf` when interactive.
- `#db5c5c` terracotta → `leaf` when interactive, `wax` only at promise/seal/
  "honest version" moments, else default `leaf`.
- True-red error/destructive colours (`#b3261e`, `#e5484d`) left untouched —
  wax is never used for errors.

## Artefacts (Phase 3)

- **Offer PDF** (`packages/quote-ops/src/render-pdf.ts`): cream paper, forest
  ink, Times serif letterhead + the figure huge in serif, Courier typed labels,
  wax offer figure + seal border. Legal wording unchanged; name/email routed
  through `@repo/brand` (identical in `legacy`).
- **Emails** (`packages/email/templates/*`): off stock zinc onto Kept hexes,
  CTA → leaf pill. Copy unchanged (incl. the "Bellwood Ventures" signature —
  flagged above).

## Known-pending / not done here

- **Wordmark typeface is still an open decision** (KEPT.md: Trial A Libre Caslon
  Bold lowercase vs Trial B a grotesk, to be decided in Claude Design). The code
  renders lowercase heavy **serif** (Trial A, the available face) + the wax
  landing dot, which is constant either way. Swap `font-serif` on `Wordmark`
  once decided.
- **`k.` monogram / seal**: rendered typographically (no new SVG asset yet).
  Replace `apps/web/public/brand/*.svg` when the drawn mark lands.
- **Dashboard (`apps/app`) rebrand**: deferred.
- **Live domain cutover** (DNS for wearekept.co.uk, 301 from the old domain,
  WhatsApp Business rename + seal avatar): gated — config/notes only, not
  triggered.
- **Verification**: typecheck + copy-integrity green. Visual verification
  against the Kept. Design cards needs the app running with env + DB; do a
  preview-deploy eyeball before merge.
