<!--
Table of contents:
  §1 — The 4 crons
  §2 — Per-cron specs
  §3 — /marketing hub route map
  §4 — PLAN.md §6 workflows → cron mapping
  §5 — Verification
-->

# Marketer — Internal Cron Architecture

**Status:** May 2026 (v1).
**Audience:** CEO, Engineer, Marketer, Liaison, Counsel.
**Companion docs:** `docs/marketing/PLAN.md`, `docs/PAPERCLIP-SYNC-BRIEF.md`,
`docs/HANDOVER.md`.

This is the **forward-looking source of truth** for how marketing
automation runs at Bellwood Ventures. As of May 2026, marketing
workflows have moved off the external Paperclip poller and into
**internal Vercel crons** that call Claude directly via `@repo/ai/claude`
and create `FounderAction` records for founder approval.

Paperclip remains supported as optional dev tooling. The `/agents/*` HTTP
contracts are unchanged — they're now called primarily from internal
cron, not from an external runtime.

---

## §1 The 4 crons

Four cron routes own the entire marketing surface. All four are
`POST` routes, all four require the `CRON_SECRET` bearer.

| Route | Schedule | What it does | Action types it creates |
|---|---|---|---|
| `/cron/marketer-daily` | `45 7 * * *` (07:45 daily) | IG posts from yesterday's signed offers + completions; case-study seeds on completion | `approve_ig_post`, `approve_case_study` |
| `/cron/marketer-weekly` | `30 18 * * 0` (Sun 18:30) | 5 LinkedIn topics + 2 vendor SEO blog drafts | `approve_linkedin_post`, `approve_blog_draft` |
| `/cron/marketer-monthly` | `0 8 1 * *` (1st of month, 08:00) | Solicitor outreach batch + paid ad variants | `approve_solicitor_outreach`, `approve_paid_ad_copy` |
| `/cron/event-poller` | `*/30 * * * *` (every 30 min) | Inbound vendor reply triage; fills gaps in daily IG drafts | `approve_outreach_draft`, `approve_ig_post` |

**Design principle:** every cron creates `FounderAction` records and
surfaces them in `/marketing/queue`. **Nothing** vendor-facing is sent
without explicit CEO approval. This extends the platform-wide
"vendor comms always held" rule from `PLAN.md §11` to every marketing
artefact.

---

## §2 Per-cron specs

### 2.1 `/cron/marketer-daily`

- **File:** `apps/api/app/cron/marketer-daily/route.ts`
- **Auth:** `Authorization: Bearer ${CRON_SECRET}`
- **Schedule:** `45 7 * * *` (07:45 daily)

**Queries:**

- Signed `QuoteOffer` rows with `createdAt > now - 24h`
- `Deal` rows with `status = 'completed'` and `completedAt > now - 24h`
- Existing `FounderAction` rows of type `approve_ig_post` from the last
  48h (to avoid duplicates)

**LLM call:**

- **Model:** `@repo/ai/claude` default model
- **Feature tag:** `ig_post_draft`
- **Output shape:** `{ caption: string, hashtags: string[], anonymisationNotes: string }`

**FounderActions created:**

- `approve_ig_post` — one per offer, priority `medium`, metadata:
  `{ quoteOfferId, caption, hashtags, postcodeArea, anonymisationNotes }`
- `approve_case_study` — one per completion, priority `medium`, metadata:
  `{ dealId, draftMarkdown, publishNotBefore }`

**Idempotency:**

- Dedup by `quoteOfferId` / `dealId` in `FounderAction.dedupKey`.
- A second run on the same day is a no-op.

**Failure modes:**

- LLM timeout → log to `AgentEvent`, retry next day.
- Empty result set → write a `system` event noting "no qualifying offers".
- Database error → fail fast, no partial writes.

### 2.2 `/cron/marketer-weekly`

- **File:** `apps/api/app/cron/marketer-weekly/route.ts`
- **Auth:** `Authorization: Bearer ${CRON_SECRET}`
- **Schedule:** `30 18 * * 0` (Sun 18:30)

**Queries:**

- Last 7 days of `DealUpdate` rows for case-study material
- `Contact` rows with `type = 'estate_agent'` and `tags includes
  'status:active'` for LinkedIn audience sizing
- Trailing `OutreachCampaign` rows tagged `linkedin_education` (for
  topic deduplication)

**LLM call:**

- **Model:** `@repo/ai/claude` default model
- **Feature tag:** `linkedin_topics`
- **Output shape:** `{ topics: { title, hook, body, cta }[], blogDrafts: { title, slug, draftMarkdown }[] }`

