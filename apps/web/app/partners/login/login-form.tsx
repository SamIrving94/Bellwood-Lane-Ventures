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
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#DB5C5C]/40 text-[#874646]">
          <svg
            viewBox="0 0 20 20"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden
          >
            <path
              d="M4 10.5l4 4 8-9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="mt-5 font-serif text-xl">Check your inbox.</p>
        <p className="mt-2 text-sm text-stone-600">
          If your email is registered, we&apos;ve sent a sign-in link.
        </p>
        {status.devMagicLink && (
          <div className="mt-6 rounded-md border border-[#EAE0D9] bg-[#FBF7F3] p-4 text-left text-xs">
            <p className="font-semibold">Dev mode: magic link</p>
            <a
              href={status.devMagicLink}
              className="mt-2 block break-all text-[#874646] underline"
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
        <Eyebrow tone="muted" className="text-[13px]">
          work email
        </Eyebrow>
        <input
          name="email"
          type="email"
          required
          autoFocus
          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#DB5C5C]"
        />
      </label>
      {status.state === 'error' && (
        <p className="rounded-md border border-[#DB5C5C]/30 bg-[#F6ECE7] p-3 text-[#7E3F3F] text-sm">
          {status.message}
        </p>
      )}
      <button
        type="submit"
        disabled={status.state === 'submitting'}
        className="w-full rounded-md bg-[#874646] px-6 py-4 font-medium text-sm text-white transition hover:bg-[#6F3A3A] disabled:opacity-50"
      >
        {status.state === 'submitting'
          ? 'Sending link...'
          : 'Send sign-in link'}
      </button>
    </form>
  );
}
