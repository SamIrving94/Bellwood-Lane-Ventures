'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { useEffect, useState } from 'react';

/**
 * Cookie consent + Google Analytics, in one place.
 *
 * GA sets non-essential cookies, and UK PECR says those need consent BEFORE
 * they are set. So the gtag script is not rendered at all until a visitor
 * presses "Accept" — not loaded-then-disabled, not Consent Mode with pings
 * firing in the background. No choice, or "No thanks", means Google never
 * hears from this page.
 *
 * The choice itself lives in localStorage (not a cookie): remembering a
 * refusal is strictly necessary, and it keeps the notice honest about
 * "one functional cookie". Bump CONSENT_KEY's version if what we ask for
 * changes, so everyone is asked again.
 *
 * Withdrawing must be as easy as giving: the privacy notice renders
 * <CookieSettingsButton />, which re-opens this banner. Choosing "No thanks"
 * after accepting deletes the _ga cookies GA already set.
 *
 * Private URLs never reach Google. Several pages are reached by a secret
 * link (a deal timeline token, an offer id, an investor token) and
 * /save-the-sale carries the vendor's address in its query string. GA logs
 * every page URL, so on those paths we set GA's own `ga-disable-<id>` flag,
 * which it checks before every hit. The flag is flipped inside a
 * history.pushState/replaceState wrapper — i.e. before the URL changes — so
 * GA's automatic "page changed" event, which fires after, is already muted.
 * Setting it in a React effect would be too late. Add new token-bearing
 * routes to PRIVATE_PATHS.
 *
 * With no NEXT_PUBLIC_GA_MEASUREMENT_ID the layout does not render this
 * component, so there is no banner asking for consent to nothing.
 */
const CONSENT_KEY = 'kept-cookie-consent-v1';
const OPEN_EVENT = 'kept:open-cookie-settings';

type Choice = 'granted' | 'denied';

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

const flags = () => window as unknown as Record<string, boolean>;

// Module state, not React state: the history wrapper outlives renders.
let optedOut = false;
let guardInstalled = false;

const installPrivacyGuard = (gaId: string) => {
  if (guardInstalled) {
    return;
  }
  guardInstalled = true;
  const sync = (url?: string | URL | null) => {
    const path =
      url == null
        ? window.location.pathname
        : new URL(String(url), window.location.href).pathname;
    flags()[`ga-disable-${gaId}`] = optedOut || isPrivatePath(path);
  };
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
  sync();
};

const readChoice = (): Choice | null => {
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
};

const saveChoice = (choice: Choice) => {
  try {
    window.localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    // Private mode / blocked storage: the choice holds for this page view.
  }
};

/** GA's cookies are `_ga` and `_ga_<stream>`, set on the top-level domain. */
const clearGaCookies = () => {
  // GA picks the highest domain it can (e.g. .bellwoodslane.co.uk), so try
  // every suffix of the host; browsers simply ignore '.uk' and '.co.uk'.
  const parts = window.location.hostname.split('.');
  const domains = ['', ...parts.map((_, i) => `.${parts.slice(i).join('.')}`)];
  for (const raw of document.cookie.split(';')) {
    const name = raw.split('=')[0]?.trim();
    if (!name?.startsWith('_ga')) {
      continue;
    }
    for (const d of domains) {
      // biome-ignore lint/nursery/noDocumentCookie: Cookie Store API is not in Safari or Firefox.
      document.cookie = `${name}=; Max-Age=0; path=/${d ? `; domain=${d}` : ''}`;
    }
  }
};

export function CookieConsent({ gaId }: { readonly gaId: string }) {
  const pathname = usePathname();
  // null until mounted: the server cannot know the choice, so render nothing
  // rather than flash the banner at someone who already answered.
  const [choice, setChoice] = useState<Choice | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = readChoice();
    if (saved === 'granted') {
      installPrivacyGuard(gaId);
    }
    setChoice(saved);
    setOpen(saved === null);

    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, [gaId]);

  const decide = (next: Choice) => {
    saveChoice(next);
    optedOut = next === 'denied';
    if (next === 'granted') {
      installPrivacyGuard(gaId);
      flags()[`ga-disable-${gaId}`] = isPrivatePath(window.location.pathname);
    } else if (choice === 'granted') {
      // Stop the already-loaded script sending anything more, then remove
      // what it stored. The script tag itself goes on the next page load.
      flags()[`ga-disable-${gaId}`] = true;
      clearGaCookies();
    }
    setChoice(next);
    setOpen(false);
  };

  return (
    <>
      {/* Never even load it on a private page; the guard covers later moves. */}
      {choice === 'granted' && !isPrivatePath(pathname ?? '/') && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`}
          </Script>
        </>
      )}

      {open && !isPrivatePath(pathname ?? '/') && (
        <section
          aria-label="Cookie choice"
          className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-xl rounded-2xl border border-hair bg-cream p-5 shadow-lg md:inset-x-auto md:right-6 md:bottom-6"
        >
          <p className="font-serif text-[17px] text-forest leading-snug">
            Can we count your visit?
          </p>
          <p className="mt-2 text-[14px] text-stone-600 leading-relaxed">
            We&rsquo;d like to use Google Analytics to see which pages help
            people and which don&rsquo;t. It sets cookies, so we only switch it
            on if you say yes. No advertising, and it never sees what you type
            into our forms.{' '}
            <Link href="/legal/privacy#cookies" className="text-leaf underline">
              Privacy notice
            </Link>
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => decide('granted')}
              className="rounded-full bg-leaf px-5 py-2.5 font-semibold text-[14px] text-white transition hover:bg-leaf-dark"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => decide('denied')}
              className="rounded-full border border-stone-300 px-5 py-2.5 font-semibold text-[14px] text-forest transition hover:border-stone-500"
            >
              No thanks
            </button>
          </div>
        </section>
      )}
    </>
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
