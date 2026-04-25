# Resend setup — wire real-time email updates to the chain

Bellwoods Lane sends a Resend-backed email to every party in the chain
on every meaningful state change of a deal. Without a Resend token
configured, the system gracefully falls back to console logging — no
crashes, but **no actual emails leave the building**.

## Get a Resend token (5 min)

1. Sign up at <https://resend.com>
2. Verify a sending domain — for production, that's `bellwoodslane.co.uk`
3. Create an API key with `sending` scope
4. Copy the key (starts with `re_`)

## Wire it in

Add to **all three** environments:

### Local dev — `apps/web/.env.local`, `apps/app/.env.local`, `apps/api/.env.local`

```bash
RESEND_TOKEN=re_xxxxxxxxxxxxxxxxxxxx
RESEND_FROM="Bellwoods Lane <hello@bellwoodslane.co.uk>"
```

### Vercel production

For each project (`bellwood-app`, `bellwood-api`, web — once deployed):

```bash
vercel env add RESEND_TOKEN production
vercel env add RESEND_FROM production
```

## Verify it works

```bash
# from a terminal:
curl -X POST http://localhost:3001/api/proof-of-funds \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"YOUR_REAL_EMAIL@gmail.com","context":"smoke test"}'
```

You should receive an email at `YOUR_REAL_EMAIL`. If you don't:

- Check `apps/web` console logs for `[proof-of-funds]` entries
- Confirm `RESEND_TOKEN` is loaded (`echo $RESEND_TOKEN` in the
  terminal that started the dev server)
- Verify the sender domain is verified in Resend (until then, only
  Resend's onboarding sender works — `onboarding@resend.dev`)

## Emails dispatched today

Every event that calls `recordDealUpdate()` will email:

- The seller's `contactEmail`
- The agent linked via `referralCode` (if any)
- `BELLWOODS_FOUNDER_EMAIL` (defaults to `anthony@bellwoodslane.co.uk`)

Triggers in current code:

| Trigger | Where | Kind |
|:---|:---|:---|
| Quote submitted | `POST /api/quote` | `offer_sent` |
| Manual update | `POST /agents/deal-update` (Bearer) | any of 19 kinds |
| Founder approval (TODO) | dashboard action | `offer_accepted` |
| Solicitor instructed (TODO) | dashboard action | `solicitor_instructed` |

## How to add a new trigger

```ts
import { recordDealUpdate } from '@repo/deal-updates';

await recordDealUpdate({
  quoteRequestId: quote.id,
  kind: 'survey_completed',
  title: 'RICS survey complete — no material issues',
  detail:
    'Surveyor visited 24 Apr. No structural concerns, EPC matches.',
  metadata: {
    surveyor: 'Jones & Partners',
    visitedAt: '2026-04-24',
  },
});
```

The function returns `{ id, trackUrl, notifiedTo }`. Failures never
block — they log and degrade gracefully.

## Privacy note

We hold seller emails for the duration of the live offer + 7 years
for AML record-keeping. The tracker token is unguessable
(18 random bytes, base64-url) so the URL itself acts as a capability
— share it and we trust the holder. We do **not** require a login.
