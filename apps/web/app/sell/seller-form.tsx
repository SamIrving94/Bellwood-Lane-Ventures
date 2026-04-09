'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export const SellerForm = () => {
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

        const res = await fetch(`${apiUrl}/intake`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: fd.get('address'),
            postcode: fd.get('postcode'),
            propertyType: fd.get('propertyType'),
            bedrooms: fd.get('bedrooms'),
            reason: fd.get('reason'),
            askingPrice: fd.get('askingPrice'),
            name: fd.get('name'),
            email: fd.get('email'),
            phone: fd.get('phone'),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Something went wrong. Please try again.');
          return;
        }

        router.push('/sell/thank-you');
      } catch {
        setError('Unable to submit. Please try again or email us directly.');
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border bg-white p-6 shadow-sm"
    >
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Address */}
      <div>
        <label
          htmlFor="address"
          className="block text-sm font-medium text-gray-700"
        >
          Property Address *
        </label>
        <input
          id="address"
          name="address"
          type="text"
          required
          placeholder="e.g. 42 Oak Lane, London"
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      {/* Postcode */}
      <div>
        <label
          htmlFor="postcode"
          className="block text-sm font-medium text-gray-700"
        >
          Postcode *
        </label>
        <input
          id="postcode"
          name="postcode"
          type="text"
          required
          placeholder="e.g. SE18 7AB"
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm uppercase"
        />
      </div>

      {/* Property type + bedrooms */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="propertyType"
            className="block text-sm font-medium text-gray-700"
          >
            Property Type
          </label>
          <select
            id="propertyType"
            name="propertyType"
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="semi-detached">Semi-detached</option>
            <option value="terraced">Terraced</option>
            <option value="detached">Detached</option>
            <option value="flat">Flat</option>
            <option value="bungalow">Bungalow</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="bedrooms"
            className="block text-sm font-medium text-gray-700"
          >
            Bedrooms
          </label>
          <select
            id="bedrooms"
            name="bedrooms"
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5+</option>
          </select>
        </div>
      </div>

      {/* Reason for selling */}
      <div>
        <label
          htmlFor="reason"
          className="block text-sm font-medium text-gray-700"
        >
          Why are you selling?
        </label>
        <select
          id="reason"
          name="reason"
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Select a reason...</option>
          <option value="chain_break">
            My sale fell through / chain broke
          </option>
          <option value="probate">Inherited property / probate</option>
          <option value="relocation">
            Relocating for work or personal reasons
          </option>
          <option value="repossession">Facing repossession</option>
          <option value="short_lease">Short lease on my property</option>
          <option value="other">Other reason</option>
        </select>
      </div>

      {/* Asking price */}
      <div>
        <label
          htmlFor="askingPrice"
          className="block text-sm font-medium text-gray-700"
        >
          What price are you looking for? (optional)
        </label>
        <div className="relative mt-1">
          <span className="absolute left-3 top-2 text-sm text-gray-500">
            &pound;
          </span>
          <input
            id="askingPrice"
            name="askingPrice"
            type="number"
            placeholder="e.g. 200000"
            className="w-full rounded-md border py-2 pl-7 pr-3 text-sm"
          />
        </div>
      </div>

      {/* Contact details */}
      <div className="border-t pt-6">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">
          Your Contact Details
        </h3>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700"
            >
              Full Name *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-gray-700"
              >
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {isPending ? 'Submitting...' : 'Get My Free Cash Offer'}
      </button>

      <p className="text-center text-xs text-gray-500">
        No obligation. We&apos;ll get back to you within 48 hours with a
        guaranteed cash offer.
      </p>
    </form>
  );
};
