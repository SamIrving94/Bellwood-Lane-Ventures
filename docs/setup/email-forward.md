# The deal email log — setup guide

_Last verified against the code: 2026-11-23_

**CC one address on an email and it is stored on the deal.** So is every
reply-all after it. Each deal page has an **Emails** panel; `/deals/email-log`
shows everything and holds the emails that still need a deal.

The same address still takes a forwarded PDF, as before.

Nothing here sends or drafts anything. It keeps the record.

---

## How to use it

| You do | What happens |
|:--|:--|
| **CC the log address** on an email to a seller, solicitor or agent | Stored on the deal. Replies that keep the address in CC follow. |
| **Use the deal's own address** (`log+<deal id>@…`, copy it from the deal page) | Stored on that deal with no matching at all. |
| **Send a PDF to the address, nobody else on the email** | Stored, and the PDF is read into `/documents`. You get a short acknowledgement. |

Use **CC, not BCC**. A reply to a BCC'd email does not come back to us.

**The easy way: the Email buttons.** Each deal's Emails panel has **Email the
seller** and **Email the solicitor** (one per address saved on the deal). They
open a Gmail draft with the recipient, the deal's own address in CC and the
property as the subject. An email started there files itself with no
matching. They only open a draft; a person writes and sends it.

- The button picks your company Google account when your dashboard sign-in
  has an address at the log address's parent domain (`authuser`). If it does
  not, Gmail opens whichever account is first. **Check the From line.**
- On a phone or another mail app, use the small `mailto:` links under the
  buttons.
- Not tested in a real browser against Gmail yet.

**Where the CC can still be lost**

- You start an email somewhere else and forget the CC.
- The other side presses Reply, not Reply-all. Their answer reaches you but
  not the log.

The fix for both is **the automatic copy**, below.

---

## The automatic copy (optional)

Google Workspace copies everything your mailbox sends and receives to the log
address. Nobody has to remember the CC, and a plain Reply is caught too.

**That is your whole mailbox, so the rule for a copy is stricter.** With the
switch on, an email that was not addressed to the log is kept only when it is
deal mail:

| A copied email is kept when | Example |
|:--|:--|
| it is **to or from a deal's seller or solicitor** | you email the seller; the seller replies |
| it **continues a conversation already in the log** | a surveyor replies in a thread you started |
| **you wrote it** to someone outside, and a full **postcode names one deal** | you ask a surveyor to quote for "M14 5AB" |

**Everything else is ignored and leaves no trace.** No row, no card, not
listed under Turned away. Newsletters, friends, your accountant: nothing.

Two more rules:

- **A note between founders is never picked up**, even inside a deal's
  thread, even with a postcode. Want it on the deal? CC the log as before.
- **A deliberate CC behaves exactly as it always did.** It is always kept,
  and waits under "Needs a deal" if no single deal matches.

### What it costs

- **All of the mailbox's mail passes through Postmark** on its way to us, and
  Postmark keeps its own copy for its retention period (45 days by default,
  as I understand it; check your Postmark settings). Only deal mail is kept
  by us.
- **Volume.** The free Postmark tier is about 100 inbound emails a month. A
  whole mailbox is far more, so this needs a paid plan. Check Postmark's
  current pricing before switching on.
- **The privacy notice** should say correspondence is processed this way.
  Worth a read by Counsel.

### Switch it on, in this order

1. **Deploy this code and run `pnpm migrate`.**
2. **Vercel → `bellwood-api`:** set `DEAL_LOG_AUTO_COPY` to `on`, and
   `DEAL_LOG_ADDRESS` to the log address. Check that
   `EMAIL_FORWARD_ALLOWLIST` lists **every mailbox the rule will copy**.
   Redeploy.
3. **Only then, the Google Workspace rule.** In the Admin console
   (admin.google.com): Apps → Google Workspace → Gmail → **Routing** → add a
   rule:
   - Messages to affect: **Inbound** and **Outbound**.
   - Action: **Also deliver to** → Add more recipients → the log address.
   - Scope it to the founders' mailboxes (the organisational unit they are
     in), not the whole company, if there are other users.
   - _These menu names are from memory. Google's help pages could not be
     opened from the build environment, so treat them as a guide, not a
     script._
4. **Check it.** Send any email. Within a few minutes `/deals/email-log`
   shows **"Automatic copy is on. Last email seen …"**. Then email a seller
   who is on a deal, with no CC, and see it land on that deal.

**Step 3 before step 2 is the mistake to avoid.** Without the switch, every
email you send is treated as addressed to the log and becomes a "needs a
deal" card.

**To switch it off:** remove the Google rule first, then unset
`DEAL_LOG_AUTO_COPY`.

### Knowing it is still working

