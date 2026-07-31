'use client';

import { Eyebrow } from '@/components/brand';
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
        className="rounded-md bg-[#874646] px-6 py-3 text-sm text-white transition hover:bg-[#6F3A3A]"
      >
        Request proof of funds
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pof-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2B2220]/40 p-4 backdrop-blur-sm"
          onClick={close}
        >
          <div
            className="w-full max-w-lg rounded-lg bg-white p-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {status.kind === 'success' ? (
              <div className="text-center">
                <h3
                  id="pof-title"
                  className="font-semibold font-serif text-2xl"
                >
                  Request received.
                </h3>
                <p className="mt-3 text-sm text-stone-600">
                  We&apos;ll email you a signed bank letter as soon as one of
                  the team has prepared it.
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
                <p className="font-serif text-[#DB5C5C] text-[13px] italic">
                  Proof of funds
                </p>
                <h3
                  id="pof-title"
                  className="mt-2 font-semibold font-serif text-2xl"
                >
                  Signed bank letter, direct to your inbox.
                </h3>
                <p className="mt-3 text-sm text-stone-600">
                  Tell us where to send it. No automated chasers. One human will
                  email you a single PDF.
                </p>

                <form onSubmit={submit} className="mt-6 space-y-3">
                  <Input name="name" label="your name" required />
                  <Input
                    name="email"
                    label="work email"
                    type="email"
                    required
                  />
                  <label className="block">
                    <Eyebrow tone="muted" className="text-[13px]">
                      context (optional)
                    </Eyebrow>
                    <textarea
                      name="context"
                      rows={3}
                      placeholder="e.g. negotiating a Manchester probate sale, vendor wants assurance"
                      className="mt-1 w-full rounded-md border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#DB5C5C]"
                    />
                  </label>

                  {status.kind === 'error' && (
                    <p className="rounded-[2px] border border-[#DB5C5C]/40 bg-[#F6ECE7] p-3 text-[#874646] text-sm">
                      {status.message}
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={close}
                      className="text-sm text-stone-500 hover:text-[#874646]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={status.kind === 'submitting'}
                      className="rounded-md bg-[#DB5C5C] px-6 py-3 font-medium text-[#2B2220] text-sm transition hover:bg-[#b08f52] disabled:opacity-50"
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
      <Eyebrow tone="muted" className="text-[13px]">
        {label}
      </Eyebrow>
      <input
        name={name}
        type={type}
        required={required}
        className="mt-1 w-full rounded-md border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#DB5C5C]"
      />
    </label>
  );
}
