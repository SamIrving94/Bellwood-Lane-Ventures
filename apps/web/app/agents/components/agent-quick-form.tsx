'use client';

import { useState } from 'react';

/**
 * The list of triggers we surface to agents. UI labels match the language
 * agents actually use; api values map onto the existing /api/quote enum so
 * the backend doesn't need a schema change.
 */
type Trigger = {
  ui: string;
  api:
    | 'chain_break'
    | 'probate'
    | 'repossession'
    | 'problem_property'
    | 'relocation'
    | 'short_lease'
    | 'other';
};

const TRIGGERS: Array<Trigger> = [
  { ui: 'Buyer pulled out', api: 'chain_break' },
  { ui: 'Mortgage refused', api: 'chain_break' },
  { ui: 'Survey down-valued', api: 'problem_property' },
  { ui: 'Chain break', api: 'chain_break' },
  { ui: 'Probate', api: 'probate' },
  { ui: 'Problem property', api: 'problem_property' },
  { ui: 'Other', api: 'other' },
];

type OfferResult = {
  quoteId: string;
  estimatedMarketValueMinPence?: number;
  estimatedMarketValueMaxPence?: number;
  offerPence?: number;
  offerPercentOfAvm?: number;
  completionDays?: number;
  lockedUntil?: string;
  requiresReview?: boolean;
  trackUrl?: string | null;
  agentAccount?: {
    referralCode: string;
    contactName: string;
    firmName: string;
  } | null;
};

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; offer: OfferResult; vendorEmail: string }
  | { kind: 'error'; message: string };

type AgentQuickFormProperties = {
  /** UI label of the trigger to pre-select. Falls back to 'Buyer pulled out'. */
  defaultTriggerLabel?: string;
};

function formatGBP(pence?: number) {
  if (!pence) return '—';
  return `£${Math.round(pence / 100).toLocaleString('en-GB')}`;
}

function findTrigger(label?: string): Trigger {
  return (
    TRIGGERS.find((t) => t.ui.toLowerCase() === (label ?? '').toLowerCase()) ??
    TRIGGERS[0]
  );
}

