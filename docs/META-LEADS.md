# Meta lead forms → Quotes

_Written: 2026-11-27 · Meta's app screens checked: 2026-11-28_

When someone fills in an **instant form** on a Facebook or Instagram ad,
the lead is saved to **Quotes** in the dashboard and a card appears in
the Action Centre. Before this, those leads stayed in Meta's Leads Centre
and were copied over by hand.

---

# Setup guide

**Time:** about 20 minutes, done once.

**What you are doing:** giving Kept a key to read your Meta leads.
You copy **3 values** from Meta and paste them into Vercel. The code
does everything else.

Each step says:

- **Do:** what to click.
- **You'll see:** what should appear.
- **Why:** what it is for.

## Before you start

- **Use a computer**, not your phone. Meta hides some of these pages on
  mobile.
- **Log in to Facebook as yourself.** You must be an **admin of the Kept
  business** and have **full control of the "Kept. Properties" Page**.
- **Open a note** (Notes app or a text file) to paste the 3 values into
  as you go. Delete the note at the end.
- **Download the app icon:** `docs/assets/meta-app-icon.png` in this
  repo (the Kept **k.**, 1024 × 1024). Meta asks for one in Part 2.

| Value | What it is | Where it goes |
|:---|:---|:---|
| **Value 1** | App ID | `META_APP_ID` |
| **Value 2** | App secret | `META_APP_SECRET` |
| **Value 3** | Access token | `META_PAGE_ACCESS_TOKEN` |

---

## Part 1 · Make the app (5 min) → values 1 and 2

**Why this part:** Meta only lets software read leads through an "app".
This app is private to Kept. Nobody else sees it or uses it.

### 1.1 Open the app page

- **Do:** go to **developers.facebook.com/apps**. Click **Create app**
  (green button, top right).
- **You'll see:** a box asking for app details.
- **Why:** this starts a new app.
- **If it asks you to register as a developer:** click through. It is
  free and takes one minute (accept terms, confirm your phone or email).

### 1.2 Name it

- **Do:** App name: **Kept Leads**. App contact email: the Kept
  mailbox. Click **Next**.
- **Why:** the name is only for you. The email is where Meta sends
  notices about the app.

### 1.3 Pick the use case

- **Do:** tick only **Capture & manage ad leads with Marketing API**
  (the funnel icon). Click **Next**.
- **Do not** pick **Other**. Meta marks it "going away soon".
- **Do not** tick anything else.
- **Why:** this use case comes with the permission to **read leads**
  (`leads_retrieval`). Nothing extra means less for Meta to review.

### 1.4 Connect the business

- **Do:** pick the **Kept** business portfolio. Click **Next**.
- **Why:** the app must belong to the same business as the Page and the
  ad account, or it cannot see their leads.
- **If you see more than one Kept business:** pick the one that owns the
  **Kept. Properties** Page.

### 1.5 Finish

- **Do:** on the last screens (requirements, overview) click **Next**,
  then **Go to dashboard** (or **Create app**). Meta may ask for your
  Facebook password.
- **You'll see:** the app dashboard, with **Kept Leads** at the top left.

### 1.6 Check the permissions

- **Do:** on the dashboard click **Use cases** in the left menu, then
  **Customize** next to **Capture & manage ad leads**.
- **You'll see:** a list of permissions.
- **Do:** make sure these 5 show **Ready for testing** or **Added**. If
  any shows an **Add** button, click it:
  - `leads_retrieval`: read the leads
  - `pages_show_list`: find the Kept Page
  - `pages_read_engagement`: read the Page's basic details
  - `pages_manage_metadata`: switch on the instant alert
  - `pages_manage_ads`: see the lead forms on the Page
- **Why:** the token in Part 3 can only use permissions the app has.

### 1.7 Copy values 1 and 2

- **Do:** left menu → **App settings** → **Basic**.
- **Do:** copy **App ID** into your note as **value 1**.
- **Do:** next to **App secret** click **Show**. Enter your Facebook
  password if asked. Copy it as **value 2**.
- **Why:** the App ID says which app is calling. The secret proves the
  alert Meta sends really came from Meta.