- The log page shows when the last copied email was seen.
- **No copied email for over a day** turns that into an amber warning: check
  the Google rule. Until it is back, only CC'd emails are stored.
- A mailbox the rule copies that is **not on the founder list** raises a
  card. Its incoming deal mail is still kept, but the emails it *sends* to
  sellers are not, until it is added.

### Taking an email back out

Capture is automatic, so there is a way to undo it. On `/deals/email-log`
every email has **Not deal mail? → Remove this email**. It deletes our copy
and its stored attachments. Your mailbox still has it. It cannot be undone.

One thing it cannot do: stop the *next* email. A later message from the same
seller or solicitor, or in the same conversation, is kept again.

### With the switch on, a BCC changes

A BCC looks exactly like a mailbox copy (the address is not in the headers).
So with the switch on, a BCC'd email that matches no deal is **ignored**
instead of waiting to be filed. A BCC to a deal's own address still files.

---

## How an email finds its deal

Strongest evidence first. The code is `resolveDeal` in
`apps/api/app/webhooks/postmark/_lib/deal-email.ts`.

1. **The deal's own address.** Sent to `log+<deal id>@…`.
2. **The thread.** A reply in a conversation that is already on a deal.
3. **The people.** The other side is a deal's seller or solicitor (the emails
   saved on the deal).
4. **The postcode.** A full postcode in the subject or body.

**It must be the only candidate.** Two deals in one postcode, or one solicitor
acting on two of our purchases, means the email is **not filed**. It waits in
`/deals/email-log` with a "needs a deal" card on the Action Centre. Pick the
deal once and the whole conversation follows.

An outward code alone ("M14") no longer matches anything. It used to pick the
most recently updated deal in the district, which is a guess.

**Tip:** put the seller's email and the solicitor's email on the deal. That is
what makes rule 3 work.

---

## Who can write into the log

The address ends up in other people's inboxes the moment it is CC'd, so:

- **Founders** (`EMAIL_FORWARD_ALLOWLIST`): always accepted.
- **Anyone else**: only when the email continues a thread we hold, was sent to
  a real deal's own address, or the **sender** is a deal's seller or solicitor.
- **Everything else is turned away.** The sender is told nothing. A postcode
  in the body never gets a stranger in.

### What happens to mail that is turned away

- The email is **not stored**. Only the sender, the subject line and the
  time (`DealEmailDrop`), **for 30 days**, at most 50 a day.
- It is listed under **Turned away** on `/deals/email-log`, so a refusal is
  visible instead of silent.
- **If the sender is at our own domain** (the domain the log address hangs
  off), it is almost always a founder address missing from
  `EMAIL_FORWARD_ALLOWLIST`. That raises **one high-priority card a week**
  and a banner on the log page, because until it is fixed every email that
  address copies the log on is lost. The card closes itself when an email
  from that address gets through.
- Should one have been kept? Save their email on the deal, then forward the
  email from your mailbox to that deal's own address.

---

## The two-line read

After the email is stored, a model writes a short read of it: who wrote, what
they said, whether they are waiting on us, and the next step. Feature tag
`deal_email_digest`, Haiku tier by default.

- It runs **after** Postmark has its reply, so a slow model cannot cause a
  retry.
- It **drafts and sends nothing**. Its output is only shown on the deal page.
- The email body is treated as untrusted text: fixed output schema, and the
  prompt tells the model the email is data, not instructions.
- If there is no provider or the call fails, the email is still stored and the
  panel shows its opening lines instead.
- **Do this once:** Settings → AI models → `deal_email_digest` → tick
  **PII-safe pinning**. The row appears after the first email. These prompts
  carry sellers' names and addresses.

---

## What you need to set up

### 1. The database table

From the repo root: `pnpm migrate`. This adds `DealEmail`. Until it is run the
deal page says the log is not switched on, and the webhook answers 500 rather
than pretending to have stored the email. Postmark records that as a failed
delivery (see its Inbound activity page), so run the migration before
pointing mail at it.

### 2. Postmark inbound

- Sign up at <https://postmarkapp.com>. The free tier covers 100 inbound
  emails a month; check their current pricing if volume grows.
- **Servers → your server → Inbound stream.**
- Add an **MX record** for a subdomain you choose (for example
  `in.wearekept.co.uk`) pointing at `inbound.postmarkapp.com`, and set that as
  the stream's inbound domain. Postmark then catches everything sent to
  `*@in.wearekept.co.uk`, including the `+<deal id>` form.
- The log address is then any name at that domain, for example
  `log@in.wearekept.co.uk`.

### 3. Webhook URL + auth

In Postmark: **Inbound stream → Webhook**.

- **URL:** `https://bellwood-api.vercel.app/webhooks/postmark/inbound`
- **Include Raw Email Content:** off
- **Basic Auth:** two long random strings as username and password
  (`openssl rand -hex 16`, twice).

