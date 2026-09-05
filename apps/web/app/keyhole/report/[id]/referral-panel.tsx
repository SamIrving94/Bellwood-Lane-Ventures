'use client';

import { useState } from 'react';

/**
 * The one opt-in moment in Keyhole, framed per the 29 Aug pivot (PRD §0):
 * we offer a WRITTEN OFFER AS EVIDENCE for the estate's best-value
 * decision file — never "send us the property". Executors carry personal
 * liability for under-selling, so a nudge toward a cash sale is exactly
 * what this audience must reject; a dated, binding cash position they can
 * weigh against the open-market route is something the file wants
 * whichever way the estate decides. Copy holds the public promise exactly
 * (same-day response, we view every property, confirmed written offer
 * within two working days of viewing, binding upon Kept for a week,
 * completion in as little as two weeks), names the trade-off, and says who
 * we are wrong for. Print-hidden: the printed report stays a neutral
 * document for the client file.
 */

const PILL =
  'inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-full bg-leaf px-7 py-3 font-semibold text-[14.5px] text-white transition hover:bg-leaf-dark disabled:cursor-not-allowed disabled:opacity-60';
const INPUT =
  'w-full rounded-[2px] border border-[#D9D0BC] bg-white px-4 py-3 text-[15px] text-forest outline-none transition focus:border-leaf focus:shadow-[0_0_0_3px_rgba(46,125,91,0.15)]';

export function PrintButton() {
  return (
    <button
      className="cursor-pointer text-[13.5px] text-leaf underline underline-offset-[3px] transition-colors hover:text-leaf-dark"
      onClick={() => window.print()}
      type="button"
    >
      Print or save as PDF
    </button>
  );
}

export function ReferralPanel({
  reportId,
  alreadyReferred,
}: {
  reportId: string;
  alreadyReferred: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(alreadyReferred);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/keyhole/refer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId,
          note: note || undefined,
          contactEmail: contactEmail || undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setError('Something went wrong. Please try again.');
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-[2px] border border-hair bg-soft px-6 py-5 print:hidden">
      <p className="font-semibold text-[#8B9489] text-[11px] uppercase tracking-[0.18em] [font-family:var(--font-courier)]">
        Optional, and clearly ours
      </p>
      <h2 className="mt-2 font-semibold font-serif text-[20px] text-forest">
        A written offer, for the decision file
      </h2>
      <p className="mt-2 max-w-[62ch] text-[14px] text-body leading-[1.65]">
        Kept buys property directly, with cash. We respond the same day, we view
        every property, and a confirmed written offer follows within two working
        days of the viewing. The offer is binding upon Kept for a week, and
        completion can take as little as two weeks. We buy below market value:
        that is the trade for speed and certainty, and we say so up front.
      </p>
      <p className="mt-2 max-w-[62ch] text-[14px] text-body leading-[1.65]">
        You can request that offer purely as evidence: a dated cash position for
        the decision file, to weigh against the open-market route. If there is
        time to market the property properly, an estate agent will usually get a
        better price, and the file is stronger for showing both. If that&apos;s
        your client, we&apos;ll say so.
      </p>

      {done ? (
        <p className="mt-4 font-semibold text-[14.5px] text-forest">
          Sent. A person will reply the same day, to the contact you left.
        </p>
      ) : open ? (
        <div className="mt-4 max-w-[520px]">
          <label
            className="block font-semibold text-[13px] text-forest"
            htmlFor="kh-refer-note"
          >
            Anything we should know (optional)
          </label>
          <textarea
            className={`${INPUT} mt-1.5 min-h-[80px]`}
            id="kh-refer-note"
            onChange={(e) => setNote(e.target.value)}
            placeholder="Situation, timing, who to speak to"
            value={note}
          />
          <label
            className="mt-3 block font-semibold text-[13px] text-forest"
            htmlFor="kh-refer-email"
          >
            Your email, so we can reply
          </label>
          <input
            className={`${INPUT} mt-1.5`}
            id="kh-refer-email"
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="you@yourfirm.co.uk"
            type="email"
            value={contactEmail}
          />
          {error ? (
            <p className="mt-2 text-[#c33f35] text-[13px]" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-3 flex items-center gap-4">
            <button
              className={PILL}
              disabled={busy}
              onClick={send}
              type="button"
            >
              {busy ? 'Sending…' : 'Request a written offer'}
            </button>
            <button
              className="cursor-pointer text-[13.5px] text-body underline underline-offset-[3px]"
              onClick={() => setOpen(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          className={`${PILL} mt-4`}
          onClick={() => setOpen(true)}
          type="button"
        >
          Request a written offer
        </button>
      )}
      <p className="mt-3 text-[12px] text-stone-500 leading-[1.5]">
        Only sent when you choose to send it. Nothing happens to this report
        otherwise.
      </p>
    </section>
  );
}
