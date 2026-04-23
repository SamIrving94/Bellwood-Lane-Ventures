'use client';

import { createCampaign } from '@/app/actions/campaigns/create';
import { Button } from '@repo/design-system/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

const PROPERTY_TYPES = [
  { value: 'terraced_house', label: 'Terraced house' },
  { value: 'semi_detached', label: 'Semi-detached' },
  { value: 'detached', label: 'Detached' },
  { value: 'flat', label: 'Flat' },
  { value: 'bungalow', label: 'Bungalow' },
];

const SELLER_TYPES = [
  { value: 'probate', label: 'Probate' },
  { value: 'chain_break', label: 'Chain break' },
  { value: 'repossession', label: 'Repossession' },
  { value: 'relocation', label: 'Relocation' },
  { value: 'short_lease', label: 'Short lease' },
];

const OUTREACH_CHANNELS = [
  { value: 'estate_agents', label: 'Estate agents' },
  { value: 'solicitors', label: 'Probate solicitors' },
  { value: 'direct_mail', label: 'Direct mail (vendors, held for review)' },
];

function parsePoundsToPence(value: string): number | undefined {
  const cleaned = value.replace(/[£,\s]/g, '');
  if (!cleaned) return undefined;
  const pounds = parseFloat(cleaned);
  if (isNaN(pounds) || pounds < 0) return undefined;
  return Math.round(pounds * 100);
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [postcodeArea, setPostcodeArea] = useState('');
  const [radiusMiles, setRadiusMiles] = useState(3);
  const [propertyTypes, setPropertyTypes] = useState<string[]>(['terraced_house', 'semi_detached']);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sellerTypes, setSellerTypes] = useState<string[]>(['probate', 'chain_break']);
  const [minLeadScore, setMinLeadScore] = useState(50);
  const [outreachChannels, setOutreachChannels] = useState<string[]>(['estate_agents', 'solicitors']);
  const [budget, setBudget] = useState('');
  const [dailyCap, setDailyCap] = useState(20);
  const [targetEndDate, setTargetEndDate] = useState('');

  const toggleInArray = (
    value: string,
    arr: string[],
    setter: (next: string[]) => void
  ) => {
    if (arr.includes(value)) setter(arr.filter((v) => v !== value));
    else setter([...arr, value]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!/^[A-Za-z]{1,2}[0-9][0-9A-Za-z]?$/.test(postcodeArea.trim())) {
      setError('Postcode area must look like M1, B15, or LS6');
      return;
    }
    if (propertyTypes.length === 0) {
      setError('Pick at least one property type');
      return;
    }
    if (sellerTypes.length === 0) {
      setError('Pick at least one seller type');
      return;
    }
    if (outreachChannels.length === 0) {
      setError('Pick at least one outreach channel');
      return;
    }

    startTransition(async () => {
      try {
        const result = await createCampaign({
          name: name.trim(),
          postcodeArea: postcodeArea.trim(),
          radiusMiles,
          propertyTypes,
          minPricePence: parsePoundsToPence(minPrice),
          maxPricePence: parsePoundsToPence(maxPrice),
          sellerTypes,
          minLeadScore,
          outreachChannels,
          budgetPence: parsePoundsToPence(budget),
          dailyCap,
          targetEndDate: targetEndDate || undefined,
        });
        router.push(`/campaigns/${result.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create campaign');
      }
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">New Campaign</h1>
          <p className="text-sm text-muted-foreground">
            Give Paperclip a brief. It&apos;ll source + qualify + draft outreach in your chosen patch.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/campaigns">Cancel</Link>
        </Button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="max-w-3xl space-y-6 rounded-lg border bg-card p-6"
      >
        {/* Name */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Campaign name</label>
          <input
            type="text"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="e.g. Manchester M1 probate sweep — April"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        {/* Geography */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Postcode area</label>
            <input
              type="text"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm uppercase"
              placeholder="M1"
              value={postcodeArea}
              onChange={(e) => setPostcodeArea(e.target.value.toUpperCase())}
              required
            />
            <p className="text-xs text-muted-foreground">UK postcode prefix — M1, B15, LS6, etc.</p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Radius: <span className="text-primary">{radiusMiles} mi</span>
            </label>
            <input
              type="range"
              min={1}
              max={25}
              value={radiusMiles}
              onChange={(e) => setRadiusMiles(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {/* Property types */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Property types</label>
          <div className="flex flex-wrap gap-2">
            {PROPERTY_TYPES.map((pt) => (
              <label
                key={pt.value}
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                  propertyTypes.includes(pt.value)
                    ? 'border-primary bg-primary/10'
                    : 'bg-background'
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={propertyTypes.includes(pt.value)}
                  onChange={() => toggleInArray(pt.value, propertyTypes, setPropertyTypes)}
                />
                {pt.label}
              </label>
            ))}
          </div>
        </div>

        {/* Price range */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Min price (£)</label>
            <input
              type="text"
              inputMode="numeric"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="100,000"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Max price (£)</label>
            <input
              type="text"
              inputMode="numeric"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="350,000"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>
        </div>

        {/* Seller types */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Target seller types</label>
          <div className="flex flex-wrap gap-2">
            {SELLER_TYPES.map((st) => (
              <label
                key={st.value}
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                  sellerTypes.includes(st.value)
                    ? 'border-primary bg-primary/10'
                    : 'bg-background'
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={sellerTypes.includes(st.value)}
                  onChange={() => toggleInArray(st.value, sellerTypes, setSellerTypes)}
                />
                {st.label}
              </label>
            ))}
          </div>
        </div>

        {/* Lead score */}
        <div className="space-y-1">
          <label className="text-sm font-medium">
            Minimum lead score: <span className="text-primary">{minLeadScore}</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={minLeadScore}
            onChange={(e) => setMinLeadScore(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Outreach channels */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Outreach channels</label>
          <div className="flex flex-wrap gap-2">
            {OUTREACH_CHANNELS.map((oc) => (
              <label
                key={oc.value}
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                  outreachChannels.includes(oc.value)
                    ? 'border-primary bg-primary/10'
                    : 'bg-background'
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={outreachChannels.includes(oc.value)}
                  onChange={() =>
                    toggleInArray(oc.value, outreachChannels, setOutreachChannels)
                  }
                />
                {oc.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Vendor direct mail is always held for founder review before sending.
          </p>
        </div>

        {/* Budget + cap + end date */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Budget (£)</label>
            <input
              type="text"
              inputMode="numeric"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="500"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Daily cap (outreach)</label>
            <input
              type="number"
              min={1}
              max={500}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={dailyCap}
              onChange={(e) => setDailyCap(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Target end date</label>
            <input
              type="date"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={targetEndDate}
              onChange={(e) => setTargetEndDate(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="outline" asChild>
            <Link href="/campaigns">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Creating...' : 'Create Campaign'}
          </Button>
        </div>
      </form>
    </div>
  );
}
