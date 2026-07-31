'use client';

import { Eyebrow } from '@/components/brand';
import { useState } from 'react';

// The public offer-request instrument. Styled as a typed form from an old
// firm — paper surface, Courier field labels, hairline ledger rules — per
// docs/brand/KEPT.md (the offer letter is the brand's signature artefact)
// and apps/web/DESIGN.md (no chat theatre). The component keeps the
// historical `ChatFlow` export name; /sell renders it with
// defaultRole="seller".

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

const BEDROOMS = [1, 2, 3, 4, 5].map((n) => ({
  label: n === 5 ? '5+' : String(n),
  value: n,
}));

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

function formatGBP(pence: number) {
  return `£${Math.round(pence / 100).toLocaleString('en-GB')}`;
}

const inputClass =
  'w-full rounded-[2px] border border-hair bg-white px-4 py-3 text-sm text-forest outline-none transition focus:border-leaf';
const courier = '[font-family:var(--font-courier)]';

/** One ledger row of the form: Courier label left, control right. */
function Row({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 py-5 md:grid-cols-[190px_1fr] md:gap-8">
      <div>
        <span className={`${courier} text-[12px] text-body`}>{label}</span>
        {hint && <p className="mt-1 text-[11px] text-stone-400">{hint}</p>}
      </div>
      <div>
        {children}
        {error && <p className="mt-2 text-wax text-xs">{error}</p>}
      </div>
    </div>
  );
}

