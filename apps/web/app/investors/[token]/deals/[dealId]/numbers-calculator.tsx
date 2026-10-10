'use client';

import { SDLT_RATES_LABEL, dealNumbers, gbp } from '@/lib/investor-pack';
import { useState } from 'react';

/**
 * "Run your own numbers." The price is fixed; everything else starts at our
 * estimate and the investor can change it. Stamp duty is computed, not
 * typed, so the total is always internally consistent.
 */
export function NumbersCalculator({
  price,
  refurb,
  monthlyRent,
  valueAfterWorks,
}: {
  price: number;
  refurb: number | null;
  monthlyRent: number | null;
  valueAfterWorks: number | null;
}) {
  const [refurbIn, setRefurbIn] = useState(String(refurb ?? 0));
  const [legalIn, setLegalIn] = useState('2000');
  const [rentIn, setRentIn] = useState(monthlyRent ? String(monthlyRent) : '');
  const [gdvIn, setGdvIn] = useState(
    valueAfterWorks ? String(valueAfterWorks) : ''
  );

  const n = (s: string) => {
    const v = Number(s.replace(/[£,\s]/g, ''));
    return Number.isFinite(v) && v > 0 ? v : 0;
  };

  const r = dealNumbers({
    price,
    refurb: n(refurbIn),
    legal: n(legalIn),
    monthlyRent: n(rentIn) || null,
    valueAfterWorks: n(gdvIn) || null,
  });

  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    hint?: string
  ) => (
    <label className="block">
      <span className="text-[12.5px] text-body">{label}</span>
      <div className="mt-1 flex items-center rounded-[2px] border border-hair bg-white focus-within:border-forest">
        <span className="pl-3 text-[15px] text-body">£</span>
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => set(e.target.value)}
          className="w-full bg-transparent px-2 py-2.5 text-[15px] text-forest tabular-nums outline-none"
        />
      </div>
      {hint && (
        <span className="mt-1 block text-[11.5px] text-stone-500">{hint}</span>
      )}
    </label>
  );

  const Out = ({
    label,
    value,
    strong,
  }: {
    label: string;
    value: string;
    strong?: boolean;
  }) => (
    <div className="flex items-baseline justify-between gap-4 border-hair border-b py-2.5 last:border-b-0">
      <span className="text-[13.5px] text-body">{label}</span>
      <span
        className={`tabular-nums ${strong ? 'font-bold font-serif text-[22px] text-forest' : 'text-[15px] text-forest'}`}
      >
        {value}
      </span>
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-8 rounded-[2px] border border-hair bg-white p-5 md:grid-cols-2 md:p-7">
      <div className="space-y-4">
        <div className="block">
          <span className="text-[12.5px] text-body">Price</span>
          <p className="mt-1 py-2.5 font-semibold text-[15px] text-forest tabular-nums">
            {gbp(price)}{' '}
            <span className="font-normal text-stone-500">fixed</span>
          </p>
        </div>
        {field(
          'Refurbishment',
          refurbIn,
          setRefurbIn,
          refurb ? 'Starts at our estimate' : undefined
        )}
        {field('Legal and survey', legalIn, setLegalIn)}
        {field(
          'Rent per month',
          rentIn,
          setRentIn,
          monthlyRent ? 'Starts at our estimate' : undefined
        )}
        {field(
          'Value after works',
          gdvIn,
          setGdvIn,
          valueAfterWorks ? 'Starts at our estimate' : undefined
        )}
      </div>
      <div>
        <Out label="Stamp duty (estimate)" value={gbp(r.sdlt)} />
        <Out label="Total cash in" value={gbp(r.totalIn)} strong />
        <Out
          label="Gross yield"
          value={
            r.grossYield === null ? 'Add rent' : `${r.grossYield.toFixed(1)}%`
          }
        />
        <Out
          label="Uplift after works"
          value={r.uplift === null ? 'Add value' : gbp(r.uplift)}
        />
        <Out
          label="Uplift on cash in"
          value={
            r.returnOnCash === null
              ? 'Add value'
              : `${r.returnOnCash.toFixed(1)}%`
          }
        />
        <p className="mt-4 text-[11.5px] text-stone-500 leading-[1.55]">
          Stamp duty assumes an individual buying an additional home (
          {SDLT_RATES_LABEL}, including the 5% higher rate). Company and
          non-resident purchases differ. Estimates only: check them with your
          own adviser.
        </p>
      </div>
    </div>
  );
}