- ⚠️ **The secret is a password.** Never post it in WhatsApp, email or
  chat. Only paste it into Vercel.

---

## Part 2 · Make the app live (3 min)

**Why this part:** a new app starts in **Development** mode. In that
mode Meta does **not** send the instant "new lead" alert. Going **Live**
switches it on.

**Can I skip it?** Yes. Without it, leads still arrive, by the
**30-minute check** instead of within seconds.

### 2.1 Fill in the basics

- **Do:** stay on **App settings → Basic** and fill in:
  - **Privacy policy URL:** `https://wearekept.co.uk/legal/privacy`
  - **Category:** **Business and pages**
  - **App icon:** upload `meta-app-icon.png`
- **Do:** click **Save changes** (bottom of the page).
- **Why:** Meta will not let an app go live without these.

### 2.2 Publish

- **Do:** at the top of the dashboard, find the **App mode** switch
  (says **Development**). Switch it to **Live**. Or click **Publish** in
  the left menu if that is what you see.
- **You'll see:** the mode now says **Live**.
- **If Meta asks for business verification or app review:** stop here
  and go to Part 3. Everything still works with the 30-minute check.
  Send me a screenshot and I'll tell you if it's worth doing.

---

## Part 3 · Make the access token (7 min) → value 3

**Why this part:** the token is the key Kept uses to read leads. We make
it with a **system user**: a robot account inside your business. That
way the key **does not expire** and **does not break if anyone leaves**
or changes their Facebook password.

### 3.1 Open business settings

- **Do:** go to **business.facebook.com/settings**.
- **Do:** check the business name at the top left says **Kept**. If
  not, switch to it there.

### 3.2 Add a system user

- **Do:** left menu → **Users** → **System users**. Click **Add**.
- **Do:** name: **Kept Leads**. Role: **Admin**. Click **Create system
  user**.
- **Why:** Admin is needed to read leads from the Page.
- **If there is no Add button:** you are not an admin of this business.
  Ask whoever is to do Part 3, or to make you an admin.

### 3.3 Give it the Page

- **Do:** with **Kept Leads** selected, click **Assign assets**.
- **Do:** choose **Pages** → tick **Kept. Properties** → turn on **Full
  control** (or **Manage Page**). Click **Save changes**.
- **Why:** so the robot account can read that Page's leads. Nothing
  else.

### 3.4 Give it the app

- **Do:** click **Assign assets** again.
- **Do:** choose **Apps** → tick **Kept Leads** → turn on **Full
  control** (or **Manage app**). Click **Save changes**.
- **Why:** a token is always made "for" one app. This links the two.

### 3.5 Generate the token

- **Do:** click **Generate token** (or **Generate new token**).
- **Do:** App: **Kept Leads**.
- **Do:** Token expiration: **Never**.
- **Do:** tick the same 5 permissions as in step 1.6:
  `leads_retrieval`, `pages_show_list`, `pages_read_engagement`,
  `pages_manage_metadata`, `pages_manage_ads`.
- **Do:** click **Generate token**.
- **You'll see:** a long code starting with `EAA…`.
- **Do:** copy it into your note as **value 3**.
- ⚠️ **Meta shows it once only.** If you lose it, generate a new one.
  The old one keeps working until you revoke it.
- **If a permission is missing from the list:** go back to step 1.6 and
  add it to the app first.

### 3.6 Check leads access

- **Do:** left menu → **Integrations** → **Leads access**.
- **Do:** click **Kept. Properties**.
- **You'll see:** lists of people and apps with access.
- **If it says "everyone with access to the Page"** (the default):
  nothing to do.
- **If it lists named people or apps:** add **Kept Leads** under both
  **CRMs** (or Apps) and **People** (the system user).
- **Why:** this is Meta's privacy lock on leads. If it is set and we are
  not on it, the token gets an error.

---

## Part 4 · Paste into Vercel (3 min)

**Why this part:** Vercel is where Kept runs. The values live there,
encrypted, never in the code.

### 4.1 Open the project

- **Do:** go to **vercel.com**. Open the **bellwood-api** project.
- **Careful:** **bellwood-api**, not bellwood-app or bellwood-web.
- **Why:** the part that receives leads lives in **bellwood-api**.

