'use client';

import type { SituationValue } from '@/lib/situations';
import { useState } from 'react';

/**
 * The situation-landing offer form — the stacked card from the Aug 2026
 * reason-page handoff. The page already knows why the seller is here, so
 * the form never asks: the situation is fixed per route and submitted with
 * the intake. Per the founder's ask (22 Aug) it captures the same pricing
 * inputs the old chat flow captured — property type, bedrooms, condition,
 * timeline, optional asking price and notes — as one-tap chips across four
 * short screens. Only address, property type, name and email are required.
 */

const PROPERTY_TYPES = [
  { label: 'Terraced', value: 'terraced_house' },
  { label: 'Semi-detached', value: 'semi_detached' },
  { label: 'Detached', value: 'detached' },
  { label: 'Flat', value: 'flat' },
  { label: 'Other', value: 'other' },
] as const;

const BEDROOMS = [
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4', value: 4 },
  { label: '5+', value: 5 },
] as const;

/** Condition on the same 1–10 scale the AVM has always consumed. */
const CONDITIONS = [
  { label: 'Excellent', value: 9 },
  { label: 'Good', value: 7 },
  { label: 'Liveable but dated', value: 5 },
  { label: 'Needs work', value: 4 },
  { label: 'Needs full renovation', value: 2 },
] as const;

const TIMELINES = [
  { label: 'As soon as possible', value: 14 },
  { label: 'One to two months', value: 45 },
  { label: 'Three months or more', value: 90 },
  { label: 'No fixed timeline', value: 0 },
] as const;

const POSTCODE_RE = /([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})/i;
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const NON_DIGITS_RE = /[^0-9]/g;

const INPUT =
  'w-full rounded-[2px] border border-[#D9D0BC] bg-cream px-4 py-3.5 text-[16px] text-forest outline-none transition focus:border-leaf focus:shadow-[0_0_0_3px_rgba(46,125,91,0.15)]';
const PILL =
  'mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-full bg-leaf px-7 py-3.5 font-semibold text-[15px] text-white transition hover:bg-leaf-dark disabled:cursor-not-allowed disabled:opacity-60';
const CHIP =
  'cursor-pointer rounded-full border px-4 py-2.5 text-[14px] transition';
const CHIP_OFF =
  'border-[#D9D0BC] bg-cream text-forest hover:border-leaf hover:bg-white';
const CHIP_ON = 'border-leaf bg-leaf text-white';

function StepLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[#8B9489] text-[10.5px] uppercase tracking-[0.2em] [font-family:var(--font-courier)]">
      {children}
    </p>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="cursor-pointer text-[13px] text-leaf underline underline-offset-[3px]"
      onClick={onClick}
      type="button"
    >
      Back
    </button>
  );
}

