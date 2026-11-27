# Meta lead forms → Quotes

_Written: 2026-11-27_

When someone fills in an **instant form** on a Facebook or Instagram ad,
the lead is saved to **Quotes** in the dashboard and a card appears in
the Action Centre. Before this, those leads stayed in Meta's Leads Centre
and were copied over by hand.

## What happens to a lead

1. Meta tells Kept the moment the form is sent (`/webhooks/meta-leads`).
2. Kept reads the answers from Meta and saves a **draft** quote, source
   `meta instant form`.
3. A **"New Meta lead"** card is raised, due in 24 hours.
4. Every 30 minutes a sweep (`/cron/meta-leads-sync`) checks all forms
   for anything from the last 7 days that was missed. A lead is never
   saved twice.

What it does **not** do:

- **Nothing is sent to the seller.** A person makes first contact.
- **No valuation.** The form does not ask for an address, and the AVM
  never values without one.
- **No guessing.** Condition and timescale are kept in the seller's own
  words in the notes.

If the sweep cannot read Meta (most often an expired token), it raises a
critical card: **"Meta leads are not coming through"**, once a day.

## Add the address to the form

The form today asks for name, email, phone, property type, condition and
timescale. Ask the ad manager to add Meta's **Street address** and
**Post code** questions. The code picks them up with no change, and the
lead then shows its address in Quotes.

## One-off setup

Needs a Meta **Business admin** who also has full control of the Kept
Page. About 20 minutes.

1. **Create the app.** developers.facebook.com → My Apps → Create app →
   type *Business*, owned by the Kept business portfolio.
2. **App secret.** App settings → Basic → *App secret*. This is
   `META_APP_SECRET`.
3. **Verify token.** Make up a long random string. This is
   `META_WEBHOOK_VERIFY_TOKEN`.
4. **Page token that does not expire.** Business settings → Users →
   System users → add one (admin) → give it the Kept **Page** (full
   control) and the **app** → *Generate token* for the app with
   `leads_retrieval`, `pages_show_list`, `pages_read_engagement`,
   `pages_manage_metadata`, `pages_manage_ads`. Then call
   `GET /{page-id}?fields=access_token` with it. The `access_token` that
   comes back is `META_PAGE_ACCESS_TOKEN`.
5. **Page id.** The number in the Page's *About → Page transparency*.
   This is `META_PAGE_ID`.
6. **Set the env vars** on the **`bellwood-api`** Vercel project
   (Production) and redeploy:
   `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`,
   `META_PAGE_ACCESS_TOKEN`, `META_PAGE_ID`.
7. **Point Meta at Kept.** In the app: Webhooks → object **Page** →
   *Subscribe to this object*. Callback URL
   `https://<bellwood-api domain>/webhooks/meta-leads`, verify token from
   step 3. Then subscribe to the **`leadgen`** field.
8. **Subscribe the Page to the app.**
   `POST /{page-id}/subscribed_apps?subscribed_fields=leadgen` with the
   Page token.
9. **Leads access.** Business settings → Integrations → *Leads access* →
   make sure the app (and the system user) is allowed for the Page.
10. **Test.** developers.facebook.com/tools/lead-ads-testing → pick the
    Page and form → *Create lead*. It should appear in Quotes within a
    few seconds. Delete the test quote afterwards.

Steps 1 to 6 alone are enough for the half-hourly sweep to work. Steps 7
to 9 make it instant.

## If leads stop arriving

- Look for the **"Meta leads are not coming through"** card. It quotes
  Meta's own error.
- Leads are still safe in **Meta Business Suite → All tools → Leads
  Centre**, for 90 days.
- Once fixed, the next sweep pulls in the last 7 days by itself.

## Where the code is

| What | Where |
|:---|:---|
| Parsing, Graph calls, saving | `apps/api/app/cron/_lib/meta-leads.ts` |
| Webhook | `apps/api/app/webhooks/meta-leads/route.ts` |
| Sweep | `apps/api/app/cron/meta-leads-sync/route.ts` |
| Tests | `apps/api/__tests__/meta-leads.test.ts` |
