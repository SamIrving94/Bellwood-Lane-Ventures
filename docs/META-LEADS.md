# Meta lead forms → Quotes

_Written: 2026-11-27_

When someone fills in an **instant form** on a Facebook or Instagram ad,
the lead is saved to **Quotes** in the dashboard and a card appears in
the Action Centre. Before this, those leads stayed in Meta's Leads Centre
and were copied over by hand.

## Switch it on: 3 values, about 15 minutes

You need to be an **admin of the Kept business** in Meta, with **full
control of the "Kept. Properties" Page**.

You copy **3 values** from Meta into Vercel. The code does the rest.

### 1. Make the app (5 min) → gives you values 1 and 2

1. Open **developers.facebook.com/apps** and click **Create app**.
2. Name it **Kept Leads**. Pick **Other**, then **Business**.
3. Connect it to the **Kept business portfolio** when asked.
4. In the app, open **App settings → Basic**.
5. Copy the **App ID**. That is **value 1**.
6. Click **Show** next to **App secret** and copy it. That is **value 2**.

### 2. Make the token (7 min) → gives you value 3

1. Open **business.facebook.com/settings**.
2. Go to **Users → System users** and click **Add**.
3. Name it **Kept Leads**. Role: **Admin**.
4. Click **Assign assets**:
   - **Pages → Kept. Properties →** turn on **Full control**.
   - **Apps → Kept Leads →** turn on **Full control**.
5. Click **Generate new token**.
6. App: **Kept Leads**. Expiry: **Never**.
7. Tick these permissions:
   - `leads_retrieval`
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_metadata`
   - `pages_manage_ads`
8. Click **Generate** and copy the token. That is **value 3**.
   Meta shows it **once only**.

### 3. Paste into Vercel (3 min)

1. Open the **bellwood-api** project in Vercel.
2. Go to **Settings → Environment Variables**.
3. Add these three, for **Production**:

| Name | Value |
|:---|:---|
| `META_APP_ID` | value 1 |
| `META_APP_SECRET` | value 2 |
| `META_PAGE_ACCESS_TOKEN` | value 3 |

4. **Merge the PR** (or redeploy if it is already merged).

That is all. Within 30 minutes the code connects itself to Meta and
starts saving leads.

### 4. Check it works

1. Open **developers.facebook.com/tools/lead-ads-testing**.
2. Pick the **Kept. Properties** Page and the form.
3. Click **Create lead**.
4. It should be in **Quotes** within 30 minutes (usually seconds).
5. Delete the test quote.

## What happens to a lead

- Saved as a **draft** quote, source **meta instant form**.
- A **"New Meta lead"** card is raised, due in **24 hours**.
- **Nothing is sent to the seller.** First contact is yours.
- **No valuation.** The form does not ask for an address, and the AVM
  never values without one.
- **No guessing.** Condition and timescale are kept in the seller's own
  words.
- A lead is **never saved twice**.

## Add the address to the form

Ask the ad manager to add Meta's **Street address** and **Post code**
questions. The code picks them up with no change.

## If leads stop arriving

- Look for the **"Meta leads are not coming through"** card. It quotes
  Meta's own error.
- Leads are still safe in **Meta Business Suite → All tools → Leads
  Centre**, for 90 days.
- Once fixed, the next sweep pulls in the last 7 days by itself.

## How it works (for whoever maintains it)

- **Webhook** `/webhooks/meta-leads`: Meta posts the lead id the moment
  a form is sent. The post is signature-checked with the app secret.
- **Sweep** `/cron/meta-leads-sync`, every 30 min: reads every form for
  the last 7 days and saves anything missing.
- **Self-setup**: each sweep (production only) checks that the app's
  webhook points at `/webhooks/meta-leads` for `leadgen` and that the Page
  is subscribed to the app, and fixes either if not. The verify token is
  derived from the app secret.
- **Token**: the system-user token is swapped for the Page's own token in
  code (`resolvePageToken`).
- Page id defaults to the Kept Page (`KEPT_PAGE_ID`). Optional overrides:
  `META_PAGE_ID`, `META_WEBHOOK_VERIFY_TOKEN`, `META_GRAPH_VERSION`.

| What | Where |
|:---|:---|
| Parsing, Graph calls, self-setup, saving | `apps/api/app/cron/_lib/meta-leads.ts` |
| Webhook | `apps/api/app/webhooks/meta-leads/route.ts` |
| Sweep | `apps/api/app/cron/meta-leads-sync/route.ts` |
| Tests | `apps/api/__tests__/meta-leads.test.ts` |
