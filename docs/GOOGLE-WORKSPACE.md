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
  app itself created).
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