**FounderActions created:**

- `approve_linkedin_post` — 5 per run, priority `low`, metadata:
  `{ topic, hook, body, cta, targetPostDate }`
- `approve_blog_draft` — 2 per run, priority `low`, metadata:
  `{ slug, title, draftMarkdown, requiresCounselReview: true }`

**Idempotency:**

- One run per ISO week (`YYYY-WW`) tracked via `FounderAction.dedupKey`.
- Re-running mid-week is a no-op.

**Failure modes:**

- LLM timeout → log + retry next week.
- Topic collision with last 4 weeks → drop and regenerate up to 3 times.

### 2.3 `/cron/marketer-monthly`

- **File:** `apps/api/app/cron/marketer-monthly/route.ts`
- **Auth:** `Authorization: Bearer ${CRON_SECRET}`
- **Schedule:** `0 8 1 * *` (1st of month, 08:00)

**Queries:**

- `Contact` rows with `type = 'solicitor'` and `tags includes
  'segment:probate' OR 'segment:divorce'`
- Last 30 days of `QuoteRequest` rows by `sellerSituation` for ad-copy
  segment weighting
- Trailing 90 days of `OutreachCampaign` tagged `solicitor_outreach`
  (to avoid re-targeting cold contacts too soon)

**LLM call:**

- **Model:** `@repo/ai/claude` default model
- **Feature tags:** `solicitor_outreach`, `paid_ad_copy`
- **Output shape:** `{ outreachBatch: OutreachTemplate[], adVariants: { segment, headline, body, ctaUrl }[] }`

**FounderActions created:**

- `approve_solicitor_outreach` — one per solicitor segment, priority
  `medium`, metadata: `{ recipientContactIds, templates, sequenceCadence }`
- `approve_paid_ad_copy` — one per ad variant, priority `low`, metadata:
  `{ segment, headline, body, ctaUrl, channel, counselReviewRequired }`

**Idempotency:**

- One run per calendar month (`YYYY-MM`) tracked via
  `FounderAction.dedupKey`.

**Failure modes:**

- Contact set empty → log "no fresh solicitors" event, no actions
  created.
- LLM timeout → fail loud; CEO sees missing monthly batch in
  `/marketing/queue`.

### 2.4 `/cron/event-poller`

- **File:** `apps/api/app/cron/event-poller/route.ts`
- **Auth:** `Authorization: Bearer ${CRON_SECRET}`
- **Schedule:** `*/30 * * * *` (every 30 min)

**Queries:**

- `DealUpdate` rows of `kind = 'note'` with `createdAt > now - 30min`
  where the source is an inbound vendor reply
- `QuoteRequest` rows with `status = 'quoted'` and no IG post action
  in the last 4h (gap-fill for daily cron misses)
- TrackToken reply events from the last 30 min

**LLM call:**

- **Model:** `@repo/ai/claude` default model
- **Feature tag:** `vendor_reply_triage`
- **Output shape:** `{ replyDraft: string, sentiment, urgency, suggestedAction }`

**FounderActions created:**

- `approve_outreach_draft` — one per inbound reply, priority `high` if
  `urgency = critical`, metadata:
  `{ contactId, replyDraft, sentiment, dedupKey: inboundMessageId }`
- `approve_ig_post` — gap-fill only, metadata as in §2.1.

**Idempotency:**

- **Critical here.** Uses `FounderAction.dedupKey = inboundMessageId` to
  prevent duplicate drafts when the poller catches the same message
  twice across runs.
- Gap-fill IG posts dedup by `quoteOfferId` same as §2.1.

**Failure modes:**

- LLM timeout → skip this 30-min window; next run picks it up.
- Duplicate message → silently skipped via dedupKey.

---

## §3 `/marketing` hub route map

Quick map of the dashboard hub:

- `/marketing` → redirects to `/marketing/queue`
- `/marketing/queue` — approval queue, marketing action types only
- `/marketing/calendar` — month view of published items
- `/marketing/performance` — placeholder until UTM lands

**Compliance gate (case studies):**

`metadata.publishNotBefore` is set on case-study actions to
`acquiredAt + 30 days` per the anonymisation rule in `PLAN.md §11`.

The Queue tab renders future-dated rows at `opacity-50` with a
"Publishes after {date}" badge but does **NOT** hide them — per
`PLAN.md §11`. The founder must see what's pending so the case-study
pipeline stays visible.