/** Squared toggle group. Selected = leaf (interactive), unselected = paper. */
function Choice({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { label: string; value: string | number }[];
  value: string | number | undefined;
  onChange: (v: string | number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={String(o.value)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`rounded-[2px] border px-4 py-2 text-sm transition disabled:opacity-60 ${
              selected
                ? 'border-leaf bg-leaf text-white'
                : 'border-hair bg-white text-forest hover:bg-soft'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

type ChatFlowProps = {
  /** Pre-set the role so the role question is skipped. */
  defaultRole?: 'agent' | 'seller';
};

export function ChatFlow({ defaultRole }: ChatFlowProps = {}) {
  const [status, setStatus] = useState<
    'idle' | 'submitting' | 'result' | 'error'
  >('idle');
  const [offer, setOffer] = useState<OfferResult | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [propertyType, setPropertyType] = useState<string>();
  const [bedrooms, setBedrooms] = useState<number>();
  const [role, setRole] = useState<string | undefined>(defaultRole);
  const [firmName, setFirmName] = useState('');
  const [situation, setSituation] = useState<string>();
  const [condition, setCondition] = useState<number>();
  const [urgencyDays, setUrgencyDays] = useState<number>();
  const [asking, setAsking] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const isAgent = (role ?? defaultRole) === 'agent';
  const submitting = status === 'submitting';

  const validate = () => {
    const e: Record<string, string> = {};
    if (!address.trim()) e.address = 'The property address is required.';
    if (!/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(postcode.trim())) {
      e.postcode = 'Please enter a valid UK postcode (e.g. M1 5AB).';
    }
    if (!propertyType) e.propertyType = 'Select the property type.';
    if (!bedrooms) e.bedrooms = 'Select the number of bedrooms.';
    if (!defaultRole && !role) e.role = 'Tell us who you are.';
    if (isAgent && !firmName.trim()) e.firmName = 'Your firm name is required.';
    if (!situation) e.situation = 'Select the situation.';
    if (!condition) e.condition = 'Rate the condition.';
    if (!urgencyDays) e.urgencyDays = 'Select a timeline.';
    if (!contactName.trim()) e.contactName = 'Your name is required.';
    if (!/^\S+@\S+\.\S+$/.test(contactEmail.trim())) {
      e.contactEmail = 'A valid email is required to send the offer.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setStatus('submitting');
    setServerError(null);

    // Read the agent referral code lazily so the component never suspends
    // on the router (a useSearchParams Suspense boundary was silently
    // swallowing the whole form on the static /sell page).
    const referralCode =
      new URLSearchParams(window.location.search).get('ref') || undefined;
    const askingDigits = asking.replace(/[^0-9]/g, '');
    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: address.trim(),
          postcode: postcode.trim().toUpperCase(),
          propertyType,
          bedrooms,
          role: role ?? defaultRole,
          firmName: isAgent ? firmName.trim() : undefined,
          situation,
          condition,
          urgencyDays,
          askingPricePence: askingDigits
            ? Number(askingDigits) * 100
            : undefined,
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim(),
          referralCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error || 'Something went wrong');
        setStatus('error');
        return;
      }
      setOffer(data);
      setStatus('result');
    } catch {
      setServerError('Could not reach the offer engine. Please try again.');
      setStatus('error');
    }
  };

  if (status === 'result' && offer) {
    return <OfferCard offer={offer} />;
  }

  return (
    <div className="rounded-[2px] border border-hair bg-white p-6 shadow-[0_24px_48px_-32px_rgba(31,51,43,0.35)] md:p-10">
      {/* Letterhead */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-hair border-b pb-5">
        <Eyebrow>request an indicative offer</Eyebrow>
        <span className={`${courier} text-[11px] text-stone-400`}>
          Form OR-1 · about a minute · no obligation
        </span>
      </div>

      <form onSubmit={handleSubmit} className="divide-y divide-hair">
        <Row label="Property address" error={errors.address}>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="14 Acacia Avenue"
            disabled={submitting}
            className={`${inputClass} ${courier}`}
          />
        </Row>

        <Row label="Postcode" error={errors.postcode}>
          <input
            type="text"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            placeholder="SK4 3HQ"
            disabled={submitting}
            className={`${inputClass} ${courier} max-w-[220px] uppercase`}
          />
        </Row>

        <Row label="Property type" error={errors.propertyType}>
          <Choice
            options={PROPERTY_TYPES}
            value={propertyType}
            onChange={(v) => setPropertyType(String(v))}
            disabled={submitting}
          />
        </Row>

        <Row label="Bedrooms" error={errors.bedrooms}>
          <Choice
            options={BEDROOMS}
            value={bedrooms}
            onChange={(v) => setBedrooms(Number(v))}
            disabled={submitting}
          />
        </Row>

        {!defaultRole && (
          <Row label="You are" error={errors.role}>
            <Choice
              options={ROLES}
              value={role}
              onChange={(v) => setRole(String(v))}
              disabled={submitting}
            />
          </Row>
        )}

        {isAgent && (
          <Row label="Your firm" error={errors.firmName}>
            <input
              type="text"
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              placeholder="Firm name"
              disabled={submitting}
              className={inputClass}
            />
          </Row>
        )}

        <Row
          label={defaultRole === 'agent' ? "Seller's situation" : 'Situation'}
          error={errors.situation}
        >
          <Choice
            options={SITUATIONS}
            value={situation}
            onChange={(v) => setSituation(String(v))}
            disabled={submitting}
          />
        </Row>

        <Row
          label="Condition"
          hint="1 = needs gutting, 10 = mint"
          error={errors.condition}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
              <button
                key={v}
                type="button"
                disabled={submitting}
                onClick={() => setCondition(v)}
                className={`h-10 w-10 rounded-[2px] border text-sm tabular-nums transition ${
                  condition === v
                    ? 'border-leaf bg-leaf text-white'
                    : 'border-hair bg-white text-forest hover:bg-soft'
                }`}
              >
                {v}
              </button>
            ))}
            {condition && (
              <span className={`${courier} ml-2 text-[12px] text-body`}>
                {CONDITION_LABELS[condition]}
              </span>
            )}
          </div>
        </Row>

        <Row label="Timeline" error={errors.urgencyDays}>
          <Choice
            options={URGENCIES}
            value={urgencyDays}
            onChange={(v) => setUrgencyDays(Number(v))}
            disabled={submitting}
          />
        </Row>

        <Row label="Asking price" hint="Optional">
          <div className="relative max-w-[260px]">
            <span className="-translate-y-1/2 absolute top-1/2 left-4 text-stone-400">
              £
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={asking}
              onChange={(e) => setAsking(e.target.value)}
              placeholder="If one is in mind"
              disabled={submitting}
              className={`${inputClass} ${courier} pl-8`}
            />
          </div>
        </Row>

        <Row
          label="Your details"
          hint="Only used to send you the offer"
          error={errors.contactName || errors.contactEmail}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Full name"
              disabled={submitting}
              className={inputClass}
            />
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="Email"
              disabled={submitting}
              className={inputClass}
            />
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="Phone (optional)"
              disabled={submitting}
              className={`${inputClass} sm:col-span-2`}
            />
          </div>
        </Row>

        {/* Signature line */}
        <div className="pt-6">
          {status === 'error' && (
            <div className="mb-4 rounded-[2px] border border-hair bg-soft p-4">
              <p className="font-serif text-forest">
                Couldn’t generate an offer right now.
              </p>
              <p className="mt-1 text-sm text-wax">
                {serverError ||
                  'A member of our team will email you a manual offer shortly.'}
              </p>
            </div>
          )}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-leaf px-8 py-4 font-medium text-sm text-white transition hover:bg-leaf-dark disabled:opacity-60"
            >
              {submitting ? 'Preparing your offer…' : 'Prepare my offer'}
            </button>
            <p
              className={`${courier} max-w-sm text-[11px] text-stone-400 leading-relaxed`}
            >
              {submitting
                ? 'Checking HM Land Registry sales, the EPC register and local risk data. Usually under a minute.'
                : 'Priced from HM Land Registry comparables, the EPC register and local risk data. The methodology is published.'}
            </p>
          </div>
        </div>
      </form>
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
      <div className="rounded-[2px] border border-hair bg-white p-8 shadow-sm">
        <Eyebrow>manual review</Eyebrow>
        <h3 className="mt-2 font-semibold font-serif text-3xl text-forest">
          Your property needs a human look.
        </h3>
        <p className="mt-4 text-body">
          Based on the details you shared, we want our senior appraiser to
          personally verify before we commit. Expect a firm written offer by
          email, no obligation.
        </p>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="rounded-[2px] border border-leaf/30 bg-white p-8 text-center">
        <p className="font-serif text-2xl text-forest">
          Offer reserved. Welcome to Kept.
        </p>
        <p className="mt-3 text-body text-sm">
          We’ve emailed you the signed offer. Our team will be in touch to start
          the process.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[2px] border border-hair bg-white p-8 shadow-md">
      <Eyebrow>your offer is ready</Eyebrow>
      <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <p className="text-body text-sm">Market value range</p>
          <p className="mt-1 font-serif text-forest text-xl">
            {formatGBP(offer.estimatedMarketValueMinPence)} –{' '}
            {formatGBP(offer.estimatedMarketValueMaxPence)}
          </p>
          <p className="mt-8 text-body text-sm">Our cash offer</p>
          <p className="mt-1 font-bold font-serif text-6xl text-forest">
            {formatGBP(offer.offerPence)}
          </p>
          <p className="mt-2 text-stone-500 text-xs">
            Priced for a cash completion in weeks, with no fees to pay
          </p>
        </div>
        <div className="space-y-6">
          <div>
            <p className="text-body text-sm">Completion</p>
            <p className="mt-1 font-serif text-2xl text-forest">
              {offer.completionDays} days
            </p>
          </div>
          <div>
            <p className="text-body text-sm">Confidence</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-soft">
              <div
                className="h-full bg-leaf transition-all"
                style={{ width: `${offer.confidenceScore * 100}%` }}
              />
            </div>
            <p className="mt-1 text-stone-500 text-xs">
              {Math.round(offer.confidenceScore * 100)}%
            </p>
          </div>
          <div className="rounded-[2px] border border-hair bg-soft px-4 py-3 text-body text-xs">
            Legally binding if accepted. Locked until{' '}
            {new Date(offer.lockedUntil).toLocaleString('en-GB', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </div>
        </div>
      </div>

      <details className="mt-8 rounded-[2px] border border-hair bg-cream p-4">
        <summary className="cursor-pointer font-medium text-forest text-sm">
          See the reasoning
        </summary>
        <ul className="mt-3 space-y-2 text-body text-sm">
          {offer.reasoning.map((line, i) => (
            <li key={i}>· {line}</li>
          ))}
        </ul>
      </details>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={handleReserve}
          disabled={accepting}
          className="flex-1 rounded-md bg-leaf px-6 py-4 font-medium text-sm text-white transition hover:bg-leaf-dark disabled:opacity-50"
        >
          {accepting ? 'Reserving...' : 'Reserve this offer →'}
        </button>
        <a
          href={`/instant-offer/offer/${offer.quoteId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-hair px-6 py-4 text-center text-forest text-sm transition hover:bg-soft"
        >
          View certificate
        </a>
      </div>

      {offer.trackUrl && (
        <div className="mt-5 rounded-[2px] border border-hair bg-cream p-4">
          <Eyebrow tone="muted">live timeline</Eyebrow>
          <p className="mt-2 text-body text-sm">
            Bookmark this URL. Every party in the chain sees the same updates
            here, no login required.
          </p>
          <a
            href={offer.trackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block break-all font-mono text-leaf text-xs underline underline-offset-4"
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
    <div className="mt-6 rounded-[2px] border border-hair bg-soft p-6">
      <p className="font-semibold font-serif text-forest text-lg">
        Your referral is logged.
      </p>
      <p className="mt-1 text-body text-sm">
        Every seller you send to the link below is credited to{' '}
        <strong>{account.firmName}</strong> automatically. Partner fee agreed in
        writing per deal. No signup. Just bookmark and share.
      </p>

      <div className="mt-5 rounded-[2px] border border-hair bg-white p-4">
        <Eyebrow tone="muted">your personal referral link</Eyebrow>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            readOnly
            value={link}
            className="flex-1 rounded-[2px] border border-hair bg-cream px-3 py-2 font-mono text-forest text-xs"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-md bg-leaf px-4 py-2 font-medium text-white text-xs transition hover:bg-leaf-dark"
          >
            {copied ? 'Copied ✓' : 'Copy link'}
          </button>
        </div>
        <p className="mt-3 text-stone-500 text-xs">
          Referral code:{' '}
          <span className="font-mono font-semibold text-forest">
            {account.referralCode}
          </span>
        </p>
      </div>

      <a
        href="/partners/login"
        className="mt-4 inline-block text-body text-xs underline underline-offset-4 hover:text-leaf"
      >
        Want a full dashboard of your referrals, deal stages, and partner-fee
        status? Claim your account →
      </a>
    </div>
  );
}