### 4. Vercel env vars

**`bellwood-api`:**

| Var | Value |
|:--|:--|
| `POSTMARK_INBOUND_USER` | The Basic Auth username you set in Postmark |
| `POSTMARK_INBOUND_PASS` | The Basic Auth password you set in Postmark |
| `EMAIL_FORWARD_ALLOWLIST` | The founders' sending addresses, comma-separated. **Must include the address you actually send from** (`sam@wearekept.co.uk`). |
| `DEAL_LOG_ADDRESS` | The log address, e.g. `log@in.wearekept.co.uk`. Optional for CC-only use; **set it when the automatic copy is on**, and whenever a vanity address forwards to Postmark's own `…@inbound.postmarkapp.com` address. |
| `DEAL_LOG_AUTO_COPY` | `on` only when Google Workspace copies the mailbox to the log. See "The automatic copy". Leave unset otherwise. |
| `OPENROUTER_API_KEY` | Already set. Drives the two-line read. |
| `RESEND_TOKEN` + `RESEND_FROM` | Already set. Sends the forward acknowledgement. |
| `Deal_Blob_STORE_ID` | The uploads store, for attachments. Already connected if quote PDFs render. |

**`bellwood-app`:**

| Var | Value |
|:--|:--|
| `DEAL_LOG_ADDRESS` | The same log address. Shown on every deal page with a copy button. |

**Redeploy** both after setting the vars.

### 5. Smoke test

1. Open a deal with a seller email on it. Email that seller's address from
   your own, **CC the log address**.
2. Within a minute the email shows under **Emails** on the deal.
3. Reply-all from the other mailbox. That shows too, marked "From them".
4. Send one with no postcode to someone not on any deal. It should appear
   under **Needs a deal** on `/deals/email-log`.

If nothing arrives, look in Vercel logs for `[postmark/inbound]`.

---

## Attachments

- Every real attachment is kept and linked from the email on the deal page.
- **Embedded images under 50 KB are skipped.** Those are signature logos.
  Photos pasted into an email are larger and are kept.
- Files go to the same uploads store as viewing photos and offer PDFs
  (`@repo/storage`). **That store is public: a file is reachable by anyone
  who has its link.** Links carry a random suffix and are only shown in the
  dashboard. If that is not acceptable for ID documents or grants, the store
  needs to change for the whole repo, not just here.
- **PDFs are read into `/documents` only on a deliberate forward** (you, to
  the address, nobody else). A solicitor's letter in a conversation is kept
  but not run through the reader, which is tuned for probate grants.

---

## Known limits

- **Large emails may not arrive.** Postmark POSTs the whole email, attachments
  included, in one request, and Vercel caps a function's request body (about
  4.5 MB, as we understand it). An email above that is rejected before our
  code runs, so it is not logged. A big legal pack is better sent as a link,
  or forwarded in parts. Not verified against a real oversized email yet.
- **The PDF reader is still Anthropic-direct** (`probate-extract.ts`) and dark
  while that account is unfunded. Forwarded PDFs are stored; the extract is
  empty until that moves to OpenRouter. See `docs/LLM-ROUTING.md`.
- **Only deals.** An enquiry that is not a deal yet has nothing to file on.
  Its emails wait under "Needs a deal" until the deal exists.
- **`From` can be forged.** The allowlist trusts the sender address. Postmark
  is the only caller (Basic Auth), and nothing is acted on automatically, so
  the worst case is a stored email that should not be there.

---

## Security posture

- **Basic Auth** between Postmark and our endpoint. Rotate the password if
  you suspect a leak.
- **Mail we have no reason to keep is turned away.** The sender does not
  learn the address exists. We keep the sender and subject for 30 days so a
  founder can see it happened; never the body or attachments.
- **Email bodies ARE stored now** (`DealEmail.bodyText`, capped at 100,000
  characters). They are correspondence about a deal and are deleted with it
  (`onDelete: Cascade`). Before this change only the subject was kept.
- **No acknowledgement goes to anyone but a founder.** The "received your
  forward" email is sent only when a founder writes to the log alone.
- **25 MB per-attachment cap**, in practice bounded by the request limit
  above.

## Doc type detection (forwarded PDFs)

Best-effort keyword scan of **subject + filename**:

- `probate`, `grant of`, `letters of admin`, `deceased` → **probate**
- `lease`, `leasehold`, `ground rent`, `service charge`, `tp1`, `lpe1` → **lease**
- `contract`, `redline`, `tr1`, `sale agreement`, `memorandum`, `completion statement` → **contract**
- otherwise → **other**

All of them still run through the probate extractor, which gives looser
coverage on anything that is not a grant.