### 4.2 Add the three values

- **Do:** **Settings** → **Environment Variables**.
- **Do:** for each row below, type the **Key**, paste the **Value**,
  tick **Production** only, turn on **Sensitive** if offered, and click
  **Save**.

| Key | Value |
|:---|:---|
| `META_APP_ID` | value 1 |
| `META_APP_SECRET` | value 2 |
| `META_PAGE_ACCESS_TOKEN` | value 3 |

- **Why Production only:** test copies of the site must never touch
  real leads.
- **Watch for:** no spaces before or after the value. Keys exactly as
  written, capitals included.

### 4.3 Delete your note

- **Do:** delete the note with the 3 values.
- **Why:** they now live safely in Vercel. A stray copy is a risk.

---

## Part 5 · Switch it on (1 min)

- **Do:** merge **PR #167** on GitHub.
- **You'll see:** Vercel deploys the new version in about 3 minutes.
- **Why:** a deploy is what loads the new values.
- **If the PR was merged before you added the values:** in Vercel open
  **Deployments**, click **⋯** on the top **Production** row, then
  **Redeploy**.

**Within 30 minutes** the code then:

1. connects itself to Meta (the instant alert);
2. pulls in leads from the **last 7 days** that are not in Quotes yet.

Leads Ben already copied in by hand may show up **twice, once**.
Delete the extra copy.

---

## Part 6 · Test it (5 min)

- **Do:** go to **developers.facebook.com/tools/lead-ads-testing**.
- **Do:** Page: **Kept. Properties**. Form: the live instant form.
  Click **Create lead**.
- **You'll see:** "Lead created".
- **Then:** open **Quotes** in the dashboard. The test lead should be
  there:
  - within **seconds** if Part 2 worked;
  - within **30 minutes** if not.
- **Also check:** a **"New Meta lead"** card in the Action Centre.
- **Do:** delete the test quote and dismiss the card.

---

## If something goes wrong

| What you see | What it means | What to do |
|:---|:---|:---|
| No lead after 30 minutes | Not connected yet | Check the 3 keys in Vercel (spelling, Production ticked), then redeploy |
| Card: **"Meta leads are not coming through"** | Meta refused the token | Read the Meta error in the card. Usually a missing permission (1.6 / 3.5) or Leads access (3.6). Make a new token, replace value 3, redeploy |
| Leads arrive, but only every 30 min | App not Live | Do Part 2 |
| Stuck on a Meta screen | Meta changed the layout | Send me a screenshot |

**Leads are never lost.** Meta keeps every lead in **Business Suite →
All tools → Leads Centre** for 90 days. Once fixed, the next check
pulls in the last 7 days by itself.

---

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

---

## How it works (for whoever maintains it)

- **Webhook** `/webhooks/meta-leads`: Meta posts the lead id the moment
  a form is sent. The post is signature-checked with the app secret.
  Meta only sends these to apps in **Live** mode.
- **Sweep** `/cron/meta-leads-sync`, every 30 min: reads every form for
  the last 7 days and saves anything missing. Works in Development mode.
- **Self-setup**: each sweep (production only) checks that the app's
  webhook points at `/webhooks/meta-leads` for `leadgen` and that the Page
  is subscribed to the app, and fixes either if not. The verify token is
  derived from the app secret.
- **Token**: the system-user token is swapped for the Page's own token in
  code (`resolvePageToken`).
- Page id defaults to the Kept Page (`KEPT_PAGE_ID`). Optional overrides:
  `META_PAGE_ID`, `META_WEBHOOK_VERIFY_TOKEN`, `META_GRAPH_VERSION`.
- App icon for the Meta app: `docs/assets/meta-app-icon.png`.

| What | Where |
|:---|:---|
| Parsing, Graph calls, self-setup, saving | `apps/api/app/cron/_lib/meta-leads.ts` |
| Webhook | `apps/api/app/webhooks/meta-leads/route.ts` |
| Sweep | `apps/api/app/cron/meta-leads-sync/route.ts` |
| Tests | `apps/api/__tests__/meta-leads.test.ts` |
