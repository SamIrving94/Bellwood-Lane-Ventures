# Email-forward intake — setup guide

Forward any email with a PDF attachment to **`docs@bellwoodslane.co.uk`** and
it lands in `/documents` automatically — extracted, citation-grounded,
linked to a deal if we can match a postcode.

This doc covers the one-time setup with Postmark + Vercel.

---

## What's already shipped (in code)

- **`POST /webhooks/postmark/inbound`** — the endpoint that receives
  Postmark's inbound webhook
- **Basic Auth** validation
- **Sender allowlist** so spammers can't probe the address
- **PDF extraction** via `@repo/document-pipeline` (Mistral OCR + Claude
  Citations)
- **Deal matching** by postcode found in subject + body
- **Persistence** as `DocumentExtract` rows with
  `sourceType='email_forward'`
- **Acknowledgement email** back to the sender summarising what was filed
- **`FounderAction`** created so the inbound shows in `/actions`

---

## What you need to set up

### 1. Postmark account + verified sending domain

- Sign up at <https://postmarkapp.com>. Free tier covers 100 inbound/month
  and most of what you'll need.
- Add `bellwoodslane.co.uk` as a sender domain. Verify via DNS records
  (TXT + DKIM + Return-Path).
- Verify in their UI before continuing.

### 2. Inbound stream + address

- In Postmark: **Servers → your server → Inbound stream**.
- Set the inbound forwarding address. Postmark generates one like
  `1234567890abcdef@inbound.postmarkapp.com`.
- In your DNS, add an **MX record** for `docs.bellwoodslane.co.uk` (or
  whichever subdomain you prefer) pointing at `inbound.postmarkapp.com`.
- Postmark catches anything sent to `*@docs.bellwoodslane.co.uk` and
  forwards to your webhook.

(Alternative: a single-address inbox. Use Postmark's forwarding-to-address
feature so `docs@bellwoodslane.co.uk` (or any vanity address) lands at the
Postmark inbound address.)

### 3. Webhook URL + auth credentials

In Postmark: **Inbound stream → Webhook**.

- **URL:** `https://bellwood-api.vercel.app/webhooks/postmark/inbound`
- **Include Raw Email Content:** off (not needed)
- **Basic Auth:** generate two long random strings and set them as
  username + password (e.g. `openssl rand -hex 16` twice).

### 4. Vercel env vars (`bellwood-api` project)

Set these in **Vercel → bellwood-api → Settings → Environment Variables**:

| Var | Value |
|---|---|
| `POSTMARK_INBOUND_USER` | The Basic Auth username you set in Postmark |
| `POSTMARK_INBOUND_PASS` | The Basic Auth password you set in Postmark |
| `EMAIL_FORWARD_ALLOWLIST` | Comma-separated: `samjlirving@gmail.com,cofounder@gmail.com,you@bellwoodslane.co.uk` |
| `MISTRAL_API_KEY` *(optional)* | Unlocks the OCR layer; Claude reads the PDF directly without it |
| `ANTHROPIC_API_KEY` *(already set)* | Required — drives the extraction |
| `RESEND_TOKEN` + `RESEND_FROM` *(already set)* | Required for the acknowledgement email |

**Redeploy** after setting the vars.

### 5. Smoke test

From an allowlisted address, forward any email with a PDF attachment to
`docs@bellwoodslane.co.uk`. Within ~60 seconds:

1. You receive an acknowledgement email listing what was filed.
2. The doc appears in `/documents` on the dashboard.
3. A `FounderAction` of type `general` appears in `/actions`.

If something fails, watch Vercel logs for `[postmark/inbound]` lines.

---

## How matching works

When an inbound email arrives we extract every UK postcode from the
**subject + body** (regex `[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}`). We then
search `Deal` for an active row whose `postcode` matches:

1. **Full-postcode equality first** (e.g. `M14 5AB` → exact match).
2. **Outward-code `startsWith`** (e.g. `M14` → any active M14 deal).

The first match wins, ordered by most recently updated. No match → the
extract lands in `/documents` unlinked, and the `FounderAction` is set to
`medium` priority so the founder knows to file it manually.

---

## Doc type detection

Best-effort keyword scan of **subject + filename**:

- `probate`, `grant of`, `letters of admin`, `deceased` → **probate**
- `lease`, `leasehold`, `ground rent`, `service charge`, `tp1`, `lpe1` → **lease**
- `contract`, `redline`, `tr1`, `sale agreement`, `memorandum`, `completion statement` → **contract**
- otherwise → **other**

Full per-type prompts (lease pack extraction, contract redline analysis)
land in a future iteration; today they all run through the probate
extractor which produces looser field coverage on non-probate documents.

---

## Spend per inbound email

(Verify against current Anthropic / Mistral pricing — these are
early-2026 estimates.)

| Pipeline step | Cost band |
|---|---|
| Mistral OCR (~10 pages typical) | ~£0.01 |
| Claude Sonnet extraction with Citations API | ~£0.04 |
| Resend acknowledgement | free tier |
| **Per email with one PDF** | **~£0.05** |

At 200 emails/month: **~£10/month inference spend**. Trivial vs the time
saved.

---

## Security posture

- **Basic Auth** between Postmark and our endpoint (rotate the password
  if you suspect leak).
- **Allowlist** prevents unknown senders from polluting the document
  pipeline.
- **Silent drop** of non-allowlisted senders — they don't learn the
  address exists.
- **No raw email body persisted** — only the subject (capped at 500 chars)
  and the sender email. PII inside the PDF lives in `DocumentExtract` like
  any other upload.
- **25 MB attachment cap** prevents abuse.

Want a per-attachment audit log? Add a `DocumentExtractAuditLog` model and
write on every inbound. Not shipped in v1.