export function AgentQuickForm({ defaultTriggerLabel }: AgentQuickFormProperties = {}) {
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [trigger, setTrigger] = useState<Trigger>(findTrigger(defaultTriggerLabel));
  const [firmName, setFirmName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
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
          // Property type / bedrooms / condition are intentionally omitted -
          // the agent quick-form is for panic-mode submission. The dashboard
          // shows 'unknown' and the founder fills them in during follow-up,
          // rather than us polluting data with fake defaults.
          propertyType: 'other',
          role: 'agent',
          firmName: firmName.trim(),
          situation: trigger.api,
          triggerLabel: trigger.ui,
          urgencyDays: trigger.api === 'chain_break' ? 14 : 21,
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim(),
          submissionSource: 'agent_quick_form',
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
      setState({ kind: 'success', offer: data, vendorEmail: contactEmail.trim() });
    } catch (error) {
      setState({
        kind: 'error',
        message:
          'Could not reach our offer engine. Please email hello@bellwoodslane.co.uk and we will pick it up within two hours.',
      });
    }
  };

  if (state.kind === 'success') {
    return <SuccessView state={state} />;
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
          What&rsquo;s happened?
        </span>
        <div className="mt-2 flex flex-wrap gap-2">
          {TRIGGERS.map((t) => (
            <button
              key={t.ui}
              type="button"
              onClick={() => setTrigger(t)}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                trigger.ui === t.ui
                  ? 'border-[#C6A664] bg-[#FAF6EA] text-[#0A1020]'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
              }`}
            >
              {t.ui}
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
      </div>

      {state.kind === 'error' && (
        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <div className="mt-7 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <p className="text-xs text-slate-500">
          Indicative offer on screen in 60 seconds.
          <br />
          Signed PDF in your inbox within 4 working hours.
        </p>
        <button
          type="submit"
          disabled={state.kind === 'submitting'}
          className="inline-flex items-center gap-2 rounded-full bg-[#0A2540] px-7 py-3 text-sm font-medium text-white transition hover:bg-[#13365c] disabled:opacity-50"
        >
          {state.kind === 'submitting' ? 'Pulling comps\u2026' : 'See the number'}
          <span aria-hidden>→</span>
        </button>
      </div>
    </form>
  );
}

function SuccessView({
  state,
}: {
  state: { kind: 'success'; offer: OfferResult; vendorEmail: string };
}) {
  const { offer, vendorEmail } = state;
  const trackUrl =
    offer.trackUrl ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/instant-offer/offer/${offer.quoteId}`
      : '');

  if (offer.requiresReview) {
    return (
      <div className="rounded-3xl border border-[#C6A664]/40 bg-white p-10 shadow-sm">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#C6A664]">
          Manual review
        </p>
        <h3 className="mt-3 font-serif text-3xl font-semibold text-[#0A1020]">
          This one needs a human look.
        </h3>
        <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-slate-700">
          We have your details. Our senior appraiser will personally verify
          before issuing a binding figure. Expect a written offer in{' '}
          <strong>{vendorEmail}</strong> within 2 working hours, no obligation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border-2 border-[#C6A664]/50 bg-white p-7 shadow-md md:p-9">
        <div className="flex items-baseline justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#C6A664]">
            Indicative offer
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
            Ref {offer.quoteId?.slice(-8).toUpperCase()}
          </p>
        </div>
        <p
          className="mt-3 font-serif font-semibold tracking-[-0.025em] text-[#0A1020]"
          style={{ fontSize: 'clamp(48px, 8vw, 88px)', lineHeight: 1 }}
        >
          {formatGBP(offer.offerPence)}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-6 text-sm md:grid-cols-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
              AVM range
            </p>
            <p className="mt-1 text-slate-700">
              {formatGBP(offer.estimatedMarketValueMinPence)} —{' '}
              {formatGBP(offer.estimatedMarketValueMaxPence)}
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
              Completion
            </p>
            <p className="mt-1 text-slate-700">
              {offer.completionDays ?? 21} days
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
              Locked
            </p>
            <p className="mt-1 text-slate-700">72 hours from now</p>
          </div>
        </div>
        <p className="mt-6 rounded-xl bg-[#FAF6EA] px-5 py-4 text-[13px] leading-relaxed text-slate-700">
          This is the indicative figure from our AVM (HM Land Registry comps,
          last 24 months, adjusted for HPI). The signed binding offer
          document, with full reasoning, will be in{' '}
          <strong>{vendorEmail}</strong> within 4 working hours.
        </p>
      </div>

      {trackUrl && (
        <VendorShareCard
          trackUrl={trackUrl}
          offerPence={offer.offerPence}
          completionDays={offer.completionDays ?? 21}
        />
      )}

      {offer.agentAccount?.referralCode && (
        <p className="text-center text-[12px] text-slate-500">
          Referral code{' '}
          <span className="font-mono font-semibold text-[#0A2540]">
            {offer.agentAccount.referralCode}
          </span>
          {' '}has been auto-issued to {offer.agentAccount.firmName}.
        </p>
      )}
    </div>
  );
}

function VendorShareCard({
  trackUrl,
  offerPence,
  completionDays,
}: {
  trackUrl: string;
  offerPence?: number;
  completionDays: number;
}) {
  const figure = formatGBP(offerPence);
  const emailSubject = encodeURIComponent('A cash offer for your property');
  const emailBody = encodeURIComponent(
    [
      'Hi,',
      '',
      `Following our conversation, I have a cash offer for the property:`,
      '',
      `Indicative cash price: ${figure}`,
      `Completion: as fast as ${completionDays} days, or paced to suit you.`,
      `No fees, no chain.`,
      '',
      `You can see the offer document, the methodology, and the walk-away cover here:`,
      trackUrl,
      '',
      'Have a read - happy to walk you through it on a call when you have a moment.',
      '',
      'Best,',
    ].join('\n'),
  );
  const smsBody = encodeURIComponent(
    `Hi - I have a cash offer of ${figure} for the property. ${completionDays}-day completion, no fees. Full details + methodology: ${trackUrl}`,
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#C6A664]">
        Share with your vendor
      </p>
      <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
        One link, no login. Your vendor sees the offer, our methodology, and
        the walk-away cover.
      </p>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <a
          href={`mailto:?subject=${emailSubject}&body=${emailBody}`}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-[#0A1020] transition hover:border-[#C6A664] hover:bg-[#FAF6EA]"
        >
          <span aria-hidden>✉</span>
          Email vendor
        </a>
        <a
          href={`sms:?&body=${smsBody}`}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-[#0A1020] transition hover:border-[#C6A664] hover:bg-[#FAF6EA]"
        >
          <span aria-hidden>💬</span>
          Text vendor
        </a>
        <CopyButton value={trackUrl} label="Copy link" copiedLabel="Copied ✓" />
      </div>
      <details className="mt-4 text-xs text-slate-500">
        <summary className="cursor-pointer">Show the raw link</summary>
        <p className="mt-2 break-all font-mono text-[11px] text-slate-600">
          {trackUrl}
        </p>
      </details>
    </div>
  );
}

function CopyButton({
  value,
  label = 'Copy link',
  copiedLabel = 'Copied \u2713',
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-[#0A1020] transition hover:border-[#C6A664] hover:bg-[#FAF6EA]"
    >
      <span aria-hidden>🔗</span>
      {copied ? copiedLabel : label}
    </button>
  );
}
