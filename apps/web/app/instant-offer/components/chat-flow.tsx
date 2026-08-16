'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * The offer enquiry — a Kept document being filled in, not a chatbot.
 *
 * The old version was a chat: avatars, bubbles, a fake "thinking" delay.
 * DESIGN.md lists all three as template tells. This version keeps the exact
 * same step machine and /api/quote contract, but renders as a paper form:
 * answered questions accumulate as courier ledger rows with dotted leaders,
 * the current question is a serif prompt, and the research checklist runs
 * only as long as the real API call does — no theatre.
 */

type Step =
  | 'address'
  | 'property_type'
  | 'bedrooms'
  | 'role'
  | 'firm'
  | 'situation'
  | 'condition'
  | 'urgency'
  | 'asking_price'
  | 'contact'
  | 'thinking'
  | 'result'
  | 'error';

type ChatState = {
  address: string;
  postcode: string;
  propertyType?: string;
  bedrooms?: number;
  role?: string;
  firmName?: string;
  situation?: string;
  condition?: number;
  urgencyDays?: number;
  askingPricePence?: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

type OfferResult = {
  quoteId: string;
  estimatedMarketValueMinPence: number;
  estimatedMarketValueMaxPence: number;
  offerPence: number;
  offerPercentOfAvm: number;
  confidenceScore: number;
  completionDays: number;
  reasoning: string[];
  lockedUntil: string;
  requiresReview: boolean;
  trackUrl?: string | null;
  agentAccount?: {
    referralCode: string;
    contactName: string;
    firmName: string;
  } | null;
};

const PROPERTY_TYPES = [
  { label: 'Terraced', value: 'terraced_house' },
  { label: 'Semi-detached', value: 'semi_detached' },
  { label: 'Detached', value: 'detached' },
  { label: 'Flat', value: 'flat' },
  { label: 'Other', value: 'other' },
];

const ROLES = [
  { label: 'Estate agent', value: 'agent' },
  { label: 'Seller', value: 'seller' },
  { label: 'Solicitor', value: 'solicitor' },
  { label: 'Other', value: 'other' },
];

const SITUATIONS = [
  { label: 'Probate', value: 'probate' },
  { label: 'Chain break', value: 'chain_break' },
  { label: 'Repossession', value: 'repossession' },
  { label: 'Relocation', value: 'relocation' },
  { label: 'Short lease', value: 'short_lease' },
  { label: 'Problem property', value: 'problem_property' },
  { label: 'Other', value: 'other' },
];

const URGENCIES = [
  { label: 'ASAP, chain at risk', value: 10 },
  { label: 'A few weeks', value: 21 },
  { label: 'Flexible', value: 45 },
];

const CONDITION_LABELS: Record<number, string> = {
  1: 'Needs gutting',
  2: 'Major works',
  3: 'Significant refurb',
  4: 'Dated',
  5: 'Tired',
  6: 'Liveable',
  7: 'Good condition',
  8: 'Very good',
  9: 'Excellent',
  10: 'Mint',
};

/* The research steps shown while the real API call runs. Each line is work
 * the quote engine genuinely does; the list advances on a timer but the
 * form only moves on when the actual response arrives. */
const RESEARCH_LINES = [
  'Verifying address via Ordnance Survey',
  'Pulling HMLR Price Paid comps (last 24 months)',
  'Checking EPC register',
  'Running environmental risk model',
  'Calculating offer',
];

/* The question asked at each step, rendered as a serif prompt line. */
const QUESTIONS: Partial<Record<Step, string>> = {
  address: "What's the property address?",
  property_type: 'What type of property is it?',
  bedrooms: 'How many bedrooms?',
  role: 'Are you the agent, the seller, or someone else?',
  firm: 'Which firm are you with?',
  situation: "What's the seller's situation?",
  condition: 'How would you rate the condition?',
  urgency: 'How quickly does this need to move?',
  asking_price: 'Any asking price in mind? Optional.',
  contact: 'Where should we send the offer?',
};

function formatGBP(pence: number) {
  return `£${Math.round(pence / 100).toLocaleString('en-GB')}`;
}

/* ——— Document primitives ——— */

/** Courier label in the letter's small-caps texture. */
function DocLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10.5px] text-stone-400 tracking-[0.08em] [font-family:var(--font-courier)]">
      {children}
    </p>
  );
}

