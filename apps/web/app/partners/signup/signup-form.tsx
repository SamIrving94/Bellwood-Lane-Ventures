'use client';

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
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#C6A664]/20 text-2xl text-[#C6A664]">
          ✓
        </div>
        <h3 className="mt-6 font-serif text-2xl font-semibold">
          Check your email.
        </h3>
        <p className="mt-3 text-slate-600">
          We&apos;ve sent you a sign-in link. Valid for 15 minutes.
        </p>
        <div className="mt-6 rounded-xl bg-[#FAF6EA] p-4 text-sm">
          <p className="text-xs uppercase tracking-widest text-slate-500">
            Your referral code
          </p>
          <p className="mt-1 font-mono text-xl font-semibold text-[#0A2540]">
            {status.referralCode}
          </p>
        </div>
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
      <Field label="Work email" name="email" type="email" required />
      <Field label="Your name" name="contactName" required />
      <Field label="Firm name" name="firmName" required />
      <Field label="Phone (optional)" name="phone" type="tel" />
      <Field label="Office postcode (optional)" name="postcode" />

      {status.state === 'error' && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {status.message}
        </p>
      )}

      <button
        type="submit"
        disabled={status.state === 'submitting'}
        className="w-full rounded-full bg-[#C6A664] px-6 py-4 text-sm font-medium text-[#0A1020] transition hover:bg-[#b08f52] disabled:opacity-50"
      >
        {status.state === 'submitting'
          ? 'Creating account...'
          : 'Create partner account →'}
      </button>

      <p className="text-center text-xs text-slate-500">
        No credit card. No contract. Start referring in 60 seconds.
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
