# Email inbox — setup guide

_Written 2026-11-22. Not yet run end to end in production: steps 2 to 5 below are still to do._

The dashboard **Inbox** (`/inbox`) shows every email the app sent and every
reply, one conversation per person, and lets a founder reply from the app.

## How mail flows

```
App  ──send──▶  Resend  ──▶  seller
                              │ reply (Reply-To: sam@wearekept.co.uk)
                              ▼
                     Google Workspace mailbox   ← you still read it in Gmail
                              │ Gmail forwarding rule (a copy)
                              ▼
                     Resend receiving address
                              │ webhook: email.received
                              ▼
        bellwood-api  /webhooks/resend/inbound  ──▶  EmailMessage  ──▶  /inbox
```

- **Google stays the mailbox of record.** If the webhook is down, the reply is
  still in Gmail. Nothing is lost.
- **Outbound logging needs no setup.** It works as soon as the table exists.
- **Inbound needs steps 2 to 5.**

## Why replies bounced (Nov 2026)

The app sends from the `RESEND_FROM` address. That address is send-only: no
mailbox sits behind it. With no Reply-To, replies went to it and Google
answered `550 5.1.1 no such user`. `sendEmail` now always sets Reply-To
(`RESEND_REPLY_TO`, else `sam@wearekept.co.uk`, the one live mailbox).

## Steps

### 1. Create the table

From the repo root: `pnpm migrate`. Adds `EmailMessage`. Nothing else changes.

### 2. Get a receiving address in Resend

Two options. Start with A; move to B when you want a Kept address.

- **A. Resend's own address (no DNS).** Resend → Emails → Receiving → ⋯ →
  "Receiving address". It looks like `anything@<id>.resend.app`.
- **B. A Kept subdomain.** Resend → Domains → add `reply.wearekept.co.uk` →
  copy the MX record it shows into DNS. Use a **subdomain**: the root
  domain's MX must keep pointing at Google.

### 3. Create the webhook in Resend

- Resend → Webhooks → Add.
- **URL:** `https://<bellwood-api production host>/webhooks/resend/inbound`
- **Event:** `email.received` only.
- Copy the **signing secret**.

### 4. Set env vars on Vercel

| Project | Var | Value |
|:---|:---|:---|
| `bellwood-api` | `RESEND_INBOUND_WEBHOOK_SECRET` | the signing secret from step 3 |
| all three | `RESEND_REPLY_TO` | optional; only if replies should go somewhere other than `sam@wearekept.co.uk` |

**Check the API key.** `RESEND_TOKEN` on `bellwood-api` must be a **full
access** key. A sending-only key cannot read received mail: the message
still appears in the Inbox, but with a note in place of its body.

Redeploy `bellwood-api` after setting the vars.

### 5. Forward a copy from Gmail

In the `sam@wearekept.co.uk` Gmail: Settings → Forwarding → add the address
from step 2. Google emails a confirmation code to that address; it shows up
in the dashboard Inbox (and in Resend → Emails → Receiving). Enter the code,
then choose "forward a copy and keep Gmail's copy in the inbox".

### 6. Smoke test

1. Submit a test quote with a personal email address. The welcome email
   appears in `/inbox` under "Sent, no reply yet".
2. Reply to it from that personal address.
3. Within a minute: the reply is in Gmail, the conversation moves to
   "Conversations" in `/inbox` with a "new" badge, and a card appears in Today.
4. Reply from `/inbox`. It arrives inside the same email thread.

## Rules the code keeps

- **Nothing is auto-sent.** A reply from `/inbox` is typed and sent by a
  founder. The vendor-email hold (`OutreachHold`) is unchanged.
- **Own notifications are ignored inbound.** Mail from the `RESEND_FROM`
  address is dropped by the webhook, so forwarded app notifications do not
  show up as "replies".
- **Unknown senders do not raise a card.** They land in `/inbox` only. A card
  in Today needs a sender we have emailed, or the contact on a deal or quote.
- **Sign-in emails are logged without their body** (partner magic links,
  plugin one-time codes): `sensitive: true` on the `sendEmail` call.
- **Inbound HTML is never rendered.** The Inbox shows text only.
- **Internal notifications are not logged.** Sends to `@wearekept.co.uk` or
  `@bellwoodslane.co.uk` are skipped.

## Known limits

- **Attachments** are counted, not stored. Open the email in Gmail.
- **Mail the founder writes from Gmail directly** is not in the log. Only
  app sends and inbound mail are.
- **One conversation per address.** Two properties with the same contact
  share a thread.
