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

**FLIPPED 2026-07-30** — the founder gave the go and the default phase in
`@repo/brand` is now `'kept'`. `NEXT_PUBLIC_BRAND_PHASE` remains as an
emergency rollback lever (`legacy`/`dual`). The old-domain 301 in
`apps/web/next.config.ts` keys off the **env var** directly, so it stays
inert until wearekept.co.uk DNS is attached and the var is set explicitly.
In-flight deals complete under the name on their signed offer.

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

## Legal entity — RESOLVED 2026-07-31

The open question ("do legal footers need the registered name restored?") is
answered from the Companies House register, checked 2026-07-31:

- Registered entity: **BELLWOODS LANE VENTURES LTD**, Company No. **16454416**,
  incorporated 15 May 2025, registered office 20 Wenlock Road, London N1 7GU.
- No "Kept" entity exists on the register; "Kept" is a **trading name**.
- The legacy legal string "Bellwood Lane Ventures Ltd" (no "s") never matched
  the register — it was a pre-existing typo, preserved only in the `BELLWOODS`
  legacy capture in `@repo/brand`.

Applied: `KEPT.legalName` now carries the registered entity, a `companyNumber`
field was added to `@repo/brand`, and the offer PDF, FCA-disclosure page, and
deal-update email footer print "Bellwoods Lane Ventures Ltd (trading as Kept)"
/ Company No. where the entity is named. `pnpm copy-integrity` intentionally
flags the disclosure-page change — it is a deliberate legal-facts correction,
not a rebrand copy drift. Revisit only if a Kept entity is incorporated after
the class-36 trademark search.

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
