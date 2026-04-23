'use client';

import { useMemo, useState } from 'react';

type Lot = {
  id: string;
  sourceHouse: string;
  sourceLotRef: string;
  auctionDate: string;
  address: string;
  postcode: string;
  propertyType: string;
  guidePriceMinPence: number | null;
  guidePriceMaxPence: number | null;
  lotUrl: string | null;
};

type Props = {
  lots: Lot[];
};

const sourceLabels: Record<string, string> = {
  auction_house_uk: 'Auction House UK',
  savills: 'Savills',
  clive_emson: 'Clive Emson',
};

const typeLabels: Record<string, string> = {
  terraced_house: 'Terraced',
  semi_detached: 'Semi',
  detached: 'Detached',
  flat: 'Flat',
  commercial: 'Commercial',
  land: 'Land',
  other: 'Other',
};

function formatGBP(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

function formatGuide(min: number | null, max: number | null): string {
  if (min == null && max == null) return '—';
  if (min != null && max != null) {
    if (min === max) return formatGBP(min);
    return `${formatGBP(min)} – ${formatGBP(max)}`;
  }
  return formatGBP((min ?? max) as number);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function AuctionsTable({ lots }: Props) {
  const [postcode, setPostcode] = useState('');
  const [propertyType, setPropertyType] = useState('all');
  const [maxGuide, setMaxGuide] = useState(''); // £ (not pence)
  const [fromDate, setFromDate] = useState('');

  const filtered = useMemo(() => {
    return lots.filter((l) => {
      if (postcode && !l.postcode.toUpperCase().startsWith(postcode.toUpperCase())) {
        return false;
      }
      if (propertyType !== 'all' && l.propertyType !== propertyType) return false;
      if (maxGuide) {
        const max = parseInt(maxGuide, 10) * 100;
        if (!Number.isNaN(max) && l.guidePriceMinPence != null && l.guidePriceMinPence > max) {
          return false;
        }
      }
      if (fromDate && new Date(l.auctionDate) < new Date(fromDate)) return false;
      return true;
    });
  }, [lots, postcode, propertyType, maxGuide, fromDate]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Postcode (e.g. M40)"
          value={postcode}
          onChange={(e) => setPostcode(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        <select
          value={propertyType}
          onChange={(e) => setPropertyType(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <option value="all">All property types</option>
          {Object.entries(typeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Max guide (£)"
          value={maxGuide}
          onChange={(e) => setMaxGuide(e.target.value)}
          className="w-40 rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        <span className="ml-auto text-gray-600 text-sm dark:text-gray-400">
          {filtered.length} of {lots.length} lots
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Address</th>
              <th className="px-4 py-3 font-medium">Postcode</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Guide</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Lot</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {filtered.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                <td className="px-4 py-3 whitespace-nowrap">
                  {formatDate(l.auctionDate)}
                </td>
                <td className="px-4 py-3">{l.address}</td>
                <td className="px-4 py-3 font-mono text-xs">{l.postcode}</td>
                <td className="px-4 py-3">
                  {typeLabels[l.propertyType] ?? l.propertyType}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {formatGuide(l.guidePriceMinPence, l.guidePriceMaxPence)}
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs dark:text-gray-400">
                  {sourceLabels[l.sourceHouse] ?? l.sourceHouse}
                </td>
                <td className="px-4 py-3">
                  {l.lotUrl ? (
                    <a
                      href={l.lotUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {l.sourceLotRef}
                    </a>
                  ) : (
                    <span className="text-gray-500">{l.sourceLotRef}</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                >
                  No lots match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
