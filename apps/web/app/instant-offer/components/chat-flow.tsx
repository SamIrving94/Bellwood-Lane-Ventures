'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

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
  { label: 'ASAP (< 14 days)', value: 10 },
  { label: '2–4 weeks', value: 21 },
  { label: 'Flexible', value: 45 },
];

const CONDITION_LABELS: Record<number, string> = {
  1: '💀 Needs gutting',
  2: '🧱 Major works',
  3: '🛠 Significant refurb',
  4: '🔧 Dated',
  5: '🙂 Tired',
  6: '🏠 Liveable',
  7: '✨ Good condition',
  8: '💎 Very good',
  9: '🌟 Excellent',
  10: '🏆 Mint',
};

const THINKING_LINES = [
  'Verifying address via Ordnance Survey...',
  'Pulling HMLR Price Paid comps (last 24 months)...',
  'Checking EPC register...',
  'Running environmental risk model...',
  'Calculating offer...',
];

function Bubble({
  from,
  children,
}: {
  from: 'bot' | 'user';
  children: React.ReactNode;
}) {
  const isBot = from === 'bot';
  return (
    <div
      className={`flex items-start gap-3 ${isBot ? '' : 'flex-row-reverse'}`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-serif text-sm font-semibold ${
          isBot
            ? 'bg-[#C6A664] text-[#0A1020]'
            : 'bg-[#0A2540] text-white'
        }`}
      >
        {isBot ? 'B' : 'You'.charAt(0)}
      </div>
      <div
        className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm md:text-base ${
          isBot
            ? 'bg-white text-[#0A1020] shadow-sm'
            : 'bg-[#0A2540] text-white'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function Chips({
  options,
  onSelect,
}: {
  options: { label: string; value: string | number }[];
  onSelect: (v: string | number, label: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 pl-11">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onSelect(o.value, o.label)}
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm transition hover:border-[#C6A664] hover:bg-[#FAF6EA]"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function formatGBP(pence: number) {
  return `£${Math.round(pence / 100).toLocaleString('en-GB')}`;
}

export function ChatFlow() {
  const searchParams = useSearchParams();
  const referralCode = searchParams?.get('ref') || undefined;
  const [step, setStep] = useState<Step>('address');
  const [state, setState] = useState<ChatState>({
    address: '',
    postcode: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
  });
  const [history, setHistory] = useState<
    { from: 'bot' | 'user'; text: string }[]
  >([{ from: 'bot', text: 'Hi — what’s the property address?' }]);
  const [addressInput, setAddressInput] = useState('');
  const [postcodeInput, setPostcodeInput] = useState('');
  const [askingInput, setAskingInput] = useState('');
  const [thinkingProgress, setThinkingProgress] = useState(0);
  const [offer, setOffer] = useState<OfferResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [history, step]);

  const pushBot = (text: string) =>
    setHistory((h) => [...h, { from: 'bot', text }]);
  const pushUser = (text: string) =>
    setHistory((h) => [...h, { from: 'user', text }]);

  const advance = (next: Step, botPrompt: string) => {
    setStep(next);
    setTimeout(() => pushBot(botPrompt), 400);
  };

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
    pushUser(`${addr}, ${pc}`);
    advance('property_type', 'Got it. What type of property?');
  };

  const handlePropertyType = (v: string | number, label: string) => {
    setState((s) => ({ ...s, propertyType: String(v) }));
    pushUser(label);
    advance('bedrooms', 'How many bedrooms?');
  };

  const handleBedrooms = (v: string | number, label: string) => {
    setState((s) => ({ ...s, bedrooms: Number(v) }));
    pushUser(label);
    advance('role', 'Are you the agent, the seller, or someone else?');
  };

  const handleRole = (v: string | number, label: string) => {
    setState((s) => ({ ...s, role: String(v) }));
    pushUser(label);
    if (String(v) === 'agent') {
      advance('firm', 'Which firm are you with?');
    } else {
      advance('situation', 'What is the seller’s situation?');
    }
  };

  const handleFirmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const firm = (e.target as HTMLFormElement).firm.value.trim();
    if (!firm) return;
    setState((s) => ({ ...s, firmName: firm }));
    pushUser(firm);
    advance('situation', 'What is the seller’s situation?');
  };

  const handleSituation = (v: string | number, label: string) => {
    setState((s) => ({ ...s, situation: String(v) }));
    pushUser(label);
    advance('condition', 'How would you rate the condition? (1 = needs gutting, 10 = mint)');
  };

  const handleCondition = (condition: number) => {
    setState((s) => ({ ...s, condition }));
    pushUser(`${condition}/10 — ${CONDITION_LABELS[condition]}`);
    advance('urgency', 'Timeline?');
  };

  const handleUrgency = (v: string | number, label: string) => {
    setState((s) => ({ ...s, urgencyDays: Number(v) }));
    pushUser(label);
    advance('asking_price', 'Any asking price in mind? (optional — press skip)');
  };

  const handleAskingPrice = (skip: boolean) => {
    if (skip) {
      pushUser('Skip');
    } else {
      const val = askingInput.replace(/[^0-9]/g, '');
      if (!val) return;
      const pence = Number(val) * 100;
      setState((s) => ({ ...s, askingPricePence: pence }));
      pushUser(`£${Number(val).toLocaleString('en-GB')}`);
    }
    advance('contact', 'Last step — your contact details. (We only use these to send you the offer.)');
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const name = (form.contactName as HTMLInputElement).value.trim();
    const email = (form.contactEmail as HTMLInputElement).value.trim();
    const phone = (form.contactPhone as HTMLInputElement).value.trim();
    if (!name || !email) return;

    setState((s) => ({ ...s, contactName: name, contactEmail: email, contactPhone: phone }));
    pushUser(`${name} · ${email}`);
    setStep('thinking');

    // Start thinking animation
    const start = Date.now();
    let idx = 0;
    const thinkingInterval = setInterval(() => {
      idx++;
      setThinkingProgress(Math.min(idx, THINKING_LINES.length));
      if (idx >= THINKING_LINES.length) clearInterval(thinkingInterval);
    }, 800);

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
      // ensure at least 4s of thinking
      const elapsed = Date.now() - start;
      if (elapsed < 4000) {
        await new Promise((r) => setTimeout(r, 4000 - elapsed));
      }
      clearInterval(thinkingInterval);
      setThinkingProgress(THINKING_LINES.length);
      if (!res.ok) {
        setErrorMsg(data.error || 'Something went wrong');
        setStep('error');
        return;
      }
      setOffer(data);
      setStep('result');
    } catch (err) {
      clearInterval(thinkingInterval);
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

  return (
    <div className="rounded-3xl border border-slate-200 bg-[#F5F2EC] p-4 shadow-sm md:p-6">
      {/* Progress */}
      {step !== 'thinking' && step !== 'result' && step !== 'error' && (
        <div className="mb-6 flex items-center gap-1.5 px-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition ${
                i < stepNumber ? 'bg-[#C6A664]' : 'bg-slate-200'
              }`}
            />
          ))}
          <span className="ml-3 text-xs text-slate-500">
            {stepNumber} of 10
          </span>
        </div>
      )}

      {/* Chat transcript */}
      <div className="flex flex-col gap-4">
        {history.map((m, i) => (
          <Bubble key={i} from={m.from}>
            {m.text}
          </Bubble>
        ))}

        {/* Active input area */}
        {step === 'address' && (
          <form onSubmit={handleAddressSubmit} className="space-y-2 pl-11">
            <input
              autoFocus
              type="text"
              placeholder="Street address"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#C6A664]"
            />
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Postcode (e.g. M1 5AB)"
                value={postcodeInput}
                onChange={(e) => setPostcodeInput(e.target.value)}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm uppercase outline-none transition focus:border-[#C6A664]"
              />
              <button
                type="submit"
                className="rounded-xl bg-[#0A2540] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#13365c]"
              >
                Continue
              </button>
            </div>
            {errorMsg && (
              <p className="text-xs text-red-600">{errorMsg}</p>
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
          <form onSubmit={handleFirmSubmit} className="pl-11">
            <div className="flex gap-2">
              <input
                autoFocus
                name="firm"
                type="text"
                placeholder="Firm name"
                className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#C6A664]"
              />
              <button
                type="submit"
                className="rounded-xl bg-[#0A2540] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#13365c]"
              >
                Continue
              </button>
            </div>
          </form>
        )}

        {step === 'situation' && (
          <Chips options={SITUATIONS} onSelect={handleSituation} />
        )}

        {step === 'condition' && (
          <div className="pl-11">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4">
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                defaultValue={5}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  const label = (e.target.nextElementSibling as HTMLElement);
                  if (label) label.textContent = `${v}/10 — ${CONDITION_LABELS[v]}`;
                }}
                className="w-full accent-[#C6A664]"
              />
              <span className="min-w-[140px] text-right text-xs text-slate-600">
                5/10 — {CONDITION_LABELS[5]}
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              {[1, 3, 5, 7, 10].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => handleCondition(v)}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs transition hover:border-[#C6A664]"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'urgency' && (
          <Chips options={URGENCIES} onSelect={handleUrgency} />
        )}

        {step === 'asking_price' && (
          <div className="pl-11 space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">£</span>
                <input
                  type="text"
                  placeholder="Asking price (optional)"
                  value={askingInput}
                  onChange={(e) => setAskingInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-4 py-3 text-sm outline-none transition focus:border-[#C6A664]"
                />
              </div>
              <button
                type="button"
                onClick={() => handleAskingPrice(false)}
                className="rounded-xl bg-[#0A2540] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#13365c]"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={() => handleAskingPrice(true)}
                className="rounded-xl border border-slate-300 px-6 py-3 text-sm text-slate-600 transition hover:border-slate-400"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {step === 'contact' && (
          <form onSubmit={handleContactSubmit} className="space-y-2 pl-11">
            <input
              autoFocus
              name="contactName"
              type="text"
              required
              placeholder="Your name"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#C6A664]"
            />
            <input
              name="contactEmail"
              type="email"
              required
              placeholder="Email"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#C6A664]"
            />
            <input
              name="contactPhone"
              type="tel"
              placeholder="Phone (optional)"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#C6A664]"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-[#C6A664] px-6 py-3 text-sm font-medium text-[#0A1020] transition hover:bg-[#b08f52]"
            >
              Generate offer →
            </button>
          </form>
        )}

        {/* Thinking sequence */}
        {step === 'thinking' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="mb-6 text-center font-serif text-xl text-[#0A2540]">
              Crunching the numbers...
            </p>
            <ul className="space-y-3">
              {THINKING_LINES.map((line, i) => (
                <li
                  key={line}
                  className={`flex items-center gap-3 text-sm transition ${
                    i < thinkingProgress
                      ? 'text-[#0A1020]'
                      : 'text-slate-300'
                  }`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    {i < thinkingProgress ? (
                      <span className="text-[#1F6B3A]">✓</span>
                    ) : i === thinkingProgress ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#C6A664] border-t-transparent" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-slate-300" />
                    )}
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Result */}
        {step === 'result' && offer && (
          <OfferCard offer={offer} />
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="font-serif text-xl text-red-800">
              Couldn’t generate an offer right now.
            </p>
            <p className="mt-3 text-sm text-red-700">
              {errorMsg ||
                'A member of our team will email you a manual offer within 2 hours.'}
            </p>
          </div>
        )}
      </div>

      <div ref={bottomRef} />
    </div>
  );
}

function OfferCard({ offer }: { offer: OfferResult }) {
  const [accepted, setAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const handleReserve = async () => {
    setAccepting(true);
    try {
      const res = await fetch(`/api/quote/${offer.quoteId}/accept`, {
        method: 'POST',
      });
      if (res.ok) setAccepted(true);
    } finally {
      setAccepting(false);
    }
  };

  if (offer.requiresReview) {
    return (
      <div className="rounded-3xl border border-[#C6A664]/40 bg-white p-8 shadow-sm">
        <p className="text-xs uppercase tracking-widest text-[#C6A664]">
          Manual review
        </p>
        <h3 className="mt-2 font-serif text-3xl font-semibold">
          Your property needs a human look.
        </h3>
        <p className="mt-4 text-slate-600">
          Based on the details you shared, we want our senior appraiser to
          personally verify before we commit. Expect a firm written offer
          within 2 hours — no obligation.
        </p>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="rounded-3xl border border-[#1F6B3A]/30 bg-[#F0FAF3] p-8 text-center">
        <p className="font-serif text-2xl text-[#1F6B3A]">
          Offer reserved. Welcome to Bellwood.
        </p>
        <p className="mt-3 text-sm text-slate-700">
          We’ve emailed you the signed offer. Our team will be in touch within
          24 hours to start the process.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-md">
      <p className="text-xs uppercase tracking-widest text-[#C6A664]">
        Your offer is ready
      </p>
      <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <p className="text-sm text-slate-500">Market value range</p>
          <p className="mt-1 font-serif text-xl text-slate-700">
            {formatGBP(offer.estimatedMarketValueMinPence)} —{' '}
            {formatGBP(offer.estimatedMarketValueMaxPence)}
          </p>
          <p className="mt-8 text-sm text-slate-500">Our cash offer</p>
          <p className="mt-1 font-serif text-6xl font-semibold text-[#0A2540]">
            {formatGBP(offer.offerPence)}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {Math.round(offer.offerPercentOfAvm * 100)}% of AVM mid
          </p>
        </div>
        <div className="space-y-6">
          <div>
            <p className="text-sm text-slate-500">Completion</p>
            <p className="mt-1 font-serif text-2xl">
              {offer.completionDays} days
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Confidence</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-[#C6A664] transition-all"
                style={{ width: `${offer.confidenceScore * 100}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {Math.round(offer.confidenceScore * 100)}%
            </p>
          </div>
          <div className="rounded-xl bg-[#FAF6EA] px-4 py-3 text-xs text-slate-700">
            🔒 Legally binding if accepted. Locked until{' '}
            {new Date(offer.lockedUntil).toLocaleString('en-GB', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </div>
        </div>
      </div>

      <details className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <summary className="cursor-pointer text-sm font-medium">
          See the reasoning
        </summary>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          {offer.reasoning.map((line, i) => (
            <li key={i}>· {line}</li>
          ))}
        </ul>
      </details>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={handleReserve}
          disabled={accepting}
          className="flex-1 rounded-full bg-[#C6A664] px-6 py-4 text-sm font-medium text-[#0A1020] transition hover:bg-[#b08f52] disabled:opacity-50"
        >
          {accepting ? 'Reserving...' : 'Reserve this offer →'}
        </button>
        <button
          type="button"
          className="rounded-full border border-slate-300 px-6 py-4 text-sm text-slate-700 transition hover:border-slate-400"
        >
          Email me this offer
        </button>
      </div>
    </div>
  );
}
