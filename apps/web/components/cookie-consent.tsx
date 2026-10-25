'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Cookie consent + the tags it gates, in one place.
 *
 * Two categories, asked separately because UK PECR requires consent per
 * purpose and a "no" must be as easy as a "yes":
 *   - analytics   → Google Analytics (GA4)
 *   - advertising → Google Ads tag + Meta Pixel (conversion measurement and
 *                   retargeting for the paid channels in docs/marketing/PLAN.md)
 *
 * Nothing loads before consent. Each script is injected only once its
 * category is granted — not loaded-then-disabled, and not Consent Mode
 * "advanced" with cookieless pings. Consent Mode signals are still sent
 * (Google requires them for UK ad traffic), but only alongside tags the
 * visitor has already allowed. Boxes are never pre-ticked.
 *
 * The choice lives in localStorage (not a cookie): remembering a refusal is
 * strictly necessary. Bump CONSENT_KEY's version whenever what we ask for
 * changes, so everyone is asked again (v2 = advertising added, v3 = hashed
 * contact details sent with a form, for ad matching).
 *
 * Withdrawing: <CookieSettingsButton /> (footer + privacy notice) re-opens
 * the banner. Turning a category off stops its tags at once and deletes the
 * cookies they set.
 *
 * Private URLs never reach Google or Meta. Several pages are reached by a
 * secret link (deal timeline token, offer id, investor token) and
 * /save-the-sale carries the vendor's address in its query string. On those
 * paths no tag is loaded in the page itself, and if one already is, it is
 * muted: GA/Ads via
 * gtag's `ga-disable-<id>` flag (checked before every hit), Meta via
 * fbq('consent','revoke'). Both are flipped inside a history.pushState/
 * replaceState wrapper — before the URL changes — so the tags' own
 * "page changed" hits, which fire after, are already muted. A React effect
 * would be too late. Add new token-bearing routes to PRIVATE_PATHS.
 *
 * The private pages that are part of a seller's journey still count for
 * audiences (founder decision, 24 Oct 2026: the ads need "reached the offer
 * letter" and the like, to build audiences and exclusions). They do it
 * through a stand-in: a hidden same-origin frame at /journey/<name> (see
 * JOURNEY_STAND_INS), which loads the tags the visitor allowed. The tags
 * then report /journey/offer-letter, never the link, and the frame's
 * referrer is cut to our origin so the link can't leak that way either.
 * Admin and partner surfaces (/investors, /portal) and Keyhole get no
 * stand-in.
 *
 * Events: every funnel step and every form sent goes to the tags too (see
 * sendTagEvent / sendLead below), as GTM dataLayer events, GA/Ads gtag
 * events and Meta custom events, so the ad manager can build conversions
 * from them. A form sent with advertising consent also sends hashed contact
 * details (Google enhanced conversions, Meta advanced matching). Never on a
 * private page, and never what the seller wrote about the property.
 *
 * Google Tag Manager is for EXTRA tags only (founder decision, Oct 2026):
 * GA and Google Ads stay here in code, so never add a GA4 tag for the
 * site's own measurement ID inside GTM (every visit would count twice).
 * GTM is run by our ad manager and carries the Meta Pixel, so it is an
 * ADVERTISING tag: it loads only after advertising consent (analytics alone
 * is not enough) and never on a private page. Live test, 22 Oct 2026: when
 * it loaded on analytics consent, its Meta tag fired for visitors who had
 * never been asked about advertising. Once loaded, GTM can't be muted in
 * place: its Meta tag calls fbq('consent','grant') itself on every fire,
 * undoing our revoke (tested 22 Oct 2026). So while GTM is loaded,
 * withdrawing advertising reloads the page, and a client-side move to a
 * private page becomes a full page load. Either way the next page starts
 * without GTM. Leave NEXT_PUBLIC_META_PIXEL_ID unset while Meta lives in
 * GTM, or every PageView counts twice.
 * GTM sees the same Consent Mode signals, plus two dataLayer
 * events: `kept_consent` (kept_analytics / kept_advertising = granted|denied)
 * and `kept_page_privacy` (kept_private_page = true|false, pushed before
 * every client-side URL change). A non-Google tag added in GTM must fire
 * only when its category is granted AND have kept_private_page = true as an
 * exception, and must be added to the privacy notice before it goes live.
 * GTM's <noscript> iframe is deliberately left out: a visitor without
 * JavaScript can never see the banner, so can never consent.
 *
 * With no tag IDs configured the layout does not render this component, so
 * there is no banner asking for consent to nothing.
 */
const CONSENT_KEY = 'kept-cookie-consent-v3';
const OPEN_EVENT = 'kept:open-cookie-settings';

export type ConsentTags = {
  gaId?: string;
  adsId?: string;
  metaPixelId?: string;
  gtmId?: string;
};

type Consent = { analytics: boolean; advertising: boolean };

/** Paths whose URL is itself private (a token, an id, or an address). */
const PRIVATE_PATHS = [
  '/track',
  '/viewing',
  '/investors',
  '/portal',
  '/instant-offer/offer',
  '/keyhole/report',
  '/save-the-sale',
];

export const isPrivatePath = (path: string) =>
  PRIVATE_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

/**
 * Private journey pages and the stand-in address their tags report instead.
 * The names are what the ad manager types into audience rules ("URL
 * contains /journey/offer-letter"), so don't rename one without telling them.
 */
export const JOURNEY_STAND_INS = {
  '/instant-offer/offer': 'offer-letter',
  '/track': 'deal-timeline',
  '/viewing': 'viewing-booking',
  '/save-the-sale': 'save-the-sale',
} as const;

export type JourneyStandIn =
  (typeof JOURNEY_STAND_INS)[keyof typeof JOURNEY_STAND_INS];

/** Paths that send PostHog no page view: private ones, and the stand-ins. */
export const noPostHogPageView = (path: string) =>
  isPrivatePath(path) || path.startsWith('/journey/');

export const journeyStandIn = (path: string): JourneyStandIn | null => {
  for (const [p, name] of Object.entries(JOURNEY_STAND_INS)) {
    if (path === p || path.startsWith(`${p}/`)) {
      return name;
    }
  }
  return null;
};

type TagWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: ((...args: unknown[]) => void) & Record<string, unknown>;
  _fbq?: unknown;
} & Record<string, unknown>;

