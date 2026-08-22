'use client';

import { useState } from 'react';

/**
 * The homepage offer form — four short steps, per the Aug 2026 design
 * handoff. Steps 1–2 (address, name/phone) are the handoff's design; steps
 * 3–4 complete the journey the labels promise ("One of four…"), collecting
 * the minimum the existing /api/quote contract requires: property type,
 * situation, and the email the written offer is sent to.
 *
 * No figure is ever shown on screen (founder decision, Aug 2026): the quote
 * engine still runs and stores its result, but the seller sees an
 * acknowledgement and gets the offer by email after the viewing.
 */

const PROPERTY_TYPES = [
  { label: 'Terraced', value: 'terraced_house' },
  { label: 'Semi-detached', value: 'semi_detached' },
  { label: 'Detached', value: 'detached' },
  { label: 'Flat', value: 'flat' },
  { label: 'Other', value: 'other' },
] as const;

const SITUATIONS = [
  { label: 'Probate', value: 'probate' },
  { label: 'My buyer pulled out', value: 'chain_break' },
  { label: 'Relocating', value: 'relocation' },
  { label: 'Separation', value: 'other' },
  { label: 'Something else', value: 'other' },
] as const;

/** UK postcode anywhere in the address line — a plausible-postcode gate, per
 *  the handoff ("require a plausible UK postcode before advancing"). */
const POSTCODE_RE = /([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})/i;

const INPUT =
  'min-w-0 flex-1 rounded-[2px] border border-[#D9D0BC] bg-cream px-4 py-3.5 text-[16px] text-forest outline-none transition focus:border-leaf focus:shadow-[0_0_0_3px_rgba(46,125,91,0.15)]';
const PILL =
  'inline-flex shrink-0 cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-full bg-leaf px-7 py-3.5 font-semibold text-[15px] text-white transition hover:bg-leaf-dark disabled:cursor-not-allowed disabled:opacity-60';

function StepLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 text-[#8B9489] text-[10.5px] uppercase tracking-[0.2em] [font-family:var(--font-courier)]">
      {children}
    </p>
  );
}

type Step = 'address' | 'contact' | 'property' | 'situation' | 'done';

