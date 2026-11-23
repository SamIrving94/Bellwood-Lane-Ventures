# Google Workspace connection

One connection from the platform to the **Kept Google Workspace account**.
Code lives in `packages/google`. Connect it at **Settings → Google**.

## What it does

| Feature | Trigger | What happens |
|:---|:---|:---|
| **Gmail drafts** | "To Gmail drafts" on a held email | Draft created in the Kept mailbox. **Never sent.** Hold moves to `drafted`. |
| **Calendar** | Viewing booked, changed or cancelled | Viewing event, plus an all-day **Offer due** marker two working days later. |
| **Drive folders** | Deal reaches `valuation` (or the button on the deal page) | `Kept deals / <address>` with Photos, Legal, Offer, Comps. Never shared automatically. |
| **Gmail labels** | `google-sync` cron, every 30 min | Inbox mail from a deal's seller, solicitor or a known agent gets `Kept/Seller`, `Kept/Solicitor`, `Kept/Agent`. Exact address match only. Solicitor mail is starred. |
| **Deal email log** | `google-sync` cron, every 30 min | Deal mail is copied onto its deal's page, with a two-line summary. Stored emails get the `Kept/Logged` label. See below. |
| **Morning brief** | `google-daily` cron, 06:40 UTC | One email from the Kept mailbox to itself. |
| **Partner sheet** | `google-daily` cron, or the button in Settings | Anonymised pipeline Sheet. Private until the founder shares it. |

## Rules

- **Vendor-facing mail is drafts only.** The only send is the morning brief,
  to the Kept mailbox itself.
- **Kept account only.** `gmail.com` / `googlemail.com` accounts are refused
  at the callback.
- **Nothing breaks without Google.** Every feature returns `{ skipped: true }`
  when not connected. Call sites log a Google failure and carry on.
- **The partner sheet cannot leak.** Its query selects only stage, postcode,
  type, bedrooms and stage date; the CSV prints the outward code only.
- **No schema change.** The connection and the links (deal → folder,
  viewing → events) are rows in `Setting`, keyed `google:*`.

## Deal email log

_Added 2026-11-23. Not yet used against a live Google account._

Kept reads the Kept mailbox and puts each deal's emails on its page
(**Emails** panel, and `/deals/email-log` for everything). There is no
address to CC and no mail provider in between.

**What is kept**

| An email is kept when | Example |
|:--|:--|
| it is **to or from a deal's seller or solicitor** | you email the seller; the seller replies |
| it **continues a conversation already in the log** | a surveyor replies in a thread you started |
| **we wrote it** to someone outside, and a full **postcode names one deal** | you ask a surveyor to quote for "M14 5AB" |
| you put the **`Kept/Log`** label on it in Gmail | an agent's email you want on file |

**Everything else is ignored and leaves no trace.** For mail that is not
deal mail, only the headers (who, subject, Gmail's short preview) are read,
in memory, to decide. Its body is never fetched and nothing about it is
stored.

**Rules**

- **It never guesses the deal.** Two deals in one postcode, or one solicitor
  on two purchases, and the email waits under "Needs a deal" with a card on
  the Action Centre. Pick the deal once and the whole conversation follows.
- **A note between colleagues is never picked up**, even inside a deal's
  thread, even with a postcode. Want it on the deal? Label it `Kept/Log`.
- **A postcode in someone else's email does not count.** A property
  newsletter can name any postcode.
- **It only reads.** Nothing is sent, archived, deleted or marked read. The
  one change it makes in Gmail is adding the `Kept/Logged` label to what it
  stored, so you can see in Gmail that an email was taken.
- **Attachments stay in Gmail.** They are listed by name; "Open in Gmail"
  takes you to the file. Nothing is copied into our storage.
- **The summary is display-only.** Feature `deal_email_digest`, written by
  the cron after the import, one attempt per email. Tick **PII-safe pinning**
  for it in Settings → AI models once the row appears.

**Getting history.** The sync only looks forward (three days on its first
run). On a deal, **Find older emails** searches Gmail for that deal's seller
and solicitor over the last six months and adds what belongs to it. Use it
after adding a contact to a deal too.

**Taking one back.** On `/deals/email-log`, **Not deal mail? → Remove this
email** wipes our copy and stops that email being read again. It stays in
Gmail. A later email from the same person is still kept.

**Is it working?** `/deals/email-log` shows the mailbox, when it was last
checked and how many emails that run kept. It warns when Google is
disconnected, and when no check has run for two hours.

**Setup.** `pnpm migrate` (adds the `DealEmail` table), then connect Google
below. Put the seller's and solicitor's emails on each deal: that is what the
log matches on.

**Limits**

- **One mailbox**: the connected Kept account. Mail that only reaches
  another address is not seen.
- **Up to 30 minutes behind.**
- **Only deals.** An enquiry that is not a deal yet has nothing to file on.
- **A solicitor who is on a deal and writes about something else** will have
  that email filed on the deal. Remove it by hand.
- **Agents are not matched by address** (one agent spans many homes). Their
  emails are kept through a thread you are in, or the `Kept/Log` label.

## One-time setup (founder)

Signed in as the **Kept** account:

1. `console.cloud.google.com` → new project **Kept Platform**.
2. Enable three APIs: **Gmail API**, **Google Calendar API**, **Google Drive API**.
3. OAuth consent screen → user type **Internal**.
4. Credentials → **OAuth client ID** → **Web application**.
   Authorised redirect URI: copy it from **Settings → Google** in the dashboard.
5. In Vercel, add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to **both**
   `bellwood-app` and `bellwood-api`. Redeploy both.
6. Dashboard → **Settings → Google** → **Connect Google**.

## Security notes

- Scopes: `gmail.modify`, `calendar.events`, `drive.file` (only files the
  app itself created). `gmail.modify` is what lets the deal email log read
  mail and add its label; it never uses it to send, delete or archive.
- The refresh token is encrypted (AES-256-GCM) with a key derived from
  `GOOGLE_CLIENT_SECRET`. Rotating the secret means reconnecting.
- If Google revokes access the connection is marked broken and Settings →
  Google shows **Reconnect**.

## Not built yet

- **Offer letter as a Google Doc.** The only template
  (`docs/templates/binding-offer-letter.md`) is for agent-introduced quotes
  and shows an indicative range, which the no-indicative-offers rule
  forbids for sellers. Needs signed-off seller wording first.
- **Travel time on viewing events.** Needs a maps key.
- **Bank holidays** in the two-working-day sum. It errs early, never late.
