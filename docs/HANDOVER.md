# Bellwoods Lane — Handover

**For:** my co-founder.
**Status:** April 2026. Soft-launch ready.

---

## In one line

We built the platform that lets agents send us **fall-through deals in 60 seconds** and gives us **everything we need to close them in 4 hours**.

---

## The shape of it

We have **three apps** + **one ops layer**:

| Piece | What it is | URL |
|---|---|---|
| **Web** | Public site for agents + sellers | bellwood-web.vercel.app |
| **App** | Our private dashboard | bellwood-app.vercel.app |
| **API** | Cron jobs + Paperclip endpoints | bellwood-api.vercel.app |
| **Paperclip** | AI ops layer (separate) | runs on its own |

---

## What works today

### For agents

- **/save-the-sale** — landing page when their sale collapses.
- **5-field form**. Address, postcode, firm, name, email. Optional WhatsApp number.
- They get a **real cash figure on screen in 60 seconds**.
- They get a **vendor share link** — one tap to WhatsApp.
- They get a **confirmation email** acknowledging the submission.
- We **promise a signed PDF in 4 hours**.

### For us (in the dashboard)

- **Agent inbox** at `/quotes`. Live SLA countdown pills (green / amber / red).
- **Concierge chat** at `/research`. Ask anything about UK property. Powered by **PropertyData's George AI**.
- **Credit balance** shown live in the dashboard.

### Behind the scenes

- The indicative offer uses **real HM Land Registry data** + EPC + HPI + PropertyData's £/sqft AVM.
- Every agent submission creates a **Founder Action** with a 4-hour SLA deadline.
- The action sits in your inbox until you (or Paperclip) close it.
- A **weekly cron** (Mondays 08:30) scans 16 postcodes and surfaces every active estate agent. New firms appear in `/contacts`.

---

## The journey when an agent submits a deal

```
1. Agent fills the form         (60s)
2. Real cash figure on screen   (instant)
3. Confirmation email sent      (instant)
4. Vendor share link generated  (instant)
5. Founder Action created       (instant)
6. Sam/partner sees it in /quotes
7. Within 4 hours we send signed PDF
8. Either:
   - Vendor accepts → instruct solicitors
   - Vendor goes open market → we still pay agent the introducer fee
```

---

## What you can do today

### To pick up an agent submission

1. **Go to** bellwood-app.vercel.app/quotes
2. Look for the **amber strip at the top** — agent inbox with countdowns
3. Click any row to see the full detail
4. Draft signed PDF, send via email + WhatsApp
5. Mark it **completed** when done

### To research a property

1. **Go to** bellwood-app.vercel.app/research
2. Type a question. Examples:
   - *"Pull comparable sold prices in SK4 3HQ for terraced houses"*
   - *"Top 5 estate agents in M14 by listing volume"*
   - *"Risk profile for W14 9JH — flood, planning, conservation"*
3. The **credit balance** is shown top-right.

### To find new agents to outreach

1. The cron runs **automatic Mondays 08:30**.
2. New firms appear in `/contacts` filtered to `estate_agent`.
3. Tag `status:not_yet_contacted` shows who's fresh.

---

## Key documents in the repo

| Doc | What it covers |
|---|---|
| `docs/HANDOVER.md` | This file |
| `docs/paperclip-handoff/README.md` | What Paperclip does for us |
| `docs/paperclip-handoff/agent-quick-form-ops.md` | The 4-hour SLA workflow in detail |
| `docs/setup/propertydata.md` | PropertyData API key + cron + budget |

---

## What's NOT done yet (the next steps)

In priority order. Each one matters.

### 1. Set RESEND env vars properly

Without these, **agent confirmation emails do nothing**.

- `RESEND_TOKEN` and `RESEND_FROM` need to be set on **bellwood-web** and **bellwood-api** in Vercel.
- Test by submitting a real form — should get an email within seconds.

### 2. Get a real domain

Currently we're on **vercel.app** subdomains.
- Buy `bellwoodslane.co.uk` if not already done
- Point at Vercel
- Update all the in-product links

This is the biggest credibility lift we can do in an hour.

### 3. Get a Bellwoods business WhatsApp number

We promise WhatsApp delivery. We have no number yet.
- Sam decides personal vs new SIM
- Phase 2 needs a proper Bellwoods business WhatsApp account (Twilio or direct)

### 4. Talk to Paperclip team

I've written them a complete brief at `docs/paperclip-handoff/README.md`.

Ask them to:
- Read it
- Push back on anything that doesn't fit
- Answer the 4 open questions (where they live, audit identity, WhatsApp provider, PDF storage)
- Confirm they can poll our API every 60 seconds

### 5. Test with 3 friendly agents

**Don't go wide yet.** Pick 3 agents you trust, get them to:
- Submit a real fall-through via /save-the-sale
- Tell you what's confusing
- Tell you what's missing
- Time us against the 4-hour SLA

We learn what's broken before we open the gates.

### 6. Build the resale workflow

Our pitch says *"when we resell the property, you list it."*
- We have **no operational workflow** for this yet
- Need: a resale-instruction record, agent contract, listing price guidance
- Half a day of build, plus a one-page contract template

### 7. Customer database / CRM

The `/contacts` page exists. The /quotes page exists. They don't talk to each other yet.
- When an agent submits via /save-the-sale, we should **auto-link** their AgentAccount to a Contact in CRM
- Then outreach campaigns can target them

### 8. Mobile design check

I built and edited everything on desktop.
- Agents read on phones between viewings
- Worth Sam or partner doing a phone walkthrough of /save-the-sale and /quotes
- Note anything broken

---

## Open decisions

These are calls only the founders can make:

1. **Domain.** bellwoodslane.co.uk — when do we wire it up?
2. **WhatsApp account.** Personal SIM phase 1, business account phase 2 — when is phase 2?
3. **Paperclip cadence.** Daily? Hourly? Real-time webhook? They need to know what we expect.
4. **First 10 agents.** Who do we go to first? Map them by region + relationship.
5. **PropertyData budget.** £48/mo for 5k credits. Move to 15k (£96) when we hit 60 deals/mo.
6. **First investor partner.** Phase 2 has us routing some deals to investors instead of buying. Who's our first?

---

## Where the money is being spent

| Service | Cost/month |
|---|---|
| Vercel Pro | ~£20 |
| Neon Postgres | Free tier currently |
| Resend | Free tier currently |
| PropertyData | £48 (5k plan) |
| Clerk auth | Free tier currently |
| **Total** | **~£68/month** |

Negligible until we have volume.

---

## Quick troubleshooting

### Agent submits but no email arrives
→ `RESEND_TOKEN` and `RESEND_FROM` not set on Vercel `bellwood-web`. Set them.

### Concierge says "PropertyData not configured"
→ `PROPERTYDATA_API_KEY` not set on Vercel `bellwood-app`. Set it.

### Cron isn't running
→ Check `bellwood-api` Vercel logs. Cron only runs in Production deployment.

### Indicative figure looks wrong
→ Submit via `/research` — ask George *"What did you value SK4 3HQ at and why?"* — he'll explain. If still wrong, the AVM weight tuning is in `packages/valuation/`.

---

## What I'd ask my co-founder for

1. **Half a day** reading this + clicking through the dashboard
2. **3 agent names** for friendly testing
3. **Decisions** on the 6 open items above
4. **WhatsApp message** you'd send to the first 10 agents — your wording, not mine

---

**Last updated:** April 2026.
**This doc lives at:** `docs/HANDOVER.md` in the bellwood-app repo.
