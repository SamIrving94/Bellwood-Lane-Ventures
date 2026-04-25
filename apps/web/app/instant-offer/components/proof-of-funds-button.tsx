'use client';

import { useState } from 'react';

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

export function ProofOfFundsButton() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const close = () => {
    setOpen(false);
    // reset once the modal animates out
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
          context: fd.get('context') || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus({
          kind: 'error',
          message: data.error || 'Could not send the request.',
        });
        return;
      }
      setStatus({ kind: 'success' });
    } catch {
      setStatus({ kind: 'error', message: 'Network error. Try again.' });
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-[#0A2540] px-6 py-3 text-sm text-white transition hover:bg-[#13365c]"
      >
        Request proof of funds
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pof-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A1020]/40 p-4 backdrop-blur-sm"
          onClick={close}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {status.kind === 'success' ? (
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#1F6B3A]/15 text-2xl text-[#1F6B3A]">
                  ✓
                </div>
                <h3
                  id="pof-title"
                  className="mt-5 font-serif text-2xl font-semibold"
                >
                  Request received.
                </h3>
                <p className="mt-3 text-sm text-slate-600">
                  We&apos;ll send you a signed bank letter within 2 hours
                  during business hours, or first thing next morning.
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-6 rounded-full border border-slate-300 px-5 py-2 text-sm text-slate-700 hover:border-slate-400"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C6A664]">
                  Proof of funds
                </p>
                <h3
                  id="pof-title"
                  className="mt-2 font-serif text-2xl font-semibold"
                >
                  Signed bank letter, within two hours.
                </h3>
                <p className="mt-3 text-sm text-slate-600">
                  Tell us where to send it. No automated chasers — one
                  human will email you a single PDF.
                </p>

                <form onSubmit={submit} className="mt-6 space-y-3">
                  <Input name="name" label="Your name" required />
                  <Input
                    name="email"
                    label="Work email"
                    type="email"
                    required
                  />
                  <label className="block">
                    <span className="text-xs uppercase tracking-widest text-slate-500">
                      Context (optional)
                    </span>
                    <textarea
                      name="context"
                      rows={3}
                      placeholder="e.g. negotiating a Manchester probate sale, vendor wants assurance"
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#C6A664]"
                    />
                  </label>

                  {status.kind === 'error' && (
                    <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                      {status.message}
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={close}
                      className="text-sm text-slate-500 hover:text-[#0A2540]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={status.kind === 'submitting'}
                      className="rounded-full bg-[#C6A664] px-6 py-3 text-sm font-medium text-[#0A1020] transition hover:bg-[#b08f52] disabled:opacity-50"
                    >
                      {status.kind === 'submitting'
                        ? 'Sending...'
                        : 'Request the letter →'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Input({
  name,
  label,
  type = 'text',
  required,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest text-slate-500">
        {label}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#C6A664]"
      />
    </label>
  );
}
