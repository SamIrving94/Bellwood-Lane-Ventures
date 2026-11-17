# Tracking events: what the site sends, for the ad manager

_Last verified against the live site: 2026-10-24_

Everything here fires **only after the visitor accepts cookies** in the
banner. Advertising tags (GTM, Google Ads, Meta) need the *advertising*
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
- **Google (GA4 / Ads, hard-coded):** a gtag event with that name.
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