export function OfferForm() {
  const [step, setStep] = useState<Step>('address');
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [situation, setSituation] = useState('');
  const [situationLabel, setSituationLabel] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setSending(true);
    setError(null);
    const m = address.match(POSTCODE_RE);
    const postcode = m ? `${m[1]} ${m[2]}`.toUpperCase() : '';
    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          postcode,
          propertyType,
          role: 'seller',
          situation,
          contactName: name,
          contactEmail: email,
          contactPhone: phone || undefined,
          triggerLabel: situationLabel || undefined,
          submissionSource: 'homepage_offer_form',
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      setStep('done');
    } catch {
      setError(
        'That didn’t go through. Try again, or email us and a person will pick it up the same day.'
      );
    } finally {
      setSending(false);
    }
  };

  if (step === 'done') {
    return (
      <div
        id="offer"
        className="scroll-mt-24 rounded-[2px] border border-leaf/40 bg-white p-6"
      >
        <StepLabel>Enquiry received</StepLabel>
        <p className="font-semibold font-serif text-[20px] text-forest">
          Thank you. We will be in touch.
        </p>
        <p className="mt-2.5 text-[13.5px] text-stone-600 leading-relaxed">
          One of us will come back to you the same day, Monday to Friday, to
          talk through your situation and arrange a time to come and see the
          property. No figure until we&rsquo;ve stood in the house; once we
          have, your written offer follows within two working days.
        </p>
      </div>
    );
  }

  return (
    <div
      id="offer"
      className="scroll-mt-24 rounded-[2px] border border-hair bg-white px-6 pt-5.5 pb-5"
    >
      {step === 'address' && (
        <div>
          <StepLabel>One of four · start with the address</StepLabel>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="House number and postcode"
              aria-label="House number and postcode"
              className={INPUT}
              style={{ minWidth: 210 }}
            />
            <button
              type="button"
              className={PILL}
              onClick={() => {
                if (!POSTCODE_RE.test(address)) {
                  setError(
                    'We need a full UK postcode to look the property up.'
                  );
                  return;
                }
                setError(null);
                setStep('contact');
              }}
            >
              Continue <span aria-hidden>→</span>
            </button>
          </div>
          <p className="mt-3.5 text-[13px] text-stone-600 leading-normal">
            Three questions after this. No figure until we&rsquo;ve stood in the
            house.
          </p>
        </div>
      )}

      {step === 'contact' && (
        <div>
          <StepLabel>Two of four · where can we reach you?</StepLabel>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              aria-label="Your name"
              className={INPUT}
              style={{ minWidth: 140 }}
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone"
              aria-label="Phone"
              className={INPUT}
              style={{ minWidth: 140 }}
            />
            <button
              type="button"
              className={PILL}
              onClick={() => {
                if (!name.trim()) {
                  setError('A name helps us know who to ask for.');
                  return;
                }
                setError(null);
                setStep('property');
              }}
            >
              Continue <span aria-hidden>→</span>
            </button>
          </div>
          <p className="mt-3.5 text-[13px] text-stone-600 leading-normal">
            A real person reads it. Same-day response, Monday to Friday.{' '}
            <button
              type="button"
              onClick={() => setStep('address')}
              className="cursor-pointer text-[13px] text-leaf underline underline-offset-[3px]"
            >
              Back
            </button>
          </p>
        </div>
      )}

      {step === 'property' && (
        <div>
          <StepLabel>Three of four · what kind of property?</StepLabel>
          <div className="flex flex-wrap gap-2">
            {PROPERTY_TYPES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => {
                  setPropertyType(t.value);
                  setStep('situation');
                }}
                className="cursor-pointer rounded-full border border-[#D9D0BC] bg-cream px-4 py-2.5 text-[14px] text-forest transition hover:border-leaf hover:bg-white"
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="mt-3.5 text-[13px] text-stone-600 leading-normal">
            <button
              type="button"
              onClick={() => setStep('contact')}
              className="cursor-pointer text-[13px] text-leaf underline underline-offset-[3px]"
            >
              Back
            </button>
          </p>
        </div>
      )}

      {step === 'situation' && (
        <div>
          <StepLabel>Four of four · why are you selling?</StepLabel>
          <div className="flex flex-wrap gap-2">
            {SITUATIONS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => {
                  setSituation(s.value);
                  setSituationLabel(s.label);
                }}
                aria-pressed={situationLabel === s.label}
                className={`cursor-pointer rounded-full border px-4 py-2.5 text-[14px] transition ${
                  situationLabel === s.label
                    ? 'border-leaf bg-leaf text-white'
                    : 'border-[#D9D0BC] bg-cream text-forest hover:border-leaf hover:bg-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email — where the written offer goes"
              aria-label="Email address"
              className={INPUT}
              style={{ minWidth: 220 }}
            />
            <button
              type="button"
              className={PILL}
              disabled={sending}
              onClick={() => {
                if (!situation) {
                  setError('Pick the reason that fits best.');
                  return;
                }
                if (!/^\S+@\S+\.\S+$/.test(email)) {
                  setError(
                    'The written offer arrives by email, so we need a working address.'
                  );
                  return;
                }
                setError(null);
                void submit();
              }}
            >
              {sending ? 'Sending…' : 'Send to Kept'} <span aria-hidden>→</span>
            </button>
          </div>
          <p className="mt-3.5 text-[13px] text-stone-600 leading-normal">
            We only use these to get back to you. Your details are never sold or
            passed to anyone else.{' '}
            <button
              type="button"
              onClick={() => setStep('property')}
              className="cursor-pointer text-[13px] text-leaf underline underline-offset-[3px]"
            >
              Back
            </button>
          </p>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-[2px] border border-wax/40 bg-wax/5 p-2.5 text-[13px] text-forest">
          {error}
        </p>
      )}
    </div>
  );
}
