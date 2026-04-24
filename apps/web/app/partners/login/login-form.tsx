'use client';

import { useState } from 'react';

export function LoginForm() {
  const [status, setStatus] = useState<
    | { state: 'idle' }
    | { state: 'submitting' }
    | { state: 'success'; devMagicLink?: string }
    | { state: 'error'; message: string }
  >({ state: 'idle' });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus({ state: 'submitting' });
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/partners/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fd.get('email') }),
      });
      const data = await res.json();
      setStatus({ state: 'success', devMagicLink: data.devMagicLink });
    } catch {
      setStatus({ state: 'error', message: 'Network error.' });
    }
  };

  if (status.state === 'success') {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#C6A664]/20 text-xl text-[#C6A664]">
          ✓
        </div>
        <p className="mt-5 font-serif text-xl">Check your inbox.</p>
        <p className="mt-2 text-sm text-slate-600">
          If your email is registered, we&apos;ve sent a sign-in link.
        </p>
        {status.devMagicLink && (
          <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-left text-xs">
            <p className="font-semibold">Dev mode — magic link</p>
            <a
              href={status.devMagicLink}
              className="mt-2 block break-all text-[#0A2540] underline"
            >
              {status.devMagicLink}
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="text-xs uppercase tracking-widest text-slate-500">
          Work email
        </span>
        <input
          name="email"
          type="email"
          required
          autoFocus
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#C6A664]"
        />
      </label>
      {status.state === 'error' && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {status.message}
        </p>
      )}
      <button
        type="submit"
        disabled={status.state === 'submitting'}
        className="w-full rounded-full bg-[#0A2540] px-6 py-4 text-sm font-medium text-white transition hover:bg-[#13365c] disabled:opacity-50"
      >
        {status.state === 'submitting'
          ? 'Sending link...'
          : 'Send sign-in link'}
      </button>
    </form>
  );
}
