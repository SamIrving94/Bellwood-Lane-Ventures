'use client';

import type { SituationValue } from '@/lib/situations';
import { useState } from 'react';

/**
 * The situation-landing offer form — the stacked card from the Aug 2026
 * reason-page handoff. The page already knows why the seller is here, so
 * the form never asks: the situation is fixed per route and submitted with
 * the intake. The handoff designed two steps (address, contact); the
 * /api/quote contract also needs a property type and the email the written
 * offer goes to, so the contact step carries email and a property step sits
 * between — still three short screens, one question each.
 */

const PROPERTY_TYPES = [
  { label: 'Terraced', value: 'terraced_house' },
  { label: 'Semi-detached', value: 'semi_detached' },
  { label: 'Detached', value: 'detached' },
  { label: 'Flat', value: 'flat' },
  { label: 'Other', value: 'other' },
] as const;

const POSTCODE_RE = /([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})/i;

const INPUT =
  'w-full rounded-[2px] border border-[#D9D0BC] bg-cream px-4 py-3.5 text-[16px] text-forest outline-none transition focus:border-leaf focus:shadow-[0_0_0_3px_rgba(46,125,91,0.15)]';
const PILL =
  'mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-full bg-leaf px-7 py-3.5 font-semibold text-[15px] text-white transition hover:bg-leaf-dark disabled:cursor-not-allowed disabled:opacity-60';

function StepLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[#8B9489] text-[10.5px] uppercase tracking-[0.2em] [font-family:var(--font-courier)]">
      {children}
    </p>
  );
}

type Step = 'address' | 'property' | 'contact' | 'done';

export function SituationOfferForm({
  situation,
  triggerLabel,
  source,
}: {
  situation: SituationValue;
  triggerLabel: string;
  source: string;
}) {
  const [step, setStep] = useState<Step>('address');
  const [address, setAddress] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
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
          triggerLabel,
          submissionSource: source,
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

  return (
    <div
      id="offer"
      className="scroll-mt-24 rounded-[2px] border border-hair bg-white px-6 pt-6 pb-5"
    >
      {step === 'address' && (
        <div>
          <StepLabel>Start with the address</StepLabel>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="House number and postcode"
            aria-label="House number and postcode"
            className={INPUT}
          />
          <button
            type="button"
            className={PILL}
            onClick={() => {
              if (!POSTCODE_RE.test(address)) {
                setError('We need a full UK postcode to look the property up.');
                return;
              }
              setError(null);
              setStep('property');
            }}
          >
            Continue <span aria-hidden>→</span>
          </button>
          <p className="mt-3.5 text-[13px] text-stone-600 leading-[1.55]">
            Two questions after this. Anthony reads it himself, same day, Monday
            to Friday. No figure until we&rsquo;ve stood in the house.
          </p>
        </div>
      )}

      {step === 'property' && (
        <div>
          <StepLabel>What kind of property?</StepLabel>
          <div className="flex flex-wrap gap-2">
            {PROPERTY_TYPES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => {
                  setPropertyType(t.value);
                  setError(null);
                  setStep('contact');
                }}
                className="cursor-pointer rounded-full border border-[#D9D0BC] bg-cream px-4 py-2.5 text-[14px] text-forest transition hover:border-leaf hover:bg-white"
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="mt-3.5 text-[13px] text-stone-600 leading-[1.55]">
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

      {step === 'contact' && (
        <div>
          <StepLabel>Where can we reach you?</StepLabel>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            aria-label="Your name"
            className={INPUT}
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone"
            aria-label="Phone"
            className={`${INPUT} mt-2.5`}
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email, where the written offer goes"
            aria-label="Email address"
            className={`${INPUT} mt-2.5`}
          />
          <button
            type="button"
            className={PILL}
            disabled={sending}
            onClick={() => {
              if (!name.trim()) {
                setError('A name helps us know who to ask for.');
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
            {sending ? 'Sending…' : 'Send'} <span aria-hidden>→</span>
          </button>
          <p className="mt-3.5 text-[13px] text-stone-600 leading-[1.55]">
            No obligation, and no fees at any point.{' '}
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

      {step === 'done' && (
        <div>
          <StepLabel>Enquiry received</StepLabel>
          <p className="font-semibold font-serif text-[19px] text-forest">
            Thank you. We will be in touch.
          </p>
          <p className="mt-2.5 text-[13.5px] text-stone-600 leading-relaxed">
            One of us will come back to you the same day, Monday to Friday, to
            talk through your situation and arrange a time to come and see the
            property. No figure until we&rsquo;ve stood in the house; once we
            have, your written offer follows within two working days.
          </p>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-[2px] border border-wax/40 bg-wax/5 p-2.5 text-[13px] text-forest">
          {error}
        </p>
      )}

      <p className="mt-4 border-[#EFE9DB] border-t pt-4 font-serif text-[12.5px] text-stone-500 leading-[1.6]">
        Property Redress Scheme &middot; HMRC AML supervised &middot; ICO
        registered
      </p>
    </div>
  );
}
