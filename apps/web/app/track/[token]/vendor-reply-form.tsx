'use client';

import { useState } from 'react';

type Status = 'idle' | 'submitting' | 'sent' | 'error';

export function VendorReplyForm({ token }: { token: string }) {
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setStatus('submitting');
    setError(null);
    try {
      const res = await fetch(`/api/track/${token}/reply`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message,
          contactName: name || undefined,
          contactEmail: email || undefined,
          contactPhone: phone || undefined,
          website,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? `Request failed: ${res.status}`);
      }
      setStatus('sent');
      setMessage('');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  if (status === 'sent') {
    return (
      <div className="mt-6 rounded-2xl border border-[#1F6B3A]/30 bg-[#F1F7F1] p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#1F6B3A]">
          Message received
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-700">
          Thank you. Anthony or someone on the team will reply within one
          working day. Anything urgent — phone 0203 488 5612.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <label className="block">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-600">
          Message
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={4}
          maxLength={2000}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] text-slate-900 focus:border-[#0A2540] focus:outline-none"
          placeholder="What would you like us to know? Question, concern, status request — anything."
        />
      </label>

      <div className="grid gap-4 md:grid-cols-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name (optional)"
          maxLength={120}
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] text-slate-900 focus:border-[#0A2540] focus:outline-none"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (optional)"
          maxLength={200}
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] text-slate-900 focus:border-[#0A2540] focus:outline-none"
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone (optional)"
          maxLength={40}
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] text-slate-900 focus:border-[#0A2540] focus:outline-none"
        />
      </div>

      {/* Honeypot — hidden from humans */}
      <input
        type="text"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[10000px] h-0 w-0 overflow-hidden opacity-0"
      />

      {error && (
        <p className="font-mono text-[12px] text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting' || !message.trim()}
        className="inline-flex items-center gap-2 rounded-full bg-[#0A2540] px-6 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-white transition hover:bg-[#0A1020] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === 'submitting' ? 'Sending…' : 'Send message'}
      </button>

      <p className="font-mono text-[11px] text-slate-500">
        Goes straight to Anthony. We read every message and reply by hand —
        usually within a working day.
      </p>
    </form>
  );
}
