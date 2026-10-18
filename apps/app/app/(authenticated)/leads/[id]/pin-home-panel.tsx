'use client';

import {
  type PinCandidate,
  getPinCandidates,
  pinLeadHome,
} from '@/app/actions/leads/pin-home';
import { useMemo, useState, useTransition } from 'react';

/**
 * "Which home is this?" for a shortlisted lead whose listing never gave a
 * house number. Loads the postcode's homes on request (it costs PropertyData
 * credits, so never on page view), lets the founder find the right one with
 * the listing open in another tab, and pins it after a confirm.
 */
export function PinHomePanel({
  leadId,
  postcode,
  listingUrl,
  facts,
}: {
  leadId: string;
  postcode: string;
  listingUrl: string | null;
  /** What the listing says, to help pick: "3 bed · Flat · £450,000". */
  facts: string | null;
}) {
  const [homes, setHomes] = useState<PinCandidate[] | null>(null);
  const [suggested, setSuggested] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<PinCandidate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = homes ?? [];
    const filtered = q
      ? list.filter((h) => h.address.toLowerCase().includes(q))
      : list;
    // The listing's own resolution, when there is one, goes first.
    return suggested
      ? [
          ...filtered.filter((h) => h.uprn === suggested),
          ...filtered.filter((h) => h.uprn !== suggested),
        ]
      : filtered;
  }, [homes, query, suggested]);

  function load() {
    setError(null);
    startTransition(async () => {
      const r = await getPinCandidates(leadId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setHomes(r.homes);
      setSuggested(r.suggestedUprn);
    });
  }

  function pin(home: PinCandidate) {
    setError(null);
    startTransition(async () => {
      const r = await pinLeadHome(leadId, home.uprn);
      if (!r.ok) {
        setError(r.error);
        setChosen(null);
        return;
      }
      setPinned(home.address);
      window.location.reload();
    });
  }

  if (pinned) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 text-sm dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
        📍 Pinned: <strong>{pinned}</strong>. Refreshing…
      </div>
    );
  }

  return (
    <section
      aria-labelledby="pin-home-title"
      className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900 dark:bg-amber-950/40"
    >
      <h2 id="pin-home-title" className="font-semibold text-base">
        📍 Which home is this?
      </h2>
      <p className="mt-1 max-w-prose text-muted-foreground text-sm">
        The listing doesn't give a house number, so we can't link it to the
        right records. Open the listing, then pick the home from {postcode}'s
        list.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {facts && (
          <span className="rounded-full border bg-background px-2.5 py-0.5">
            {facts}
          </span>
        )}
        {listingUrl && (
          <a
            href={listingUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline underline-offset-2"
          >
            Open the listing ↗
          </a>
        )}
      </div>

      {homes === null ? (
        <button
          type="button"
          onClick={load}
          disabled={pending}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 font-medium text-sm text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? 'Loading homes…' : `Show the homes in ${postcode}`}
        </button>
      ) : (
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">
              Find it ({homes.length} homes in {postcode})
            </span>
            <input
              id="pin-home-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="House number, flat or building name"
              className="rounded-lg border bg-background px-3 py-2"
            />
          </label>

          {homes.length === 0 ? (
            <p className="text-sm">
              No homes are listed for {postcode}. Find the address from the
              listing or the agent instead.
            </p>
          ) : (
            <ul className="grid max-h-80 gap-1.5 overflow-y-auto pr-1">
              {shown.map((h) => (
                <li key={h.uprn}>
                  <button
                    type="button"
                    onClick={() => setChosen(h)}
                    aria-pressed={chosen?.uprn === h.uprn}
                    className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                      chosen?.uprn === h.uprn
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'bg-background hover:border-slate-400'
                    }`}
                  >
                    <span className="min-w-0">
                      {h.address}
                      {h.uprn === suggested && (
                        <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800 text-xs dark:bg-emerald-900 dark:text-emerald-100">
                          Listing points here
                        </span>
                      )}
                    </span>
                    {h.onEpc && (
                      <span className="text-xs opacity-70">
                        on EPC register
                      </span>
                    )}
                  </button>
                </li>
              ))}
              {shown.length === 0 && (
                <li className="text-muted-foreground text-sm">
                  No home matches "{query}".
                </li>
              )}
            </ul>
          )}

          {chosen && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-background p-3 text-sm">
              <span>
                Pin <strong>{chosen.address}</strong> as this lead's home?
              </span>
              <button
                type="button"
                onClick={() => pin(chosen)}
                disabled={pending}
                className="rounded-lg bg-emerald-700 px-3 py-1.5 font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                {pending ? 'Pinning…' : 'Yes, pin it'}
              </button>
              <button
                type="button"
                onClick={() => setChosen(null)}
                disabled={pending}
                className="rounded-lg border px-3 py-1.5"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
      {error && (
        <p className="mt-3 text-rose-700 text-sm dark:text-rose-400">{error}</p>
      )}
    </section>
  );
}
