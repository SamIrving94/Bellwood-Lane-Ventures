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
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-leaf/20 text-leaf text-xl">
          ✓
        </div>
        <p className="mt-5 font-serif text-xl">Check your inbox.</p>
        <p className="mt-2 text-sm text-stone-600">
          If your email is registered, we&apos;ve sent a sign-in link.
        </p>
        {status.devMagicLink && (
          <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-left text-xs">
            <p className="font-semibold">Dev mode — magic link</p>
            <a
              href={status.devMagicLink}
              className="mt-2 block break-all text-leaf underline"
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
        <span className="text-stone-500 text-xs uppercase tracking-widest">
          Work email
        </span>
        <input
          name="email"
          type="email"
          required
          autoFocus
          className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-leaf"
        />
      </label>
      {status.state === 'error' && (
        <p className="rounded-lg bg-red-50 p-3 text-red-700 text-sm">
          {status.message}
        </p>
      )}
      <button
        type="submit"
        disabled={status.state === 'submitting'}
        className="w-full rounded-md bg-leaf px-6 py-4 font-medium text-sm text-white transition hover:bg-leaf-dark disabled:opacity-50"
      >
        {status.state === 'submitting'
          ? 'Sending link...'
          : 'Send sign-in link'}
      </button>
    </form>
  );
}
