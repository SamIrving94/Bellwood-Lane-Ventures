'use client';

import { useState } from 'react';

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error' };

export function EmailSampleButton() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const close = () => {
    setOpen(false);
    setTimeout(() => setStatus({ kind: 'idle' }), 200);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus({ kind: 'submitting' });

    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/proof-of-funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'),
          email: fd.get('email'),
          context: 'Sample offer pack request — sent from final CTA',
        }),
      });
      setStatus({ kind: res.ok ? 'success' : 'error' });
    } catch {
      setStatus({ kind: 'error' });
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-white/20 bg-white/5 px-6 py-4 text-[15px] text-white/80 transition hover:border-white/40 hover:text-white"
      >
        Email me a sample offer
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2B2220]/40 p-4 backdrop-blur-sm"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {status.kind === 'success' ? (
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-[#DB5C5C]/20 text-2xl text-[#DB5C5C]">
                  ✓
                </div>
                <p className="mt-5 font-serif text-xl">On its way.</p>
                <p className="mt-2 text-sm text-stone-600">
                  Check your inbox in the next few minutes.
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-6 rounded-md border border-stone-300 px-5 py-2 text-sm text-stone-700 hover:border-stone-400"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <p className="font-serif italic text-[13px] text-[#DB5C5C]">
                  Sample offer pack
                </p>
                <h3 className="mt-2 font-serif text-2xl font-semibold">
                  Reviewed before you commit?
                </h3>
                <p className="mt-3 text-sm text-stone-600">
                  We&apos;ll email an anonymised sample offer document plus
                  the methodology. No follow-up unless you ask.
                </p>

                <form onSubmit={submit} className="mt-5 space-y-3">
                  <input
                    name="name"
                    placeholder="Your name"
                    required
                    className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#DB5C5C]"
                  />
                  <input
                    name="email"
                    type="email"
                    placeholder="Email"
                    required
                    className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#DB5C5C]"
                  />
                  {status.kind === 'error' && (
                    <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                      Something went wrong. Try again.
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={status.kind === 'submitting'}
                    className="w-full rounded-md bg-[#874646] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#6F3A3A] disabled:opacity-50"
                  >
                    {status.kind === 'submitting'
                      ? 'Sending...'
                      : 'Email me the sample'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