const w = () => window as unknown as TagWindow;

// Module state, not React state: the history wrapper outlives renders.
let tags: ConsentTags = {};
let granted: Consent = { analytics: false, advertising: false };
let guardInstalled = false;
let gtmLoaded = false;
const configured = new Set<string>();

/** Mute every loaded tag that is not allowed on `path`. */
const syncFlags = (path: string) => {
  const isPrivate = isPrivatePath(path);
  if (tags.gaId) {
    w()[`ga-disable-${tags.gaId}`] = !granted.analytics || isPrivate;
  }
  if (tags.adsId) {
    w()[`ga-disable-${tags.adsId}`] = !granted.advertising || isPrivate;
  }
  w().fbq?.('consent', granted.advertising && !isPrivate ? 'grant' : 'revoke');
  // Tags inside GTM can't be muted by id, so every Google tag there gets
  // consent denied on a private page, and any other tag must use the
  // `kept_private_page` flag as an exception trigger (see GTM note above).
  pushConsent(isPrivate);
  w().dataLayer?.push({
    event: 'kept_page_privacy',
    kept_private_page: isPrivate,
  });
};

const installPrivacyGuard = () => {
  if (guardInstalled) {
    return;
  }
  guardInstalled = true;
  const target = (url?: string | URL | null) =>
    url == null
      ? new URL(window.location.href)
      : new URL(String(url), window.location.href);
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method];
    window.history[method] = function (
      this: History,
      data: unknown,
      unused: string,
      url?: string | URL | null
    ) {
      const next = target(url);
      // GTM can't be muted in place (see the GTM note above): load the
      // private page fresh, without it.
      if (gtmLoaded && isPrivatePath(next.pathname)) {
        window.location.assign(next.href);
        return;
      }
      syncFlags(next.pathname);
      return original.call(this, data, unused, url);
    };
  }
  window.addEventListener('popstate', () => {
    if (gtmLoaded && isPrivatePath(window.location.pathname)) {
      window.location.reload();
      return;
    }
    syncFlags(window.location.pathname);
  });
};

const injectScript = (src: string) => {
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
};

/**
 * The standard gtag stub, with every Consent Mode signal defaulted to denied.
 * GA, Ads and GTM all share this one dataLayer, so it must exist (with the
 * denied defaults queued first) before any of their scripts load.
 */
