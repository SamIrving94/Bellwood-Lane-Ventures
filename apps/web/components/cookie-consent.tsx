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
 * changes, so everyone is asked again (v2 = advertising added).
 *
 * Withdrawing: <CookieSettingsButton /> (footer + privacy notice) re-opens
 * the banner. Turning a category off stops its tags at once and deletes the
 * cookies they set.
 *
 * Private URLs never reach Google or Meta. Several pages are reached by a
 * secret link (deal timeline token, offer id, investor token) and
 * /save-the-sale carries the vendor's address in its query string. On those
 * paths no tag is loaded, and if one already is, it is muted: GA/Ads via
 * gtag's `ga-disable-<id>` flag (checked before every hit), Meta via
 * fbq('consent','revoke'). Both are flipped inside a history.pushState/
 * replaceState wrapper — before the URL changes — so the tags' own
 * "page changed" hits, which fire after, are already muted. A React effect
 * would be too late. Add new token-bearing routes to PRIVATE_PATHS.
 *
 * Google Tag Manager is for EXTRA tags only (founder decision, Oct 2026):
 * GA, Google Ads and Meta stay here in code, so never add a GA4 tag for the
 * site's own measurement ID inside GTM (every visit would count twice).
 * GTM loads only after analytics or advertising consent and never on a
 * private page. It sees the same Consent Mode signals, plus two dataLayer
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
const CONSENT_KEY = 'kept-cookie-consent-v2';
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
  const sync = (url?: string | URL | null) =>
    syncFlags(
      url == null
        ? window.location.pathname
        : new URL(String(url), window.location.href).pathname
    );
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method];
    window.history[method] = function (
      this: History,
      data: unknown,
      unused: string,
      url?: string | URL | null
    ) {
      sync(url);
      return original.call(this, data, unused, url);
    };
  }
  window.addEventListener('popstate', () => sync());
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
  if (gtmId && (granted.analytics || granted.advertising)) {
    loadOnce('gtm', () => {
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
  if (analytics && advertising) {
    return 'We’d like to use cookies to see which pages help people, and to measure and show our adverts.';
  }
  if (advertising) {
    return 'We’d like to use cookies to measure and show our adverts.';
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
  const hasAdvertising = Boolean(props.adsId || props.metaPixelId);

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
    }
    setConsent(next);
    setOpen(false);
    setChoosing(false);
  };

  if (!open || isPrivatePath(pathname)) {
    return null;
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
                you our adverts again on their sites.
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
