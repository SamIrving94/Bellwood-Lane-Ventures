'use client';

import { useState, useTransition } from 'react';
import { calculateBellwoodScore } from './actions';

type Result = Awaited<ReturnType<typeof calculateBellwoodScore>>;

const PROPERTY_TYPES = [
  { value: 'terraced', label: 'Terraced' },
  { value: 'semi_detached', label: 'Semi-detached' },
  { value: 'detached', label: 'Detached' },
  { value: 'flat', label: 'Flat / apartment' },
];

const SITUATIONS = [
  { value: 'chain_break', label: 'Chain break' },
  { value: 'probate', label: 'Probate' },
  { value: 'relocation', label: 'Relocation' },
  { value: 'short_lease', label: 'Short lease' },
  { value: 'problem_property', label: 'Problem property' },
  { value: 'repossession', label: 'Repossession / LPA' },
  { value: 'other', label: 'Other / standard' },
];

function formatGBP(pence: number) {
  return `£${Math.round(pence / 100).toLocaleString('en-GB')}`;
}

export function BellwoodScoreForm() {
  const [postcode, setPostcode] = useState('');
  const [address, setAddress] = useState('');
  const [propertyType, setPropertyType] = useState('semi_detached');
  const [bedrooms, setBedrooms] = useState('3');
  const [condition, setCondition] = useState('6');
  const [situation, setSituation] = useState('chain_break');
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const r = await calculateBellwoodScore({
        postcode,
        address: address || undefined,
        propertyType,
        bedrooms: Number(bedrooms) || undefined,
        condition: Number(condition) || undefined,
        situation,
      });
      setResult(r);
    });
  };

  return (
    <div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="font-serif italic text-[13px] text-stone-600">
              Postcode *
            </span>
            <input
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.toUpperCase())}
              required
              placeholder="M14 5LL"
              className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-[15px] font-mono uppercase outline-none focus:border-[#DB5C5C]"
            />
          </label>
          <label className="block">
            <span className="font-serif italic text-[13px] text-stone-600">
              Address (optional)
            </span>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="14 Acacia Avenue"
              className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-[15px] outline-none focus:border-[#DB5C5C]"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="font-serif italic text-[13px] text-stone-600">
              Property type
            </span>
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-[15px] outline-none focus:border-[#DB5C5C]"
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="font-serif italic text-[13px] text-stone-600">
              Bedrooms
            </span>
            <input
              type="number"
              min="1"
              max="12"
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
              className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-[15px] outline-none focus:border-[#DB5C5C]"
            />
          </label>
          <label className="block">
            <span className="font-serif italic text-[13px] text-stone-600">
              Condition (1–10)
            </span>
            <input
              type="number"
              min="1"
              max="10"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-[15px] outline-none focus:border-[#DB5C5C]"
            />
          </label>
        </div>

        <label className="block">
          <span className="font-serif italic text-[13px] text-stone-600">
            Seller situation
          </span>
          <select
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-[15px] outline-none focus:border-[#DB5C5C]"
          >
            {SITUATIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={pending || !postcode}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#874646] px-7 py-3.5 text-sm font-medium text-white transition hover:bg-[#6F3A3A] disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
        >
          {pending ? 'Calculating…' : 'Get indicative range →'}
        </button>
      </form>

      {result && result.ok && (
        <div className="mt-8 rounded-2xl border-2 border-[#DB5C5C]/40 bg-[#F6ECE7] p-6 md:p-8">
          <p className="font-serif italic text-[13px] text-[#DB5C5C]">
            Indicative range
          </p>
          <p className="mt-2 font-serif text-3xl font-semibold tracking-[-0.02em] text-[#2B2220] md:text-5xl">
            {formatGBP(result.indicativeMinPence)} –{' '}
            {formatGBP(result.indicativeMaxPence)}
          </p>
          <p className="mt-2 text-[12px] text-stone-600">
            Mid: {formatGBP(result.indicativeMidPence)} ·{' '}
            {Math.round(result.offerPercentOfAvm * 100)}% of AVM mid ·
            Confidence {Math.round(result.confidenceScore * 100)}%
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-3 text-[12px] md:grid-cols-4">
            <div>
              <dt className="text-stone-500">AVM low</dt>
              <dd className="font-mono text-[13px] font-semibold text-[#2B2220]">
                {formatGBP(result.avmMinPence)}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">AVM high</dt>
              <dd className="font-mono text-[13px] font-semibold text-[#2B2220]">
                {formatGBP(result.avmMaxPence)}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">EPC</dt>
              <dd className="font-mono text-[13px] font-semibold text-[#2B2220]">
                {result.epcRating ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Market</dt>
              <dd className="font-mono text-[13px] font-semibold capitalize text-[#2B2220]">
                {result.marketBand ?? '—'}
              </dd>
            </div>
          </dl>

          {result.tenure && (
            <p className="mt-4 text-[12px] text-stone-600">
              <strong>Tenure:</strong> {result.tenure}
              {result.remainingLeaseYears
                ? ` · ${result.remainingLeaseYears} years remaining`
                : ''}
            </p>
          )}

          {result.reasoning.length > 0 && (
            <details className="mt-5">
              <summary className="cursor-pointer font-serif italic text-[13px] text-stone-500 hover:text-[#2B2220]">
                Reasoning ({result.reasoning.length})
              </summary>
              <ul className="mt-3 space-y-1.5 text-[12px] text-stone-600">
                {result.reasoning.map((line, i) => (
                  <li key={i}>· {line}</li>
                ))}
              </ul>
            </details>
          )}

          <div className="mt-6 border-t border-amber-200 pt-4 text-[12px] leading-relaxed text-stone-600">
            <p>
              <strong>This is an indicative range</strong> based on publicly
              available data. Bellwood&rsquo;s confirmed offer is issued after
              a physical viewing and may differ. The price we confirm in
              writing is the price we complete at.
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <a
              href="/save-the-sale"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#DB5C5C] px-6 py-3 text-sm font-medium text-[#2B2220] transition hover:bg-[#b08f52]"
            >
              Send this property to us →
            </a>
            <a
              href="/instant-offer/methodology"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-6 py-3 text-sm text-stone-700 transition hover:border-stone-400"
            >
              See methodology
            </a>
          </div>
        </div>
      )}

      {result && !result.ok && (
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <strong>Couldn&rsquo;t calculate:</strong> {result.error}
        </div>
      )}
    </div>
  );
}