const ensureGtagStub = () => {
  const win = w();
  if (win.gtag) {
    return;
  }
  win.dataLayer = win.dataLayer ?? [];
  win.gtag = function gtag() {
    // gtag.js only accepts the `arguments` object itself, not an array.
    // biome-ignore lint/style/noArguments: required by gtag.js
    win.dataLayer?.push(arguments);
  };
  win.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  win.gtag('js', new Date());
};

/** Current choices as Consent Mode signals; everything denied on a private page. */
const pushConsent = (isPrivate: boolean) => {
  const a = granted.analytics && !isPrivate ? 'granted' : 'denied';
  const ad = granted.advertising && !isPrivate ? 'granted' : 'denied';
  w().gtag?.('consent', 'update', {
    analytics_storage: a,
    ad_storage: ad,
    ad_user_data: ad,
    ad_personalization: ad,
  });
};

const loaded = new Set<string>();

const loadOnce = (key: string, load: () => void) => {
  if (!loaded.has(key)) {
    loaded.add(key);
    load();
  }
};

/** The standard Meta Pixel stub. */
const ensureFbq = (pixelId: string) => {
  const win = w();
  if (win.fbq) {
    return;
  }
  // Meta's own snippet, typed: fbevents.js replays `queue` via callMethod.
  type Fbq = NonNullable<TagWindow['fbq']> & {
    callMethod?: (...a: unknown[]) => void;
    queue: unknown[];
  };
  const fbq = function stub() {
    // biome-ignore lint/style/noArguments: fbevents.js expects arguments objects
    const args = arguments;
    if (fbq.callMethod) {
      fbq.callMethod(...args);
    } else {
      fbq.queue.push(args);
    }
  } as unknown as Fbq;
  Object.assign(fbq, { push: fbq, loaded: true, version: '2.0', queue: [] });
  win.fbq = fbq;
  win._fbq = fbq;
  // No automatic button/metadata scraping: we only send what we choose to.
  fbq('set', 'autoConfig', false, pixelId);
  fbq('init', pixelId);
  fbq('track', 'PageView');
  injectScript('https://connect.facebook.net/en_US/fbevents.js');
};

/** Inject the scripts the visitor has allowed (never on a private page). */
const loadAllowedTags = () => {
  const { gaId, adsId, metaPixelId, gtmId } = tags;
  const loaderId =
    (granted.analytics ? gaId : undefined) ??
    (granted.advertising ? adsId : undefined);
  if (loaderId) {
    loadOnce('gtag', () =>
      injectScript(`https://www.googletagmanager.com/gtag/js?id=${loaderId}`)
    );
  }
  if (gtmId && granted.advertising) {
    loadOnce('gtm', () => {
      gtmLoaded = true;
      w().dataLayer?.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      injectScript(`https://www.googletagmanager.com/gtm.js?id=${gtmId}`);
    });
  }
  if (granted.advertising && metaPixelId) {
    ensureFbq(metaPixelId);
  }
};

/** First page view per allowed tag — sent after the consent update. */
const configureAllowedTags = () => {
  const ids = [
    granted.analytics ? tags.gaId : undefined,
    granted.advertising ? tags.adsId : undefined,
  ];
  for (const id of ids) {
    if (id && !configured.has(id)) {
      configured.add(id);
      w().gtag?.('config', id);
    }
  }
};

type TagParams = Record<string, string | number | boolean | undefined>;

/** True when the tags may hear about something on the current page. */
const canSend = () =>
  typeof window !== 'undefined' &&
  (granted.analytics || granted.advertising) &&
  !isPrivatePath(window.location.pathname);

/**
 * A funnel event, sent to every tag the visitor allowed: a dataLayer event
 * for GTM triggers, a gtag event for GA (and Ads, which ignores names it
 * doesn't know), and a Meta custom event. Callers pass only what PostHog
 * gets: no name, contact detail or street address.
 */
export const sendTagEvent = (name: string, params: TagParams = {}) => {
  if (!canSend()) {
    return;
  }
  w().dataLayer?.push({ event: name, ...params });
  w().gtag?.('event', name, params);
  if (granted.advertising) {
    // Defined by the Meta tag in GTM (or our own stub) once it has loaded.
    w().fbq?.('trackCustom', name, params);
  }
};

