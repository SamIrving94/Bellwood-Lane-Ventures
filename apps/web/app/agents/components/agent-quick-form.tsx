'use client';

import { useState } from 'react';

type Situation =
  | 'chain_break'
  | 'probate'
  | 'repossession'
  | 'problem_property'
  | 'other';

const SITUATIONS: Array<{ value: Situation; label: string }> = [
  { value: 'chain_break', label: 'Chain break' },
  { value: 'probate', label: 'Probate' },
  { value: 'repossession', label: 'Repossession' },
  { value: 'problem_property', label: 'Problem property' },
  { value: 'other', label: 'Other' },
];

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; referralCode?: string }
  | { kind: 'error'; message: string };

export function AgentQuickForm() {
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [situation, setSituation] = useState<Situation>('chain_break');
  const [firmName, setFirmName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [state, setState] = useState<SubmitState>({ kind: 'idle' });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!address.trim() || !postcode.trim() || !contactName.trim() || !contactEmail.trim() || !firmName.trim()) {
      setState({ kind: 'error', message: 'Address, postcode, firm, name and email are required.' });
      return;
    }
    if (!/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(postcode.trim())) {
      setState({ kind: 'error', message: 'That postcode doesn\u2019t look right (e.g. M1 5AB).' });
      return;
    }

    setState({ kind: 'submitting' });
    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: address.trim(),
          postcode: postcode.trim().toUpperCase(),
          propertyType: 'other',
          bedrooms: 3,
          role: 'agent',
          firmName: firmName.trim(),
          situation,
          condition: 5,
          urgencyDays: 21,
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim(),
          notes: notes.trim() || undefined,
          source: 'agent_quick_form',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({
          kind: 'error',
          message:
            data?.error ||
            'Something went wrong. Please email hello@bellwoodslane.co.uk and we will pick it up within two hours.',
        });
        return;
      }
      setState({
        kind: 'success',
        referralCode: data?.agentAccount?.referralCode,
      });
    } catch (error) {
      setState({
        kind: 'error',
        message:
          'Could not reach our offer engine. Please email hello@bellwoodslane.co.uk and we will pick it up within two hours.',
      });
    }
  };

  if (state.kind === 'success') {
    return (
      <div className="rounded-3xl border border-[#1F6B3A]/30 bg-[#F0FAF3] p-10 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#1F6B3A]">
          Received
        </p>
        <h3 className="mt-3 font-serif text-3xl font-semibold text-[#0A1020]">
          We&rsquo;ve got the property.
        </h3>
        <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-slate-700">
          A signed offer document, with our methodology and your firm&rsquo;s
          referral details, will land in <strong>{contactEmail}</strong> within
          24 hours. Reply directly to that email if anything is urgent.
        </p>
        {state.referralCode && (
          <p className="mt-6 text-sm text-slate-600">
            Your referral code:{' '}
            <span className="font-mono font-semibold text-[#0A2540]">
              {state.referralCode}
            </span>
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
            Property address
          </span>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="14 Acacia Avenue, Stockport"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#C6A664]"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
            Postcode
          </span>
          <input
            type="text"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            placeholder="SK4 3HQ"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm uppercase outline-none transition focus:border-[#C6A664]"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
            Your firm
          </span>
          <input
            type="text"
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            placeholder="Acme Estates"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#C6A664]"
          />
        </label>
      </div>

      <div className="mt-6">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
          Situation
        </span>
        <div className="mt-2 flex flex-wrap gap-2">
          {SITUATIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSituation(s.value)}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                situation === s.value
                  ? 'border-[#C6A664] bg-[#FAF6EA] text-[#0A1020]'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
            Your name
          </span>
          <input
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#C6A664]"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
            Email
          </span>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#C6A664]"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
            Phone (optional)
          </span>
          <input
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#C6A664]"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
            Anything we should know? (optional)
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Asking price, vendor situation, deadlines\u2026"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#C6A664]"
          />
        </label>
      </div>

      {state.kind === 'error' && (
        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <div className="mt-7 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <p className="text-xs text-slate-500">
          We send a signed offer document to your email within 24 hours. No
          obligation, no contract to sign.
        </p>
        <button
          type="submit"
          disabled={state.kind === 'submitting'}
          className="inline-flex items-center gap-2 rounded-full bg-[#0A2540] px-7 py-3 text-sm font-medium text-white transition hover:bg-[#13365c] disabled:opacity-50"
        >
          {state.kind === 'submitting' ? 'Sending\u2026' : 'Send for offer'}
          <span aria-hidden>→</span>
        </button>
      </div>
    </form>
  );
}
