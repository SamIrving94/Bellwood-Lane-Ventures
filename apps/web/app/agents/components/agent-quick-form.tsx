'use client';

import type { SituationValue } from '@/lib/situations';
import { useState } from 'react';

/**
 * The list of triggers we surface to agents. UI labels match the language
 * agents actually use (they describe events, not categories); api values are
 * typed against the canonical taxonomy in @/lib/situations, which mirrors
 * the /api/quote enum.
 */
type Trigger = {
  ui: string;
  api: SituationValue;
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

/**
 * What we keep from the /api/quote response. The quote is still generated
 * and stored for founder review, but nothing priced is shown here: no
 * indicative offer, no AVM range, no vendor share link carrying a figure
 * (founder decision, Aug 2026; co-founder note, 20 Sep 2026). The written
 * offer follows the viewing, by email.
 */
type OfferResult = {
  quoteId: string;
  agentAccount?: {
    referralCode: string;
    contactName: string;
    firmName: string;
  } | null;
};

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; offer: OfferResult; agentEmail: string }
  | { kind: 'error'; message: string };

type AgentQuickFormProperties = {
  /** UI label of the trigger to pre-select. Falls back to 'Buyer pulled out'. */
  defaultTriggerLabel?: string;
  /** API value of the trigger to pre-select — used by the score-form handoff. */
  defaultTriggerApi?: string;
  /** Prefills from the score-form handoff so agents never re-type. */
  defaultAddress?: string;
  defaultPostcode?: string;
};

function findTrigger(label?: string, api?: string): Trigger {
  return (
    TRIGGERS.find((t) => t.ui.toLowerCase() === (label ?? '').toLowerCase()) ??
    TRIGGERS.find((t) => t.api === api) ??
    TRIGGERS[0]
  );
}

export function AgentQuickForm({
  defaultTriggerLabel,
  defaultTriggerApi,
  defaultAddress,
  defaultPostcode,
}: AgentQuickFormProperties = {}) {
  const [address, setAddress] = useState(defaultAddress ?? '');
  const [postcode, setPostcode] = useState(defaultPostcode ?? '');
  const [trigger, setTrigger] = useState<Trigger>(
    findTrigger(defaultTriggerLabel, defaultTriggerApi)
  );
  const [firmName, setFirmName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [state, setState] = useState<SubmitState>({ kind: 'idle' });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !address.trim() ||
      !postcode.trim() ||
      !contactName.trim() ||
      !contactEmail.trim() ||
      !firmName.trim()
    ) {
      setState({
        kind: 'error',
        message: 'Address, postcode, firm, name and email are required.',
      });
      return;
    }
    if (!/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(postcode.trim())) {
      setState({
        kind: 'error',
        message: 'That postcode doesn\u2019t look right (e.g. M1 5AB).',
      });
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
          contactPhone: contactPhone.trim() || undefined,
          submissionSource: 'agent_quick_form',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({
          kind: 'error',
          message:
            data?.error ||
            'Something went wrong. Please email hello@bellwoodslane.co.uk and we will pick it up.',
        });
        return;
      }
      setState({
        kind: 'success',
        offer: data,
        agentEmail: contactEmail.trim(),
      });
    } catch (error) {
      setState({
        kind: 'error',
        message:
          'Could not reach our offer engine. Please email hello@bellwoodslane.co.uk and we will pick it up.',
      });
    }
  };

  if (state.kind === 'success') {
    return <SuccessView state={state} />;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:p-8"
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="font-serif text-[13px] text-stone-500">
            Property address
          </span>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="14 Acacia Avenue, Stockport"
            className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-leaf"
          />
        </label>
        <label className="block">
          <span className="font-serif text-[13px] text-stone-500">
            Postcode
          </span>
          <input
            type="text"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            placeholder="SK4 3HQ"
            className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm uppercase outline-none transition focus:border-leaf"
          />
        </label>
        <label className="block">
          <span className="font-serif text-[13px] text-stone-500">
            Your firm
          </span>
          <input
            type="text"
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            placeholder="Acme Estates"
            className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-leaf"
          />
        </label>
      </div>

      <div className="mt-6">
        <span className="font-serif text-[13px] text-stone-500">
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
                  ? 'border-leaf bg-soft text-forest'
                  : 'border-stone-300 bg-white text-stone-600 hover:border-stone-400'
              }`}
            >
              {t.ui}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
        <label className="block">
          <span className="font-serif text-[13px] text-stone-500">
            Your name
          </span>
          <input
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-leaf"
          />
        </label>
        <label className="block">
          <span className="font-serif text-[13px] text-stone-500">
            Email
          </span>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-leaf"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="font-serif text-[13px] text-stone-500">
            Mobile{' '}
            <span className="text-stone-400 normal-case tracking-normal">
              (WhatsApp · optional but faster)
            </span>
          </span>
          <input
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="07700 900000"
            className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-leaf"
          />
        </label>
      </div>

      {state.kind === 'error' && (
        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
          {state.message}
        </p>
      )}

      <div className="mt-7 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <p className="text-stone-500 text-xs">
          We come back to you the same day, Monday to Friday.
          <br />
          We confirm a price in writing within two working days of viewing.
        </p>
        <button
          type="submit"
          disabled={state.kind === 'submitting'}
          className="inline-flex items-center gap-2 rounded-md bg-leaf px-7 py-3 font-medium text-sm text-white transition hover:bg-leaf-dark disabled:opacity-50"
        >
          {state.kind === 'submitting'
            ? 'Sending\u2026'
            : 'Submit the details'}
          <span aria-hidden>→</span>
        </button>
      </div>
    </form>
  );
}

function SuccessView({
  state,
}: {
  state: { kind: 'success'; offer: OfferResult; agentEmail: string };
}) {
  const { offer, agentEmail } = state;
  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-leaf/40 bg-white p-7 shadow-sm md:p-9">
        <div className="flex items-baseline justify-between">
          <p className="font-serif text-[13px] text-leaf">Details received</p>
          <p className="font-serif text-[13px] text-stone-400">
            Ref {offer.quoteId?.slice(-8).toUpperCase()}
          </p>
        </div>
        <h3 className="mt-3 font-semibold font-serif text-3xl text-forest">
          Thank you. We will be in touch.
        </h3>
        <p className="mt-5 max-w-lg text-[15px] text-stone-700 leading-relaxed">
          One of us will come back to you the same day, Monday to Friday, to
          talk through the situation and arrange a time to view the property.
          No figure until we have stood in the house; once we have, the
          written offer goes to <strong>{agentEmail}</strong> within two
          working days, for you to take to your client.
        </p>
      </div>

      {offer.agentAccount?.referralCode && (
        <p className="text-center text-[12px] text-stone-500">
          Referral code{' '}
          <span className="font-mono font-semibold text-forest">
            {offer.agentAccount.referralCode}
          </span>{' '}
          has been auto-issued to {offer.agentAccount.firmName}.
        </p>
      )}
    </div>
  );
}
