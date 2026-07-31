'use client';

import { Eyebrow } from '@/components/brand';
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
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-leaf/30 bg-leaf/10 text-leaf">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden
          >
            <path
              d="M4 10.5l4 4 8-9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="mt-5 font-serif text-xl">Check your inbox.</p>
        <p className="mt-2 text-body text-sm">
          If your email is registered, we&apos;ve sent a sign-in link.
        </p>
        {status.devMagicLink && (
          <div className="mt-6 rounded-md border border-hair bg-soft p-4 text-left text-xs">
            <p className="font-semibold">Dev mode: magic link</p>
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
        <Eyebrow tone="muted">Work email</Eyebrow>
        <input
          name="email"
          type="email"
          required
          autoFocus
          className="mt-1.5 w-full rounded-[2px] border border-hair bg-white px-4 py-3 text-sm outline-none transition focus:border-leaf"
        />
      </label>
      {status.state === 'error' && (
        <p className="rounded-[2px] border border-hair bg-soft p-3 text-sm text-wax">
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
