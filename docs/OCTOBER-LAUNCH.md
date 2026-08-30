# October launch — the outstanding-actions board

_Created 2026-08-30. One month to launch. This is the single list: what is
outstanding in the codebase, who owns what, and the order. Update it as
items close — a stale launch board is worse than none._

**Companion docs:** `docs/marketing/PLAN.md` (the channel plan — still
sound), `docs/proposals/keyhole-probate-shelf-tree.md` (the shelf),
`docs/proposals/prime-2m-plus-keyhole-flip.md`, PR #94 (all code).

---

## 0. The one decision that shapes the month (Sam + Ant, this week)

**What does "launch" mean in October?** Two honest options:

- **A — Go loud on vendors:** paid acquisition on per `PLAN.md` §4
  (£1k/month, Google-led), professional pilots running alongside.
- **B — Professional-first, paid soft:** Keyhole pilots + first-look +
  solicitor outreach lead; a small paid test (£250–£500) runs behind to
  calibrate cost-per-lead before scaling.

The case for B, stated once (challenge rule): a young brand with no
public reviews or case studies buys expensive clicks; the trust artefacts
(`PLAN.md` §7) are what make paid traffic convert, and most are not built
yet. The case for A: probate and chain-break searches are high-intent and
the promise is genuinely different. Both work — pick one on purpose.

## 1. Sam — do these, in this order

| # | Action | Unblocks |
|--:|:--|:--|
| 1 | Merge **PR #94** (mark ready → merge; deploys everything) | Keyhole live, /strategy review visible to Ant |
| 2 | Add **EPC_API_TOKEN** to the web Vercel project + your local `.env` (check bellwood-api first — may already hold one) | Keyhole EPC section; arbitrage script |
| 3 | Run **`pnpm migrate`** against prod | KeyholeReport table |
| 4 | **Seed the fringe:** `pnpm tsx scripts/seed-london-prime.mts --write --districts=W11,NW3` (dry-run first) then Settings → Scouting → **Run scout now** | The £1.5M–£10M trial |
| 5 | Run **`pnpm tsx --env-file=.env scripts/arbitrage-rank.mts --districts=SE22,SW12,W11,NW3 --csv=arbitrage.csv`** and send Claude the CSV | Evidence-based district re-tiering |
| 6 | Confirm **deals@wearekept.co.uk** receives mail | Keyhole referrals have somewhere to land |
| 7 | Pick the **5–8 Keyhole pilot professionals** (local probate firms in our postcodes first) | Phase 0 pilot |
| 8 | Start the **first-look buying-agent list** (template: `docs/templates/buying-agent-first-look.md`) | Top-end relationship channel |
| 9 | Glance at **PropertyData credits** after two scout runs | Trial stays inside budget |
| 10 | If freelancer approved (§0 + §4): **shortlist and hire** | Paid channel |

## 2. Ant — decisions waiting on /strategy (plus two jobs)

Open decision numbers from the dashboard review: **1–10 and 12**
(11 — the prime floor — Sam decided: floor stays, £1.5M–£10M is the
cornerstone tier). The three that block work:

- **#8 Next module: vacancy guard or IHT map?** ← blocks Claude's next
  build. Recommendation on file: vacancy guard.
- **#9 The integrity firewall** — sign-off.
- **#12 IHT-funding veto** — confirm.

Two jobs beyond the votes:

- **Commission the compliance opinion** (SRA/RICS referral rules + the
  justification-pack legal claims + the FCA perimeter). Blocks Phase 2
  referral fees and any legal claim in copy — start it now, opinions
  take weeks.
- **Money plumbing before the first cornerstone buy:** SDLT structure
  (developer/trader relief vs flat 15% — up to ~£300k on a £2M deal)
  with the accountant, and a **sub-60% LTV bridging line**.
- Small standing item: the **EIG subscription** proposal (£30/month,
  unsold-lot signal) has been open since May — decide it either way.

## 3. Claude — queued and blocked

| Status | Item |
|:--|:--|
| **Ready now, say the word** | Draft the **freelancer brief** (one page, built from the live site + KEPT voice + `PLAN.md` §2/§11 rails) |
| **Ready now, say the word** | Draft the **Keyhole pilot invitation email** (KEPT voice, founder-sent) |
| **Ready now, say the word** | **Watch PR #94** to merge (CI + review comments) |
| Queued (with next code block) | **Cornerstone tier badge** (£1.5M+ marker on prime leads) |
| Blocked on Ant #8 | Build the next shelf module (vacancy guard or IHT map) |
| Blocked on Sam #5 | **Re-tier the district list** from the arbitrage CSV |
| Post-pilot | Keyhole V1.1 evidence features (holding costs, comparator, decision record) |
| Backlog (pre-existing) | Savills + Clive Emson auction parsers (stubs today) |

## 4. The freelancer question, answered

**Yes — but hire an executor, not a strategist.** The strategy exists
(`docs/marketing/PLAN.md`): channel mix with spend shares, £1k/month
phase-1 budget, and kill thresholds (<£250 CPA scale, >£600 kill). The
gap since the Marketer agent was retired is a person to run it.

- **Right first hire: a paid-search (PPC) specialist** — Google Search +
  PMax + Meta retargeting is 75% of the vendor spend and one skill set.
  Manage them on `PLAN.md` §10's four vendor numbers, nothing else.
- **Wrong hire: a generalist "do our marketing" freelancer.** The
  professional channels (solicitors, buying agents, family offices,
  LinkedIn-as-founder) are trust channels — they cannot be outsourced
  and are already founder work on this board.
- **Copy control is non-negotiable:** brief from the LIVE SITE (never
  from docs alone — repo rule), KEPT voice, §11 guardrails; a founder
  approves every ad text before it runs. The freelancer owns structure,
  bids and reporting — never the voice.
- **Honest scale note:** at £1k/month media, a good freelancer's fee
  will rival the spend. That is normal at this size; treat month one as
  paying for calibrated CPL numbers, not for volume.

**The month, roughly:** week 1 — scope decision + shortlist + brief out;
week 2 — hire, campaigns built dark; week 3 — copy/compliance pass,
tracking verified end to end (UTM → form → deal); week 4 — live at
launch, or the small-test version if option B wins.

## 5. Codebase — where it actually stands

Shipped and green on PR #94: the deep-research prompt + results, the
strategy docs, the seed `--districts` flag, the arbitrage engine (70
tests), Keyhole Phase 0 (report, PDF, referral, rate limits, DB model),
the pivot copy, the shelf tree, the challenge-before-building rule, and
the /strategy review for Ant. Nothing on the branch is blocked on code —
every open item above is a decision, an env var, or a relationship.