---

## §4 PLAN.md §6 workflows → cron mapping

Same 13-row table as `docs/marketing/PLAN.md §6`, with the new "Cron
route" column.

| Workflow | Owner | Approval | Cadence | Cron route |
|---|---|---|---|---|
| Post-offer IG copy + photo selection | **Marketer** | CEO | After every signed offer | `/cron/marketer-daily` |
| Post-resale IG copy + photo | **Marketer** | CEO | After every completion | `/cron/marketer-daily` |
| Weekly LinkedIn educational content | **Marketer** | CEO | Sun evening for week ahead | `/cron/marketer-weekly` |
| Monday prospecting → first-touch DMs/emails | **Marketer** | CEO | Mondays after `/cron/agent-prospecting` fires | `/cron/agent-prospecting` (already existed) |
| LinkedIn comments + DM reply drafts | **Liaison** | CEO | Within 4h of inbound | `/cron/event-poller` |
| Vendor SEO blog post — research + draft | **Marketer** (using `askGeorge()`) | **Counsel + CEO** | 2/week | `/cron/marketer-weekly` |
| Anonymised vendor case study | **Marketer + Counsel** | CEO | After every completion | `/cron/marketer-daily` |
| Paid ad copy variants | **Marketer** | CEO | Monthly | `/cron/marketer-monthly` |
| Inbound vendor reply | **Liaison** | CEO (always) | Within 2h | `/cron/event-poller` |
| Solicitor outreach (probate + divorce) | **Marketer** | CEO | Monthly batch | `/cron/marketer-monthly` |
| Distress-page compliance audit | **Counsel** | — | Quarterly | manual (no cron yet) |
| Founder LinkedIn personal posts | Founders draft, **Marketer suggests** topics | None — your voice | 1–2/week | manual (founder's voice, not automated) |
| Weekly performance digest to CEO | **Marketer** | CEO read-only | Sunday evenings | `/cron/weekly-patterns` (already existed) |

Each row's cron triggers the draft; founder approves via
`/marketing/queue`.

---

## §5 Verification

### Manual triggers (PowerShell)

```powershell
$secret = $env:CRON_SECRET
$base = "https://bellwood-api.vercel.app"
Invoke-RestMethod -Method POST -Uri "$base/cron/marketer-daily"   -Headers @{ Authorization = "Bearer $secret" }
Invoke-RestMethod -Method POST -Uri "$base/cron/marketer-weekly"  -Headers @{ Authorization = "Bearer $secret" }
Invoke-RestMethod -Method POST -Uri "$base/cron/marketer-monthly" -Headers @{ Authorization = "Bearer $secret" }
Invoke-RestMethod -Method POST -Uri "$base/cron/event-poller"     -Headers @{ Authorization = "Bearer $secret" }
```

### Expected FounderActions per cron

- `/cron/marketer-daily` → `approve_ig_post` per yesterday's signed
  offer, `approve_case_study` per yesterday's completion.
- `/cron/marketer-weekly` → 5× `approve_linkedin_post`, 2× `approve_blog_draft`.
- `/cron/marketer-monthly` → 1× `approve_solicitor_outreach` per
  solicitor segment, N× `approve_paid_ad_copy` for the channel mix.
- `/cron/event-poller` → 1× `approve_outreach_draft` per inbound
  vendor reply within the 30-min window; gap-fill `approve_ig_post`
  if the daily cron missed any signed offer in the last 4h.

### Where they show up

- `/marketing/queue` — filtered view of marketing action types only.
- `/actions` — the global Founder Action Centre also lists them.

**Note:** `/marketing` is a **filtered view of the global queue**, not a
separate queue. Same `FounderAction` rows, different lens.

### Telemetry

`/admin/llm-usage` should show new `feature` tags after the first run
of each cron:

- `ig_post_draft` (daily, event-poller gap-fill)
- `linkedin_topics` (weekly)
- `solicitor_outreach` (monthly)
- `paid_ad_copy` (monthly)
- `vendor_reply_triage` (event-poller)

If a tag is missing after the cron should have run, check Vercel
logs for the route and confirm the cron triggered at all (Vercel
cron only fires on Production deployments).

---

## Changelog

### 2026-05 (v1)

- Initial doc. Reflects the migration of marketing automation from
  Paperclip's external polling pattern to internal Vercel crons.
- Companion to `docs/marketing/PLAN.md` and the migration notes on
  `docs/PAPERCLIP-SYNC-BRIEF.md`.
