'use client';

import { type FormEvent, useState } from 'react';

export function InterestForm({
  token,
  dealId,
  priceLabel,
  defaultName,
  registeredAt,
  disabledReason,
}: {
  token: string;
  dealId: string;
  priceLabel: string;
  defaultName: string;
  registeredAt: string | null;
  /** Shown instead of the form: preview link, closed window, no email. */
  disabledReason: string | null;
}) {
  const [name, setName] = useState(defaultName);
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>(
    registeredAt ? 'done' : 'idle'
  );
  const [error, setError] = useState<string | null>(null);

  if (state === 'done') {
    return (
      <div className="rounded-[2px] border border-leaf/30 bg-leaf/5 p-4">
        <p className="font-semibold text-[15px] text-forest">
          Your interest is registered at {priceLabel}.
        </p>
        <p className="mt-1 text-[13.5px] text-body leading-[1.55]">
          We&apos;ll call you to talk through funds and timing. Nothing is
          agreed until we have spoken.
        </p>
      </div>
    );
  }

  if (disabledReason) {
    return (
      <p className="rounded-[2px] border border-hair bg-soft p-4 text-[13.5px] text-body">
        {disabledReason}
      </p>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState('sending');
    setError(null);
    try {
      const res = await fetch(`/api/investors/${token}/interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, name, note: note || undefined }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Something went wrong.');
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setState('error');
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="text-[12.5px] text-body">Your name</span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-[2px] border border-hair bg-white px-3 py-2.5 text-[15px] text-forest outline-none focus:border-forest"
        />
      </label>
      <label className="block">
        <span className="text-[12.5px] text-body">
          Anything we should know? (optional)
        </span>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. cash ready, own solicitor, want a viewing"
          className="mt-1 w-full rounded-[2px] border border-hair bg-white px-3 py-2.5 text-[14px] text-forest outline-none focus:border-forest"
        />
      </label>
      <button
        type="submit"
        disabled={state === 'sending'}
        className="w-full rounded-[2px] bg-forest px-5 py-3 font-semibold text-[15px] text-cream transition-colors hover:bg-leaf-dark disabled:opacity-60"
      >
        {state === 'sending'
          ? 'Registering…'
          : `Register interest at ${priceLabel}`}
      </button>
      {error && <p className="text-[13px] text-wax">{error}</p>}
      <p className="text-[11.5px] text-stone-500 leading-[1.5]">
        Registering interest is not a commitment, for you or for us.
      </p>
    </form>
  );
}
