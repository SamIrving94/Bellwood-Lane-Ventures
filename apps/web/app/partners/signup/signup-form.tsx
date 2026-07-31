'use client';

import { Eyebrow } from '@/components/brand';
import { useState } from 'react';

export function SignupForm() {
  const [status, setStatus] = useState<
    | { state: 'idle' }
    | { state: 'submitting' }
    | { state: 'success'; referralCode: string; devMagicLink?: string }
    | { state: 'error'; message: string }
  >({ state: 'idle' });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus({ state: 'submitting' });
    const fd = new FormData(e.currentTarget);
    const payload = {
      email: fd.get('email'),
      contactName: fd.get('contactName'),
      firmName: fd.get('firmName'),
      phone: fd.get('phone') || undefined,
      postcode: fd.get('postcode') || undefined,
    };
    try {
      const res = await fetch('/api/partners/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({
          state: 'error',
          message: data.error || 'Something went wrong',
        });
        return;
      }
      setStatus({
        state: 'success',
        referralCode: data.referralCode,
        devMagicLink: data.devMagicLink,
      });
    } catch {
      setStatus({ state: 'error', message: 'Network error. Try again.' });
    }
  };

  if (status.state === 'success') {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#DB5C5C]/40 text-[#874646]">
          <svg
            viewBox="0 0 20 20"
            className="h-6 w-6"
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
        <h3 className="mt-6 font-semibold font-serif text-2xl">
          Check your email.
        </h3>
        <p className="mt-3 text-stone-600">
          We&apos;ve sent you a sign-in link. Valid for 15 minutes.
        </p>
        <div className="mt-6 rounded-[2px] border border-[#EAE0D9] bg-[#F6ECE7] p-4 text-sm">
          <Eyebrow tone="muted" className="text-[13px]">
            your referral code
          </Eyebrow>
          <p className="mt-1 font-mono font-semibold text-[#874646] text-xl">
            {status.referralCode}
          </p>
        </div>
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
      <Field label="work email" name="email" type="email" required />
      <Field label="your name" name="contactName" required />
      <Field label="firm name" name="firmName" required />
      <Field label="phone (optional)" name="phone" type="tel" />
      <Field label="office postcode (optional)" name="postcode" />

      {status.state === 'error' && (
        <p className="rounded-md border border-[#DB5C5C]/30 bg-[#F6ECE7] p-3 text-[#7E3F3F] text-sm">
          {status.message}
        </p>
      )}

      <button
        type="submit"
        disabled={status.state === 'submitting'}
        className="w-full rounded-md bg-[#874646] px-6 py-4 font-medium text-sm text-white transition hover:bg-[#6d3636] disabled:opacity-50"
      >
        {status.state === 'submitting'
          ? 'Creating account...'
          : 'Create partner account →'}
      </button>

      <p className="text-center text-stone-500 text-xs">
        No credit card. No contract. Start referring today.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required,
}: {
  label: string;
  name: string;
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
