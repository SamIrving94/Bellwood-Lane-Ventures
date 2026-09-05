'use client';

import { type ReactNode, useState } from 'react';

/**
 * The homepage offer form — five short steps. The Aug 2026 handoff designed
 * the first two; the founder then asked (22 Aug) that the form keep
 * capturing everything the old chat flow captured for pricing, so the AVM
 * and the triage see the same inputs as before: property type, bedrooms,
 * condition, timeline, situation, optional asking price and notes, and the
 * contact details last. Every step is one screen of taps; nothing except
 * address, property type, situation, name and email is required.
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
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const NON_DIGITS_RE = /[^0-9]/g;

const INPUT =
  'min-w-0 flex-1 rounded-[2px] border border-[#D9D0BC] bg-cream px-4 py-3.5 text-[16px] text-forest outline-none transition focus:border-leaf focus:shadow-[0_0_0_3px_rgba(46,125,91,0.15)]';
const PILL =
  'inline-flex shrink-0 cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-full bg-leaf px-7 py-3.5 font-semibold text-[15px] text-white transition hover:bg-leaf-dark disabled:cursor-not-allowed disabled:opacity-60';
const CHIP =
  'cursor-pointer rounded-full border px-4 py-2.5 text-[14px] transition';
const CHIP_OFF =
  'border-[#D9D0BC] bg-cream text-forest hover:border-leaf hover:bg-white';
const CHIP_ON = 'border-leaf bg-leaf text-white';

/** Courier step label. `short` is the phone wording: the full label runs to
 *  36 tracked characters, which wraps onto two lines inside the 294px card
 *  at 390px and put a second line of type above the address field on the
 *  first screen (Sep 2026 mobile review). Below `sm` the short form shows. */
function StepLabel({
  children,
  short,
}: {
  children: ReactNode;
  short?: ReactNode;
}) {
  return (
    <p className="mb-2.5 text-[#8B9489] text-[10.5px] uppercase tracking-[0.2em] [font-family:var(--font-courier)]">
      {short ? (
        <>
          <span className="sm:hidden">{short}</span>
          <span className="hidden sm:inline">{children}</span>
        </>
      ) : (
        children
      )}
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

type Step =
  | 'address'
  | 'property'
  | 'condition'
  | 'situation'
  | 'contact'
  | 'done';

export function OfferForm() {
  const [step, setStep] = useState<Step>('address');
  const [address, setAddress] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [bedrooms, setBedrooms] = useState<number | null>(null);
  const [condition, setCondition] = useState<number | null>(null);
  const [urgencyDays, setUrgencyDays] = useState<number | null>(null);
  const [situation, setSituation] = useState('');
  const [situationLabel, setSituationLabel] = useState('');
  const [askingPrice, setAskingPrice] = useState('');
  const [notes, setNotes] = useState('');
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
        className="scroll-mt-24 rounded-[2px] border border-leaf/40 bg-white p-6"
        id="offer"
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
      className="scroll-mt-24 rounded-[2px] border border-hair bg-white px-6 pt-5.5 pb-5"
      id="offer"
    >
      {step === 'address' && (
        <div>
          <StepLabel short="1 of 5 · the address">
            One of five · start with the address
          </StepLabel>
          <div className="flex flex-wrap gap-3">
            <input
              aria-label="House number and postcode"
              className={INPUT}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="House number and postcode"
              style={{ minWidth: 210 }}
              type="text"
              value={address}
            />
            <button
              className={PILL}
              onClick={() => {
                if (!POSTCODE_RE.test(address)) {
                  setError(
                    'We need a full UK postcode to look the property up.'
                  );
                  return;
                }
                setError(null);
                setStep('property');
              }}
              type="button"
            >
              Continue <span aria-hidden>→</span>
            </button>
          </div>
          <p className="mt-3.5 text-[13px] text-stone-600 leading-normal">
            Four quick questions after this. No figure until we&rsquo;ve stood
            in the house.
          </p>
        </div>
      )}

      {step === 'property' && (
        <div>
          <StepLabel short="2 of 5 · the property">
            Two of five · what kind of property?
          </StepLabel>
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
          <div className="mt-4 flex items-center gap-4">
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
            <BackLink onClick={() => setStep('address')} />
          </div>
        </div>
      )}

      {step === 'condition' && (
        <div>
          <StepLabel short="3 of 5 · condition and timing">
            Three of five · condition and timing
          </StepLabel>
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
          <div className="mt-4 flex items-center gap-4">
            <button
              className={PILL}
              onClick={() => {
                setError(null);
                setStep('situation');
              }}
              type="button"
            >
              Continue <span aria-hidden>→</span>
            </button>
            <BackLink onClick={() => setStep('property')} />
          </div>
        </div>
      )}

      {step === 'situation' && (
        <div>
          <StepLabel short="4 of 5 · why you’re selling">
            Four of five · why are you selling?
          </StepLabel>
          <div className="flex flex-wrap gap-2">
            {SITUATIONS.map((s) => (
              <button
                aria-pressed={situationLabel === s.label}
                className={`${CHIP} ${situationLabel === s.label ? CHIP_ON : CHIP_OFF}`}
                key={s.label}
                onClick={() => {
                  setSituation(s.value);
                  setSituationLabel(s.label);
                }}
                type="button"
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <input
              aria-label="Asking price, if it is on the market (optional)"
              className={INPUT}
              onChange={(e) => setAskingPrice(e.target.value)}
              placeholder="Asking price, if it’s on the market (optional)"
              style={{ minWidth: 220 }}
              type="text"
              value={askingPrice}
            />
          </div>
          <textarea
            aria-label="Anything we should know? (optional)"
            className={`${INPUT} mt-3 w-full resize-none`}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything we should know? (optional)"
            rows={2}
            value={notes}
          />
          <div className="mt-3 flex items-center gap-4">
            <button
              className={PILL}
              onClick={() => {
                if (!situation) {
                  setError('Pick the reason that fits best.');
                  return;
                }
                setError(null);
                setStep('contact');
              }}
              type="button"
            >
              Continue <span aria-hidden>→</span>
            </button>
            <BackLink onClick={() => setStep('condition')} />
          </div>
        </div>
      )}

      {step === 'contact' && (
        <div>
          <StepLabel short="5 of 5 · how to reach you">
            Five of five · where can we reach you?
          </StepLabel>
          <div className="flex flex-wrap gap-3">
            <input
              aria-label="Your name"
              className={INPUT}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              style={{ minWidth: 140 }}
              type="text"
              value={name}
            />
            <input
              aria-label="Phone"
              className={INPUT}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone"
              style={{ minWidth: 140 }}
              type="tel"
              value={phone}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <input
              aria-label="Email address"
              className={INPUT}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email, where the written offer goes"
              style={{ minWidth: 220 }}
              type="email"
              value={email}
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
              {sending ? 'Sending…' : 'Send to Kept'} <span aria-hidden>→</span>
            </button>
          </div>
          <p className="mt-3.5 text-[13px] text-stone-600 leading-normal">
            A real person reads it. Same-day response, Monday to Friday. We only
            use these to get back to you; your details are never sold or passed
            to anyone else. <BackLink onClick={() => setStep('situation')} />
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
