# Bellwoods Lane — Research Library

Founder-grade research that informs strategy, product, and Paperclip agent
behaviour. Every Paperclip agent should read these on first run and re-read
when explicitly asked. Sam and Anthony also reference these directly.

## How to use

- **CTO agent** — read all research before opening PRs
- **Scout** — `agent-partner-research-2026-04.md` for who to target
- **Marketer** — `agent-partner-research-2026-04.md` for tone + commission
- **Appraiser** — read the AVM rationale referenced in the briefing pack
- **Counsel** — read the regulatory + AML sections
- **Concierge / Relationship Manager** — read the briefing pack
- **Chief of Staff** — read everything

(Note: as of 2026-05, marketing agents run as internal crons; see
docs/architecture/marketer-internal.md.)

## Index

| File | What | Date |
|:---|:---|:---|
| [`agent-partner-research-2026-04.md`](./agent-partner-research-2026-04.md) | Becoming UK Estate Agents' #1 Cash Buyer Partner — market sizing, pain points, competitor matrix, value-prop ranking, regulatory brief, 14-day GTM | 2026-04 |
| [`agent-briefing-pack-2026-04.md`](./agent-briefing-pack-2026-04.md) | Complete AI Agent Briefing Pack — operating manual for the Paperclip agent team | 2026-04 |
| [`prime-sourcing-deep-research-prompt-2026-08.md`](./prime-sourcing-deep-research-prompt-2026-08.md) | Ready-to-paste Perplexity deep-research prompt for finding the best prime stock — validates the district hypothesis, hunts missing channels; includes follow-ups + where results land | 2026-08 |
| [`prime-sourcing-deep-research-2026-08.md`](./prime-sourcing-deep-research-2026-08.md) | The report that came back: probate is the only quantified discount (10–25%), the £/sqft arbitrage ranking must be built in-house from Land Registry + EPC, super-prime exclusion supported, 2026 refurb/SDLT/bridging benchmarks | 2026-08 |
| [`executor-duty-keyhole-pivot-2026-08.md`](./executor-duty-keyhole-pivot-2026-08.md) | Why Keyhole pivoted the day it shipped: devastavit risk kills a lead-nudge tool; a documented best-value decision file is the product; a binding written offer is the evidence. Mixed-authority sources, verification gated on the compliance opinion | 2026-08 |

## Add new research

1. Drop the markdown in this folder — name it
   `<topic>-<yyyy>-<mm>.md`
2. Add a row to the index above
3. Commit with a message that says what it changes our thinking on
4. Reference it in `docs/PAPERCLIP-SYNC-BRIEF.md` if it changes
   agent behaviour