type Step = 'address' | 'property' | 'condition' | 'contact' | 'done';

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
  const [bedrooms, setBedrooms] = useState<number | null>(null);
  const [condition, setCondition] = useState<number | null>(null);
  const [urgencyDays, setUrgencyDays] = useState<number | null>(null);
  const [askingPrice, setAskingPrice] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setSending(true);
    setError(null);
    const m = address.match(POSTCODE_RE);
    const postcode = m ? `${m[1]} ${m[2]}`.toUpperCase() : '';
    const askingDigits = askingPrice.replace(NON_DIGITS_RE, '');
    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          postcode,
          propertyType,
          bedrooms: bedrooms ?? undefined,
          condition: condition ?? undefined,
          urgencyDays: urgencyDays || undefined,
          role: 'seller',
          situation,
          contactName: name,
          contactEmail: email,
          contactPhone: phone || undefined,
          askingPricePence: askingDigits
            ? Number(askingDigits) * 100
            : undefined,
          notes: notes.trim() || undefined,
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
      className="scroll-mt-24 rounded-[2px] border border-hair bg-white px-6 pt-6 pb-5"
      id="offer"
    >
      {step === 'address' && (
        <div>
          <StepLabel>Start with the address</StepLabel>
          <input
            aria-label="House number and postcode"
            className={INPUT}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="House number and postcode"
            type="text"
            value={address}
          />
          <button
            className={PILL}
            onClick={() => {
              if (!POSTCODE_RE.test(address)) {
                setError('We need a full UK postcode to look the property up.');
                return;
              }
              setError(null);
              setStep('property');
            }}
            type="button"
          >
            Continue <span aria-hidden>→</span>
          </button>
          <p className="mt-3.5 text-[13px] text-stone-600 leading-[1.55]">
            Three quick questions after this. Anthony reads it himself, same
            day, Monday to Friday. No figure until we&rsquo;ve stood in the
            house.
          </p>
        </div>
      )}

      {step === 'property' && (
        <div>
          <StepLabel>What kind of property?</StepLabel>
          <div className="flex flex-wrap gap-2">
            {PROPERTY_TYPES.map((t) => (
              <button
                aria-pressed={propertyType === t.value}
                className={`${CHIP} ${propertyType === t.value ? CHIP_ON : CHIP_OFF}`}
                key={t.label}
                onClick={() => setPropertyType(t.value)}
                type="button"
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="mt-4 mb-2 text-[13px] text-stone-600">
            How many bedrooms?
          </p>
          <div className="flex flex-wrap gap-2">
            {BEDROOMS.map((b) => (
              <button
                aria-pressed={bedrooms === b.value}
                className={`${CHIP} ${bedrooms === b.value ? CHIP_ON : CHIP_OFF}`}
                key={b.label}
                onClick={() => setBedrooms(b.value)}
                type="button"
              >
                {b.label}
              </button>
            ))}
          </div>
          <button
            className={PILL}
            onClick={() => {
              if (!propertyType) {
                setError('Pick the type that fits best.');
                return;
              }
              setError(null);
              setStep('condition');
            }}
            type="button"
          >
            Continue <span aria-hidden>→</span>
          </button>
          <p className="mt-3.5 text-[13px] text-stone-600 leading-[1.55]">
            <BackLink onClick={() => setStep('address')} />
          </p>
        </div>
      )}

      {step === 'condition' && (
        <div>
          <StepLabel>Condition and timing</StepLabel>
          <div className="flex flex-wrap gap-2">
            {CONDITIONS.map((c) => (
              <button
                aria-pressed={condition === c.value}
                className={`${CHIP} ${condition === c.value ? CHIP_ON : CHIP_OFF}`}
                key={c.label}
                onClick={() => setCondition(c.value)}
                type="button"
              >
                {c.label}
              </button>
            ))}
          </div>
          <p className="mt-4 mb-2 text-[13px] text-stone-600">
            How quickly does this need to move?
          </p>
          <div className="flex flex-wrap gap-2">
            {TIMELINES.map((t) => (
              <button
                aria-pressed={urgencyDays === t.value}
                className={`${CHIP} ${urgencyDays === t.value ? CHIP_ON : CHIP_OFF}`}
                key={t.label}
                onClick={() => setUrgencyDays(t.value)}
                type="button"
              >
                {t.label}
              </button>
            ))}
          </div>
          <input
            aria-label="Asking price, if it is on the market (optional)"
            className={`${INPUT} mt-4`}
            onChange={(e) => setAskingPrice(e.target.value)}
            placeholder="Asking price, if it’s on the market (optional)"
            type="text"
            value={askingPrice}
          />
          <button
            className={PILL}
            onClick={() => {
              setError(null);
              setStep('contact');
            }}
            type="button"
          >
            Continue <span aria-hidden>→</span>
          </button>
          <p className="mt-3.5 text-[13px] text-stone-600 leading-[1.55]">
            <BackLink onClick={() => setStep('property')} />
          </p>
        </div>
      )}

      {step === 'contact' && (
        <div>
          <StepLabel>Where can we reach you?</StepLabel>
          <input
            aria-label="Your name"
            className={INPUT}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            type="text"
            value={name}
          />
          <input
            aria-label="Phone"
            className={`${INPUT} mt-2.5`}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone"
            type="tel"
            value={phone}
          />
          <input
            aria-label="Email address"
            className={`${INPUT} mt-2.5`}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email, where the written offer goes"
            type="email"
            value={email}
          />
          <textarea
            aria-label="Anything we should know? (optional)"
            className={`${INPUT} mt-2.5 resize-none`}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything we should know? (optional)"
            rows={2}
            value={notes}
          />
          <button
            className={PILL}
            disabled={sending}
            onClick={() => {
              if (!name.trim()) {
                setError('A name helps us know who to ask for.');
                return;
              }
              if (!EMAIL_RE.test(email)) {
                setError(
                  'The written offer arrives by email, so we need a working address.'
                );
                return;
              }
              setError(null);
              submit();
            }}
            type="button"
          >
            {sending ? 'Sending…' : 'Send'} <span aria-hidden>→</span>
          </button>
          <p className="mt-3.5 text-[13px] text-stone-600 leading-[1.55]">
            No obligation, and no fees at any point.{' '}
            <BackLink onClick={() => setStep('condition')} />
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