export type LeadContact = {
  name?: string;
  email?: string;
  phone?: string;
  postcode?: string;
};

const sha256 = async (value: string) => {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');
};

/** A UK number as E.164 ("+447700900123"), or null if it isn't one. */
export const toE164 = (phone: string): string | null => {
  const digits = phone.replace(/\D/g, '');
  let national: string;
  if (digits.startsWith('44')) {
    national = digits.slice(2);
  } else if (digits.startsWith('0')) {
    national = digits.slice(1);
  } else {
    return null;
  }
  national = national.replace(/^0/, '');
  return national.length >= 9 && national.length <= 10
    ? `+44${national}`
    : null;
};

/**
 * Contact details normalised the way Google and Meta ask, then hashed here
 * so no plain email or phone ever sits in the dataLayer, where every GTM
 * tag could read it. Only the postcode goes unhashed, to Google only:
 * its address match requires it in the clear.
 */
export const hashContact = async ({
  name,
  email,
  phone,
  postcode,
}: LeadContact) => {
  const words = (name ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\s'-]/gu, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const first = words[0];
  const last = words.length > 1 ? words.at(-1) : undefined;
  const mail = email?.trim().toLowerCase() || undefined;
  const e164 = phone ? toE164(phone) : null;
  const [em, ph, fn, ln] = await Promise.all([
    mail ? sha256(mail) : undefined,
    e164 ? sha256(e164) : undefined,
    first ? sha256(first) : undefined,
    last ? sha256(last) : undefined,
  ]);
  const postal = postcode?.trim().toUpperCase() || undefined;
  return {
    google: {
      sha256_email_address: em,
      sha256_phone_number: ph,
      // Google matches on an address only with all four parts.
      ...(fn && ln && postal
        ? {
            address: {
              sha256_first_name: fn,
              sha256_last_name: ln,
              postal_code: postal,
              country: 'GB',
            },
          }
        : {}),
    },
    // Meta wants the phone as digits without the "+".
    meta: {
      em,
      ph: e164 ? await sha256(e164.slice(1)) : undefined,
      fn,
      ln,
      country: await sha256('gb'),
    },
  };
};

/** Meta pixel ids on the page: ours, or those GTM's Meta tag set up. */
const metaPixelIds = (): string[] => {
  if (tags.metaPixelId) {
    return [tags.metaPixelId];
  }
  const state = (
    w().fbq?.getState as (() => { pixels?: Array<{ id?: string }> }) | undefined
  )?.();
  return (state?.pixels ?? []).flatMap((p) => (p.id ? [p.id] : []));
};

/**
 * A form was sent: the lead conversion. Everyone allowed gets the event
 * (`generate_lead` is GA4's own name for it; Meta gets its standard Lead).
 * With advertising consent the contact details go too, hashed (see
 * hashContact): Google reads them as enhanced-conversion user data, GTM
 * tags as `user_data` on the event, and Meta as advanced matching on every
 * event from here on.
 */
export const sendLead = async (form: string, contact: LeadContact) => {
  if (!canSend()) {
    return;
  }
  const params = { form };
  if (granted.advertising) {
    try {
      const hashed = await hashContact(contact);
      w().gtag?.('set', 'user_data', hashed.google);
      w().dataLayer?.push({
        event: 'generate_lead',
        ...params,
        user_data: hashed.google,
        meta_user_data: hashed.meta,
      });
      for (const id of metaPixelIds()) {
        // Calling init again on a loaded pixel attaches the matching data
        // to the events that follow it.
        w().fbq?.('init', id, hashed.meta);
      }
    } catch {
      // No WebCrypto (very old browser): the lead still counts, unmatched.
      w().dataLayer?.push({ event: 'generate_lead', ...params });
    }
    w().fbq?.('track', 'Lead', params);
  } else {
    w().dataLayer?.push({ event: 'generate_lead', ...params });
  }
  w().gtag?.('event', 'generate_lead', params);
};

/**
 * Load (or mute) every tag to match `granted` on the current page. Order
 * matters: the stub (denied defaults) → the visitor's real choices → only
 * then the scripts, so nothing, GTM's first tags included, ever runs on a
 * stale consent state.
 */
const applyConsent = (path: string) => {
  const isPrivate = isPrivatePath(path);
  if (granted.analytics || granted.advertising) {
    ensureGtagStub();
  }
  syncFlags(path);
  w().dataLayer?.push({
    event: 'kept_consent',
    kept_analytics: granted.analytics ? 'granted' : 'denied',
    kept_advertising: granted.advertising ? 'granted' : 'denied',
  });
  if (!isPrivate) {
    loadAllowedTags();
    configureAllowedTags();
  }
};

/** Banner lead-in, naming only the purposes that are actually configured. */
const purposeLine = (analytics: boolean, advertising: boolean) => {
  // The advertising line names the hashed contact details up front: they go
  // further than a cookie, so "Accept all" must not hide them behind Choose.
  const matching =
    ' If you send us a form, the advertising tools also get a scrambled copy of your contact details.';
  if (analytics && advertising) {
    return `We’d like to use cookies to see which pages help people, and to measure and show our adverts.${matching}`;
  }
  if (advertising) {
    return `We’d like to use cookies to measure and show our adverts.${matching}`;
  }
  return 'We’d like to use cookies to see which pages help people.';
};

const readConsent = (): Consent | null => {
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) {
      return null;
    }
    const v = JSON.parse(raw) as Partial<Consent>;
    return {
      analytics: v.analytics === true,
      advertising: v.advertising === true,
    };
  } catch {
    return null;
  }
};

