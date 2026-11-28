# Tracking events: what the site sends, for the ad manager

_Last verified against the live site: 2026-11-26 (the ad tags). "Our own
record" was added 2026-11-27._

There are two records. They answer different questions.

| | Who it counts | Where you read it |
|:---|:---|:---|
| **Our own record** (below) | **Every** enquiry sent from the site | Dashboard → Quotes → "Where enquiries came from" |
| **The ad tags** (rest of this page) | Only visitors who **accept advertising cookies** | Google Ads, Meta Ads Manager |

Use our own record to decide what is working. Use the ad tags so Google and
Meta can learn who to show adverts to.

## Our own record: where each enquiry came from

When someone sends a form, the site saves what brought them: the platform,
the campaign and advert if the link names them, the first page they opened,
and the site that sent them. It is saved with the enquiry, in our database.
Nothing goes to Google or Meta, and no cookie is used, so it does not depend
on the banner. Code: `packages/analytics/lead-source.ts`.

**It works with nothing changed in the ad accounts:**

- **Google** adds `gclid` and `gad_campaignid` to every ad click on its own
  (auto-tagging, on by default). We get "Google Ads" and the campaign number.
- **Meta** adds `fbclid`. We get "Facebook / Instagram". Meta puts it on
  clicks from posts too, so on its own it cannot say advert or post.

**To name the campaign and the advert, tag the ad's link.** This is one
field on the ad. The advert itself does not change.

- **Meta** (Ads Manager → the ad → Tracking → *URL parameters*):

  ```
  utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}
  ```

- **Google Ads** (campaign → Settings → *Campaign URL options* → Final URL
  suffix). Type the campaign's name where shown:

  ```
  utm_source=google&utm_medium=cpc&utm_campaign=NAME-OF-CAMPAIGN&utm_term={keyword}
  ```

What it cannot see:

- **Meta Instant Forms.** They are filled in on Facebook and never touch the
  site. Those leads are in Meta's Leads Centre, not in the dashboard.
- **A visit that reloads the page** before sending the form. The source is
  held in memory, not stored, so a reload forgets it. The enquiry is saved as
  "Not known", never guessed.

## The ad tags

Everything from here down fires **only after the visitor accepts cookies** in
the banner. Advertising tags (GTM, Google Ads, Meta) need the *advertising*
box; Google Analytics needs the *analytics* box. The code lives in
`apps/web/components/cookie-consent.tsx`.

## Pages

Every public page fires a page view: home, `/sell`, the situation landing
pages (`/probate`, `/chain-break`, `/relocation`, `/separation`,
`/problem-property`, `/your-situation`), guides, about, legal.

Private pages carry a secret link or an address in the URL, so they never
send their own URL. They fire a page view from a hidden stand-in instead.
Use these in audience rules ("URL contains …"):

| Private page | Stand-in URL the tags see |
|:---|:---|
| Offer letter (`/instant-offer/offer/…`) | `/journey/offer-letter` |
| Deal timeline (`/track/…`) | `/journey/deal-timeline` |
| Viewing booking (`/viewing/…`) | `/journey/viewing-booking` |
| Save the sale (agent side, hidden for now) | `/journey/save-the-sale` |

Out of scope on purpose: `/investors`, `/portal`, `/keyhole` (no tags).

## Events

Each event goes three ways at once:

- **GTM:** a dataLayer event with that name (use a *Custom Event* trigger).
  This is how Google Ads gets its conversions today: the Google Ads tags
  live in the GTM container, not in the site's code.
- **Google Analytics (hard-coded):** a gtag event with that name. So does
  Google Ads, but only if `NEXT_PUBLIC_GOOGLE_ADS_ID` is ever set. It is not.
- **Meta:** sent straight to the pixel as a custom event
  (`fbq('trackCustom', …)`). **Don't add GTM tags for these too**, or
  Meta counts each one twice.

| Event | When | Useful parameters |
|:---|:---|:---|
| `sell_form_started` | `/sell` form: address accepted | `step` |
| `sell_form_step` | `/sell` form: each later step | `step` |
| `sell_form_submitted` | `/sell` form sent | `situation`, `property_type`, `outward_code` … |
| `sell_form_failed` | `/sell` form send failed | `status` |
| `situation_form_started` | Landing-page form: address accepted | `situation`, `step` |
| `situation_form_step` | Landing-page form: each later step | `situation`, `step` |
| `situation_form_submitted` | Landing-page form sent | `situation`, `source` … |
| `situation_form_failed` | Landing-page form send failed | `status` |
| `instant_offer_*` | The older chat form (not linked from the site today) | `step` |
| **`generate_lead`** | **Any form sent successfully. This is the conversion.** | `form` (which form) |

On `generate_lead` Meta also gets its standard **`Lead`** event. Again,
the code sends it: don't add a GTM Meta Lead tag.

Parameters never include a name, email, phone or street address. The
`outward_code` is the district only (e.g. `SW16`).

## Matching (enhanced conversions / advanced matching)

When a form is sent with advertising consent:

- **Google:** `gtag('set', 'user_data', …)` with hashed email, phone,
  name, plus postcode and country. The same object is on the
  `generate_lead` dataLayer event as `user_data`. In GTM, for the Google
  Ads conversion tag: *Include user-provided data* → new *User-Provided
  Data* variable → *Code* → a Data Layer Variable named `user_data`.
- **Meta:** the code re-initialises the pixel with hashed `em`, `ph`,
  `fn`, `ln`, `country` before sending `Lead`, so Lead and every later
  event carry it. The same data is on the dataLayer as `meta_user_data`
  if the GTM Meta tag needs it.

Everything is SHA-256 hashed in the browser before it reaches the
dataLayer. Only the postcode is in the clear (Google's address match
needs it), and only on the Google object.

## Account settings to switch on

- Google Ads → Goals → Settings → **Enhanced conversions: on** (Google tag
  or GTM method).
- Meta Events Manager → Settings → **Automatic advanced matching: on** is
  now allowed by the privacy notice (v1.5), as a backup to the code.
- Meta **automatic events** (button clicks) can stay on while you build
  custom conversions.

If you add a new kind of tool to GTM, it must go in the privacy notice
(`apps/web/app/legal/privacy/page.tsx`) before it goes live.
