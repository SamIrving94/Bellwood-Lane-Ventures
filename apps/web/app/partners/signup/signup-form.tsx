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
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-leaf/30 bg-leaf/10 text-leaf">
          <svg
            width="22"
            height="22"
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
        <h3 className="mt-6 font-semibold font-serif text-2xl">
          Check your email.
        </h3>
        <p className="mt-3 text-body">
          We&apos;ve sent you a sign-in link. Valid for 15 minutes.
        </p>
        <div className="mt-6 rounded-md border border-hair bg-soft p-4 text-sm">
          <Eyebrow tone="muted">Your referral code</Eyebrow>
          <p className="mt-1.5 font-semibold text-forest text-xl [font-family:var(--font-courier)]">
            {status.referralCode}
          </p>
        </div>
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
      <Field label="Work email" name="email" type="email" required />
      <Field label="Your name" name="contactName" required />
      <Field label="Firm name" name="firmName" required />
      <Field label="Phone (optional)" name="phone" type="tel" />
      <Field label="Office postcode (optional)" name="postcode" />

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
          ? 'Creating account...'
          : 'Create partner account →'}
      </button>

      <p className="text-center text-body/80 text-xs">
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
      <Eyebrow tone="muted">{label}</Eyebrow>
      <input
        name={name}
        type={type}
        required={required}
        className="mt-1.5 w-full rounded-[2px] border border-hair bg-white px-4 py-3 text-sm outline-none transition focus:border-leaf"
      />
    </label>
  );
}