const saveConsent = (c: Consent) => {
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(c));
  } catch {
    // Private mode / blocked storage: the choice holds for this page view.
  }
};

/** Delete first-party cookies whose names match, on every parent domain. */
const clearCookies = (match: RegExp) => {
  // Tags pick the highest domain they can (e.g. .bellwoodslane.co.uk), so
  // try every suffix of the host; browsers simply ignore '.uk', '.co.uk'.
  const parts = window.location.hostname.split('.');
  const domains = ['', ...parts.map((_, i) => `.${parts.slice(i).join('.')}`)];
  for (const raw of document.cookie.split(';')) {
    const name = raw.split('=')[0]?.trim();
    if (!(name && match.test(name))) {
      continue;
    }
    for (const d of domains) {
      // biome-ignore lint/nursery/noDocumentCookie: Cookie Store API is not in Safari or Firefox.
      document.cookie = `${name}=; Max-Age=0; path=/${d ? `; domain=${d}` : ''}`;
    }
  }
};

const ANALYTICS_COOKIES = /^_ga/;
const ADVERTISING_COOKIES = /^(_gcl_|_fbp$|_fbc$)/;

export function CookieConsent(props: ConsentTags) {
  const pathname = usePathname() ?? '/';
  const hasAnalytics = Boolean(props.gaId);
  // GTM counts as advertising (it carries the Meta Pixel), so a deploy with
  // only GA + GTM still asks the advertising question.
  const hasAdvertising = Boolean(
    props.adsId || props.metaPixelId || props.gtmId
  );

  // null until mounted: the server cannot know the choice, so render nothing
  // rather than flash the banner at someone who already answered.
  const [consent, setConsent] = useState<Consent | null>(null);
  const [open, setOpen] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [draft, setDraft] = useState<Consent>({
    analytics: false,
    advertising: false,
  });

  useEffect(() => {
    tags = {
      gaId: props.gaId,
      adsId: props.adsId,
      metaPixelId: props.metaPixelId,
      gtmId: props.gtmId,
    };
    const saved = readConsent();
    if (saved) {
      granted = saved;
      // Sweep up after a withdrawal: GTM's tags can re-set their cookies in
      // the moment between our delete and the reload.
      if (!saved.advertising) {
        clearCookies(ADVERTISING_COOKIES);
      }
      if (saved.analytics || saved.advertising) {
        installPrivacyGuard();
      }
    }
    setConsent(saved);
    setOpen(saved === null);

    const reopen = () => {
      setDraft(granted);
      setChoosing(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, [props.gaId, props.adsId, props.metaPixelId, props.gtmId]);

  // Also re-runs on navigation: a visitor who arrived on a private page gets
  // the tags once they move to a public one.
  useEffect(() => {
    if (consent && (consent.analytics || consent.advertising)) {
      applyConsent(pathname);
    }
  }, [consent, pathname]);

  const decide = (next: Consent) => {
    const was = granted;
    granted = next;
    saveConsent(next);
    if (next.analytics || next.advertising) {
      installPrivacyGuard();
    }
    applyConsent(window.location.pathname);
    if (was.analytics && !next.analytics) {
      clearCookies(ANALYTICS_COOKIES);
    }
    if (was.advertising && !next.advertising) {
      clearCookies(ADVERTISING_COOKIES);
      // GTM can't be unloaded or muted in place: start the page again
      // without it.
      if (gtmLoaded) {
        window.location.reload();
        return;
      }
    }
    setConsent(next);
    setOpen(false);
    setChoosing(false);
  };

  // On a private journey page the tags run in a stand-in frame instead (see
  // the note at the top). Keyed on the choice, so a change reloads the
  // frame: its own copy of this component reads the new choice and starts
  // without whatever was withdrawn.
  const standIn = journeyStandIn(pathname);
  const standInFrame =
    standIn && consent && (consent.analytics || consent.advertising) ? (
      <iframe
        key={`${standIn}-${consent.analytics}-${consent.advertising}`}
        src={`/journey/${standIn}`}
        title="Measurement"
        hidden
        aria-hidden
        tabIndex={-1}
        referrerPolicy="origin"
      />
    ) : null;

  if (!open || isPrivatePath(pathname)) {
    return standInFrame;
  }

  const primary =
    'rounded-full bg-leaf px-5 py-2.5 font-semibold text-[14px] text-white transition hover:bg-leaf-dark';
  const secondary =
    'rounded-full border border-stone-300 px-5 py-2.5 font-semibold text-[14px] text-forest transition hover:border-stone-500';

  return (
    <section
      aria-label="Cookie choice"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-h-[85vh] max-w-xl overflow-y-auto rounded-2xl border border-hair bg-cream p-5 shadow-lg md:inset-x-auto md:right-6 md:bottom-6"
    >
      <p className="font-serif text-[17px] text-forest leading-snug">
        Cookies: your choice
      </p>
      <p className="mt-2 text-[14px] text-stone-600 leading-relaxed">
        {purposeLine(hasAnalytics, hasAdvertising)} They stay off unless you say
        yes, and you can change your mind any time.{' '}
        <Link href="/legal/privacy#cookies" className="text-leaf underline">
          Privacy notice
        </Link>
      </p>

      {choosing && (
        <fieldset className="mt-4 space-y-3">
          <legend className="sr-only">Choose which cookies to allow</legend>
          {hasAnalytics && (
            <label className="flex gap-3 text-[14px] text-stone-700 leading-snug">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-leaf"
                checked={draft.analytics}
                onChange={(e) =>
                  setDraft({ ...draft, analytics: e.target.checked })
                }
              />
              <span>
                <strong className="text-forest">Analytics.</strong> Google
                Analytics counts visits so we can see which pages are useful.
              </span>
            </label>
          )}
          {hasAdvertising && (
            <label className="flex gap-3 text-[14px] text-stone-700 leading-snug">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-leaf"
                checked={draft.advertising}
                onChange={(e) =>
                  setDraft({ ...draft, advertising: e.target.checked })
                }
              />
              <span>
                <strong className="text-forest">Advertising.</strong> Google and
                Meta learn which of our adverts brought you here, and may show
                you our adverts again on their sites. If you send us a form,
                they also get a scrambled copy of your email, phone and name, to
                match your visit to an account they hold.
              </span>
            </label>
          )}
        </fieldset>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        {choosing ? (
          <button
            type="button"
            onClick={() => decide(draft)}
            className={primary}
          >
            Save my choice
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              decide({ analytics: hasAnalytics, advertising: hasAdvertising })
            }
            className={primary}
          >
            Accept all
          </button>
        )}
        <button
          type="button"
          onClick={() => decide({ analytics: false, advertising: false })}
          className={secondary}
        >
          Reject all
        </button>
        {!choosing && (
          <button
            type="button"
            onClick={() => {
              setDraft({ analytics: false, advertising: false });
              setChoosing(true);
            }}
            className="px-2 py-2.5 font-semibold text-[14px] text-leaf underline"
          >
            Choose
          </button>
        )}
      </div>
    </section>
  );
}

/** Re-opens the banner so a visitor can change their answer at any time. */
export function CookieSettingsButton({
  label = 'Change your cookie choice',
  className = 'text-leaf underline',
}: {
  readonly label?: string;
  readonly className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      className={className}
    >
      {label}
    </button>
  );
}