/** One completed answer: courier label, dotted leader, value. */
function LedgerRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 text-[12.5px] [font-family:var(--font-courier)]">
      <dt className="shrink-0 text-stone-500">{label}</dt>
      <span
        aria-hidden
        className="mb-[3px] min-w-4 flex-1 border-stone-400/50 border-b border-dotted"
      />
      <dd className="shrink-0 max-w-[60%] text-right text-forest">{value}</dd>
    </div>
  );
}

/** Choice pills — hairline-bordered, leaf on select. */
function Chips({
  options,
  onSelect,
}: {
  options: { label: string; value: string | number }[];
  onSelect: (v: string | number, label: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onSelect(o.value, o.label)}
          className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:border-leaf hover:bg-soft"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const INPUT =
  'w-full rounded-md border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-leaf';
const SUBMIT =
  'rounded-full bg-leaf px-6 py-3 font-semibold text-sm text-white transition hover:bg-leaf-dark disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Whether a generated figure is ever shown on screen.
 *
 * Founder decision, Aug 2026: no. Until the AVM has earned more trust, every
 * offer is reviewed by a person and sent by email — nobody sees a number on
 * this page. The quote is still generated and stored behind the scenes (the
 * team needs it, and it is how the AVM gets graded), so flipping this back to
 * `true` restores the on-screen offer with no other change.
 */
const SHOW_ONSCREEN_OFFER = false;

/** What a seller sees once we have their details: an acknowledgement and a
 *  promise to come back to them — never a figure. */
function EnquiryReceived() {
  return (
    <div className="rounded-[2px] border border-leaf/40 bg-soft p-6">
      <DocLabel>ENQUIRY RECEIVED</DocLabel>
      <h3 className="mt-2 font-semibold font-serif text-2xl text-forest">
        Thank you — we will be in touch.
      </h3>
      <div className="mt-3 space-y-3 text-sm text-stone-700 leading-relaxed">
        <p>
          We have everything we need to start. One of us will come back to you
          the same day, Monday to Friday, to talk through your situation and
          arrange a time to come and see the property.
        </p>
        <p>
          We do not put a price on a home we have not stood in. Once we have
          viewed it, we aim to send our offer in writing within 24 to 48 hours
          — held for 72 hours, with no obligation on you at all.
        </p>
      </div>
    </div>
  );
}

type ChatFlowProps = {
  /** Pre-set the role so the role question is skipped. */
  defaultRole?: 'agent' | 'seller';
};

export function ChatFlow({ defaultRole }: ChatFlowProps = {}) {
  const searchParams = useSearchParams();
  const referralCode = searchParams?.get('ref') || undefined;
  const [step, setStep] = useState<Step>('address');
  const [state, setState] = useState<ChatState>({
    address: '',
    postcode: '',
    role: defaultRole,
    contactName: '',
    contactEmail: '',
    contactPhone: '',
  });
  const [addressInput, setAddressInput] = useState('');
  const [postcodeInput, setPostcodeInput] = useState('');
  const [askingInput, setAskingInput] = useState('');
  const [askingSkipped, setAskingSkipped] = useState(false);
  const [conditionInput, setConditionInput] = useState(5);
  const [researchProgress, setResearchProgress] = useState(0);
  const [offer, setOffer] = useState<OfferResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const didMount = useRef(false);

  useEffect(() => {
    // Never scroll on first mount — it hijacks the page load and dumps the
    // visitor mid-page before they've seen the hero. Only follow the form
    // once the visitor is actually in it, and only within the nearest
    // scrollable ancestor rather than yanking the whole document.
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [step]);

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const addr = addressInput.trim();
    const pc = postcodeInput.trim().toUpperCase();
    if (!addr || !pc) return;
    // simple UK postcode regex
    if (!/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(pc)) {
      setErrorMsg('Please enter a valid UK postcode (e.g. M1 5AB)');
      return;
    }
    setErrorMsg(null);
    setState((s) => ({ ...s, address: addr, postcode: pc }));
    setStep('property_type');
  };

  const handlePropertyType = (v: string | number) => {
    setState((s) => ({ ...s, propertyType: String(v) }));
    setStep('bedrooms');
  };

  const handleBedrooms = (v: string | number) => {
    setState((s) => ({ ...s, bedrooms: Number(v) }));
    // If the audience is pre-set (came from /agents or /sell), skip the
    // role question.
    if (defaultRole === 'agent') {
      setStep('firm');
    } else if (defaultRole === 'seller') {
      setStep('situation');
    } else {
      setStep('role');
    }
  };

  const handleRole = (v: string | number) => {
    setState((s) => ({ ...s, role: String(v) }));
    setStep(String(v) === 'agent' ? 'firm' : 'situation');
  };

  const handleFirmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const firm = (e.target as HTMLFormElement).firm.value.trim();
    if (!firm) return;
    setState((s) => ({ ...s, firmName: firm }));
    setStep('situation');
  };

  const handleSituation = (v: string | number) => {
    setState((s) => ({ ...s, situation: String(v) }));
    setStep('condition');
  };

  const handleCondition = (condition: number) => {
    setState((s) => ({ ...s, condition }));
    setStep('urgency');
  };

  const handleUrgency = (v: string | number) => {
    setState((s) => ({ ...s, urgencyDays: Number(v) }));
    setStep('asking_price');
  };

  const handleAskingPrice = (skip: boolean) => {
    if (skip) {
      setAskingSkipped(true);
    } else {
      const val = askingInput.replace(/[^0-9]/g, '');
      if (!val) return;
      const pence = Number(val) * 100;
      setState((s) => ({ ...s, askingPricePence: pence }));
    }
    setStep('contact');
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const name = (form.contactName as HTMLInputElement).value.trim();
    const email = (form.contactEmail as HTMLInputElement).value.trim();
    const phone = (form.contactPhone as HTMLInputElement).value.trim();
    if (!name || !email) return;

    setState((s) => ({
      ...s,
      contactName: name,
      contactEmail: email,
      contactPhone: phone,
    }));
    setStep('thinking');

    // Tick the research lines while the request is genuinely in flight.
    // No minimum duration: the moment the engine answers, we show the
    // result. (The old 4-second floor was theatre — DESIGN.md bans it.)
    let idx = 0;
    const ticker = setInterval(() => {
      idx++;
      setResearchProgress(Math.min(idx, RESEARCH_LINES.length - 1));
    }, 700);

    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...state,
          contactName: name,
          contactEmail: email,
          contactPhone: phone,
          referralCode,
        }),
      });
      const data = await res.json();
      clearInterval(ticker);
      setResearchProgress(RESEARCH_LINES.length);
      if (!res.ok) {
        setErrorMsg(data.error || 'Something went wrong');
        setStep('error');
        return;
      }
      setOffer(data);
      setStep('result');
    } catch {
      clearInterval(ticker);
      setErrorMsg('Could not reach the offer engine. Please try again.');
      setStep('error');
    }
  };

  const stepNumber = (() => {
    const order: Step[] = [
      'address',
      'property_type',
      'bedrooms',
      'role',
      'firm',
      'situation',
      'condition',
      'urgency',
      'asking_price',
      'contact',
    ];
    const idx = order.indexOf(step);
    return idx >= 0 ? idx + 1 : 10;
  })();

  /* The ledger: everything answered so far, derived from state. */
  const ledger: Array<[string, string]> = [];
  if (state.address) {
    ledger.push(['Property', `${state.address}, ${state.postcode}`]);
  }
  if (state.propertyType) {
    ledger.push([
      'Type',
      PROPERTY_TYPES.find((t) => t.value === state.propertyType)?.label ??
        state.propertyType,
    ]);
  }
  if (state.bedrooms) {
    ledger.push(['Bedrooms', String(state.bedrooms)]);
  }
  if (state.role && !defaultRole) {
    ledger.push([
      'You are',
      ROLES.find((r) => r.value === state.role)?.label ?? state.role,
    ]);
  }
  if (state.firmName) {
    ledger.push(['Firm', state.firmName]);
  }
  if (state.situation) {
    ledger.push([
      'Situation',
      SITUATIONS.find((s) => s.value === state.situation)?.label ??
        state.situation,
    ]);
  }
  if (state.condition) {
    ledger.push([
      'Condition',
      `${state.condition}/10 · ${CONDITION_LABELS[state.condition]}`,
    ]);
  }
  if (state.urgencyDays) {
    ledger.push([
      'Timeline',
      URGENCIES.find((u) => u.value === state.urgencyDays)?.label ??
        `${state.urgencyDays} days`,
    ]);
  }
  if (state.askingPricePence) {
    ledger.push(['Asking price', formatGBP(state.askingPricePence)]);
  } else if (askingSkipped) {
    ledger.push(['Asking price', 'Not given']);
  }

  const inFlow = step !== 'thinking' && step !== 'result' && step !== 'error';

  return (
    <div className="rounded-[2px] border border-hair bg-[linear-gradient(175deg,#fdfaf2_0%,#f7f2e6_70%,#f3edde_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(36,28,26,0.08),0_24px_48px_-28px_rgba(36,28,26,0.4)] md:p-8">
      {/* Document header */}
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-bold font-serif text-[15px] text-brand-deep">
          Kept
        </p>
        <p className="text-[10.5px] text-stone-400 [font-family:var(--font-courier)]">
          Offer enquiry
        </p>
      </div>
      {inFlow && (
        <div className="mt-3 flex items-center gap-3">
          <div className="h-px flex-1 bg-hair">
            <div
              className="h-px bg-leaf transition-all duration-300"
              style={{ width: `${(stepNumber / 10) * 100}%` }}
            />
          </div>
          <p className="shrink-0 text-[10.5px] text-stone-400 [font-family:var(--font-courier)]">
            {stepNumber} of 10
          </p>
        </div>
      )}

      {/* The ledger of answers so far */}
      {ledger.length > 0 && inFlow && (
        <dl className="mt-5 space-y-2 border-stone-300/60 border-t border-dashed pt-4">
          {ledger.map(([label, value]) => (
            <LedgerRow key={label} label={label} value={value} />
          ))}
        </dl>
      )}

      {/* The current question + its input */}
      {inFlow && (
        <div className="mt-6 border-stone-300/60 border-t border-dashed pt-5">
          <p className="font-serif text-[17px] text-forest">
            {QUESTIONS[step]}
          </p>
          <div className="mt-4">
            {step === 'address' && (
              <form onSubmit={handleAddressSubmit} className="space-y-2">
                <input
                  type="text"
                  placeholder="Street address"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  className={INPUT}
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Postcode (e.g. M1 5AB)"
                    value={postcodeInput}
                    onChange={(e) => setPostcodeInput(e.target.value)}
                    className={`${INPUT} flex-1 uppercase placeholder:normal-case`}
                  />
                  <button type="submit" className={SUBMIT}>
                    Continue
                  </button>
                </div>
                {errorMsg && (
                  <p className="text-[12px] text-wax">{errorMsg}</p>
                )}
              </form>
            )}

            {step === 'property_type' && (
              <Chips options={PROPERTY_TYPES} onSelect={handlePropertyType} />
            )}

            {step === 'bedrooms' && (
              <Chips
                options={[1, 2, 3, 4, 5].map((n) => ({
                  label: n === 5 ? '5+' : String(n),
                  value: n,
                }))}
                onSelect={handleBedrooms}
              />
            )}

            {step === 'role' && <Chips options={ROLES} onSelect={handleRole} />}

            {step === 'firm' && (
              <form onSubmit={handleFirmSubmit} className="flex gap-2">
                <input
                  autoFocus
                  name="firm"
                  type="text"
                  placeholder="Firm name"
                  className={`${INPUT} flex-1`}
                />
                <button type="submit" className={SUBMIT}>
                  Continue
                </button>
              </form>
            )}

            {step === 'situation' && (
              <Chips options={SITUATIONS} onSelect={handleSituation} />
            )}

            {step === 'condition' && (
              <div>
                <div className="flex items-center gap-3 rounded-md border border-stone-300 bg-white p-4">
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={conditionInput}
                    onChange={(e) => setConditionInput(Number(e.target.value))}
                    className="w-full accent-leaf"
                  />
                  <span className="min-w-[150px] text-right text-[12px] text-stone-600 [font-family:var(--font-courier)]">
                    {conditionInput}/10 · {CONDITION_LABELS[conditionInput]}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCondition(conditionInput)}
                  className={`${SUBMIT} mt-3`}
                >
                  Continue
                </button>
              </div>
            )}

            {step === 'urgency' && (
              <Chips options={URGENCIES} onSelect={handleUrgency} />
            )}

            {step === 'asking_price' && (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="-translate-y-1/2 absolute top-1/2 left-4 text-stone-400">
                    £
                  </span>
                  <input
                    type="text"
                    placeholder="Asking price (optional)"
                    value={askingInput}
                    onChange={(e) => setAskingInput(e.target.value)}
                    className={`${INPUT} py-3 pr-4 pl-8`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleAskingPrice(false)}
                  className={SUBMIT}
                >
                  Continue
                </button>
                <button
                  type="button"
                  onClick={() => handleAskingPrice(true)}
                  className="rounded-full border border-stone-300 px-6 py-3 text-sm text-stone-600 transition hover:border-stone-400"
                >
                  Skip
                </button>
              </div>
            )}

            {step === 'contact' && (
              <form onSubmit={handleContactSubmit} className="space-y-2">
                <input
                  autoFocus
                  name="contactName"
                  type="text"
                  required
                  placeholder="Your name"
                  className={INPUT}
                />
                <input
                  name="contactEmail"
                  type="email"
                  required
                  placeholder="Email"
                  className={INPUT}
                />
                <input
                  name="contactPhone"
                  type="tel"
                  placeholder="Phone (optional)"
                  className={INPUT}
                />
                <p className="text-[12px] text-stone-500">
                  We only use these to get back to you. Your details are never
                  sold or passed to anyone else.
                </p>
                <button type="submit" className={`${SUBMIT} w-full`}>
                  Send this to Kept →
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Research in progress — runs exactly as long as the real request */}
      {step === 'thinking' && (
        <div className="mt-6 border-stone-300/60 border-t border-dashed pt-5">
          <DocLabel>RESEARCH IN PROGRESS</DocLabel>
          <ul className="mt-4 space-y-2.5">
            {RESEARCH_LINES.map((line, i) => (
              <li
                key={line}
                className={`flex items-baseline gap-2 text-[12.5px] transition [font-family:var(--font-courier)] ${
                  i <= researchProgress ? 'text-forest' : 'text-stone-300'
                }`}
              >
                <span className="w-7 shrink-0">
                  {i < researchProgress ? 'OK' : i === researchProgress ? '···' : ''}
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Result. While SHOW_ONSCREEN_OFFER is false we still generate and
          store the quote — the AVM runs, the figure is logged, the team gets
          it — but nothing is put in front of the seller until a person has
          reviewed it and sent it by email. */}
      {step === 'result' && offer && (
        <div className="mt-6">
          {SHOW_ONSCREEN_OFFER ? (
            <OfferCard offer={offer} />
          ) : (
            <EnquiryReceived />
          )}
        </div>
      )}

      {/* Error */}
      {step === 'error' && (
        <div className="mt-6 rounded-[2px] border border-wax/40 bg-wax/5 p-6">
          <p className="font-serif text-[17px] text-forest">
            We couldn&rsquo;t generate an offer just now.
          </p>
          <p className="mt-2 text-sm text-stone-600">
            {errorMsg ||
              'A member of our team will email you a manual offer shortly.'}
          </p>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

function OfferCard({ offer }: { offer: OfferResult }) {
  const [accepted, setAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  // Accepting is gated on the private track token. We hold it here because the
  // same response that produced this card carried the track link.
  const trackToken = offer.trackUrl
    ? (offer.trackUrl.split('/track/')[1]?.split(/[?#]/)[0] ?? null)
    : null;

  const handleReserve = async () => {
    setAccepting(true);
    setAcceptError(null);
    try {
      const res = await fetch(`/api/quote/${offer.quoteId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: trackToken ?? undefined }),
      });
      if (res.ok) {
        setAccepted(true);
        return;
      }
      const data = await res.json().catch(() => null);
      setAcceptError(
        data?.error ??
          'We could not reserve this offer just now. Please email us and we will confirm it by hand.'
      );
    } catch {
      setAcceptError(
        'We could not reach our servers. Please email us and we will confirm it by hand.'
      );
    } finally {
      setAccepting(false);
    }
  };

  if (offer.requiresReview) {
    return (
      <div className="rounded-[2px] border border-leaf/40 bg-white p-6">
        <DocLabel>MANUAL REVIEW</DocLabel>
        <h3 className="mt-2 font-semibold font-serif text-2xl">
          Your property needs a human look.
        </h3>
        <p className="mt-3 text-sm text-stone-600">
          Based on the details you shared, we want our senior appraiser to
          personally verify before we commit. Expect a firm written offer by
          email, no obligation.
        </p>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="rounded-[2px] border border-leaf/40 bg-soft p-6 text-center">
        <p className="font-serif text-2xl text-leaf-dark">
          Offer reserved. Welcome to Kept.
        </p>
        <p className="mt-3 text-sm text-stone-700">
          We&rsquo;ve emailed you the signed offer. Our team will be in touch
          to start the process.
        </p>
      </div>
    );
  }

  return (
    <div className="border-stone-300/60 border-t border-dashed pt-5">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <DocLabel>MARKET VALUE RANGE</DocLabel>
          <p className="mt-1 font-serif text-stone-700 text-xl">
            {formatGBP(offer.estimatedMarketValueMinPence)} to{' '}
            {formatGBP(offer.estimatedMarketValueMaxPence)}
          </p>
          <div className="mt-6">
            <p className="text-[10.5px] text-brand tracking-[0.08em] [font-family:var(--font-courier)]">
              OUR CASH OFFER
            </p>
            <p className="mt-1 font-bold font-serif text-6xl text-forest tracking-[-0.02em]">
              {formatGBP(offer.offerPence)}
            </p>
            <p className="mt-2 text-[12px] text-stone-500">
              A price that reflects the speed and certainty of the transaction
            </p>
          </div>
        </div>
        <div className="space-y-5">
          <div>
            <DocLabel>COMPLETION</DocLabel>
            <p className="mt-1 font-serif text-2xl">
              {offer.completionDays} days
            </p>
          </div>
          <div>
            <DocLabel>CONFIDENCE</DocLabel>
            <div className="mt-2 h-px w-full bg-hair">
              <div
                className="h-px bg-leaf transition-all"
                style={{ width: `${offer.confidenceScore * 100}%` }}
              />
            </div>
            <p className="mt-1 text-[12px] text-stone-500">
              {Math.round(offer.confidenceScore * 100)}%
            </p>
          </div>
          <p className="inline-block rotate-[-1.5deg] border border-wax/60 px-2 py-0.5 text-[10px] text-wax tracking-[0.14em] [font-family:var(--font-courier)]">
            LOCKED UNTIL{' '}
            {new Date(offer.lockedUntil)
              .toLocaleString('en-GB', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })
              .toUpperCase()}
          </p>
          <p className="text-[12px] text-stone-500">
            Binding on Kept if accepted.
          </p>
        </div>
      </div>

      <details className="mt-6 border-stone-300/60 border-t border-dashed pt-4">
        <summary className="cursor-pointer font-serif text-[14px] text-stone-600 hover:text-forest">
          See the reasoning
        </summary>
        <ul className="mt-3 space-y-2 text-[12.5px] text-stone-600 [font-family:var(--font-courier)]">
          {offer.reasoning.map((line) => (
            <li key={line}>· {line}</li>
          ))}
        </ul>
      </details>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={handleReserve}
          disabled={accepting}
          className="flex-1 rounded-full bg-leaf px-6 py-3.5 font-semibold text-sm text-white transition hover:bg-leaf-dark disabled:opacity-50"
        >
          {accepting ? 'Reserving...' : 'Reserve this offer →'}
        </button>
        <a
          href={`/instant-offer/offer/${offer.quoteId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-stone-300 px-6 py-3.5 text-center text-sm text-stone-700 transition hover:border-stone-400"
        >
          View certificate
        </a>
      </div>

      {acceptError && (
        <p className="mt-3 rounded-[2px] border border-wax/40 bg-wax/5 p-3 text-forest text-sm">
          {acceptError}
        </p>
      )}

      {offer.trackUrl && (
        <div className="mt-5 border-stone-300/60 border-t border-dashed pt-4">
          <DocLabel>LIVE TIMELINE</DocLabel>
          <p className="mt-2 text-sm text-stone-700">
            Bookmark this URL. Every party in the chain sees the same updates
            here, no login required.
          </p>
          <a
            href={offer.trackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block break-all text-[12px] text-leaf underline underline-offset-4 [font-family:var(--font-courier)]"
          >
            {offer.trackUrl}
          </a>
        </div>
      )}

      {offer.agentAccount && <AgentReferralCard account={offer.agentAccount} />}
    </div>
  );
}

function AgentReferralCard({
  account,
}: {
  account: { referralCode: string; contactName: string; firmName: string };
}) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const link = `${origin}/partners/${account.referralCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mt-6 border-stone-300/60 border-t border-dashed pt-4">
      <p className="font-semibold font-serif text-forest text-lg">
        Your referral is logged.
      </p>
      <p className="mt-1 text-sm text-stone-700">
        Every seller you send to the link below is credited to{' '}
        <strong>{account.firmName}</strong> automatically. Partner fee agreed
        in writing per deal. No signup. Just bookmark and share.
      </p>

      <div className="mt-4">
        <DocLabel>YOUR PERSONAL REFERRAL LINK</DocLabel>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            readOnly
            value={link}
            className="flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-[12px] text-forest [font-family:var(--font-courier)]"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-full bg-leaf px-4 py-2 font-semibold text-white text-xs transition hover:bg-leaf-dark"
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
        <p className="mt-2 text-[12px] text-stone-500">
          Referral code:{' '}
          <span className="font-semibold text-forest [font-family:var(--font-courier)]">
            {account.referralCode}
          </span>
        </p>
      </div>

      <a
        href="/partners/login"
        className="mt-4 inline-block text-stone-600 text-xs underline underline-offset-4 hover:text-leaf"
      >
        Want a full dashboard of your referrals, deal stages, and partner-fee
        status? Claim your account →
      </a>
    </div>
  );
}
