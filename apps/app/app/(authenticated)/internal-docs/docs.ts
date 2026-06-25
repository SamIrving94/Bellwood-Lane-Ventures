/**
 * Internal-docs registry.
 *
 * A lightweight home for internal working documents (strategy, plans, research)
 * that should live in the app — version-controlled here, rendered as markdown
 * on /internal-docs. Add a new doc by appending an entry; no DB needed.
 */

export type InternalDoc = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  /** ISO date — when the doc was last meaningfully revised. */
  updated: string;
  /** Markdown body, rendered with GFM (tables, etc.). */
  body: string;
};

const MARKETING_AUTOMATION_PLAN = `
# Marketing & Outreach Automation — Plan

> Researched from four threads (internal audit + seller acquisition + agent/solicitor referrals + content/social automation). The build extends what already exists rather than rebuilding it.

## The big realisation

We've already built the hard half. The **Marketer agent already drafts** Instagram posts, LinkedIn, blogs, case studies, solicitor outreach and ad copy — **with a built-in UK-compliance auditor**. The **held-for-review email rail is solid**.

**The gap is distribution.** Hitting "Approve" today just marks a draft done — **nothing actually publishes**. The Calendar and Performance screens are empty because \`publishedAt\` is never written.

So the job is: **connect the engine we have to the world, point it at two audiences, and measure it.**

## Managed agents — 4 roles, one rule

Automate the **steps**, hand the founder the **thoughts** (approve / record / decide). The research is blunt: fully-faceless, fully-autonomous posting now *underperforms* and gets penalised ("AI slop" backlash). The winning pattern everywhere is **automate 80–90%, gate publishing with a human** — which we already do.

| Agent role | Automates (steps) | Founder owns (thoughts) |
|:--|:--|:--|
| **Content** | atomise every deal → posts/clips/blog/newsletter, schedule, publish, measure | approve + occasional face/voice |
| **Acquisition** | seller ads, landing pages, SEO town-pages, instant lead reply | budget + final offer (held) |
| **Partner** | find + sequence agents/solicitors, nurture | relationship + sign-off |
| **Compliance** | audit every public asset (already built) | — |

## Audiences (priority order)

1. **Motivated sellers** — direct-to-vendor demand. Buy on *trust*: proof of funds, NAPB/TPO marks, founder face + track record, reviews, "cash offer in 24h / complete in 7–21 days / we cover all fees". Probate/inherited search terms are cheaper + warmer than generic "sell my house fast".
2. **Estate agents & solicitors** — referral partners. Highest value: **probate solicitors + LPA receivers** (receivers want *market value + certainty*, not a discount). Email + LinkedIn multichannel lifts replies 30–50%.

## The build — phased by leverage

### Phase 0 — Foundations
- **Brand-voice spec** as a knowledge-base doc → feeds the Marketer agent (the blog agent doesn't even call the knowledge base yet — quick win).
- **Trust stack** on public funnels: NAPB + TPO marks, proof-of-funds, founder face + track record, Google reviews.
- **UTM + attribution** into the existing PostHog/GA so KPIs light up.

### Phase 1 — Close the publish loop ⭐ (the #1 gap)
- One publishing integration — **Ayrshare** (single API → LinkedIn, Instagram, Facebook) behind the Approve button. Writes \`publishedAt\` → Calendar + Performance come alive.
- **Newsletter via Resend Broadcasts** — we already use Resend, so nearly free.
- Founder-approval gate stays. **Budget 2–4 weeks Meta app review** for IG/Facebook.

### Phase 2 — Seller acquisition funnel
- **Pain-point landing pages** (probate / distress / relocation): single-offer, mobile-first. (\`/sell/*\` sub-pages are referenced in code but missing.)
- **Programmatic "sell house fast in [town]" pages** with *real* local data (thin duplicates get penalised).
- **Instant speed-to-lead reply** (5 min = 21× more likely to convert): auto-acknowledge instantly, but the **actual offer stays held**.
- **Modest Google test** on probate/inherited terms + call tracking.

### Phase 3 — Partner referral engine
- Prospect-build local agents + probate solicitors + LPA receivers.
- **Multichannel sequences** (email + LinkedIn) — extend the held-outreach rail to multi-step (the drip gap). B2B corporate can auto-send.
- **Deliverability + compliance**: separate sending domain + SPF/DKIM/DMARC + warm-up; segment out sole-trader agents (not PECR-exempt); disclose referral fees (NTS/SRA).
- **Partner portal + "completed in X days" newsletter** for nurture.

### Phase 4 — Founder brand (low-effort)
- Batch-record raw takes → AI atomises into LinkedIn posts + short clips → approve → publish (via Phase 1). LinkedIn first (serves agents *and* credibility).

## Non-negotiable rails
- **Vendor comms always held**; B2B corporate auto-sends.
- **Compliance auditor fronts every public asset** (built for blogs — reuse everywhere).
- **ASA:** only claim "we buy directly / cash / complete in X days" if literally true ("We Buy Any House" was ruled misleading for exactly this).
- **TPS/CTPS** screen any calls; mind the new £17.5m PECR ceiling.

## Where we started
**Phase 1 — the publish loop.** Cheapest, unlocks everything already built, makes the dead Calendar/Performance screens come alive.
`;

export const INTERNAL_DOCS: InternalDoc[] = [
  {
    slug: 'marketing-automation-plan',
    title: 'Marketing & Outreach Automation — Plan',
    summary:
      'How we automate marketing, outreach, brand & social with managed agents — built on the Marketer agent + held-email rail we already have. Phased build, started with the publish loop.',
    category: 'Strategy',
    updated: '2026-06-24',
    body: MARKETING_AUTOMATION_PLAN,
  },
];

export function getDoc(slug: string): InternalDoc | undefined {
  return INTERNAL_DOCS.find((d) => d.slug === slug);
}
